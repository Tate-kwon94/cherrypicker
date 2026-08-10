#!/usr/bin/env node
/**
 * DB 스키마 drift 검사 (L-05).
 *
 * 같은 테이블을 세 곳이 각자 기술한다.
 *
 *   1. `db/schema.ts`        — Drizzle 정의. 타입이 이걸 따른다.
 *   2. `drizzle/*.sql`       — 실제로 D1 에 적용되는 것.
 *   3. `app/lib/*.ts` 의 SQL — 런타임이 실제로 실행하는 것.
 *
 * 문제는 손으로 쓴 SQL 자체가 아니라 셋이 어긋나도 아무도 모른다는 점이다.
 * 타입 검사는 1 만 보고, 테스트의 D1 가짜는 문장 텍스트에 맞춰져 있어
 * 컬럼이 실제로 존재하는지 묻지 않는다. 그래서 존재하지 않는 컬럼을 읽는
 * SELECT 는 배포 후 첫 요청에서야 터진다.
 *
 * 자동 수정하지 않는다. 비교 대상 원본이 없으면 통과가 아니라 실패다.
 */
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

async function read(relativePath) {
  try {
    return await readFile(resolve(root, relativePath), "utf8");
  } catch (error) {
    fail(
      `${relativePath} 를 읽을 수 없습니다 (${error.code ?? error.name}). ` +
        `비교 대상 원본이 없으면 통과가 아니라 실패입니다.`,
    );
    return null;
  }
}

/** `sqliteTable("name", {...})` 블록에서 테이블별 실제 컬럼명을 뽑는다. */
function columnsFromDrizzle(source) {
  const tables = new Map();
  const tablePattern = /sqliteTable\(\s*"([a-z_]+)"\s*,\s*\{/g;

  for (const match of source.matchAll(tablePattern)) {
    const tableName = match[1];
    // 여는 중괄호부터 짝이 맞는 닫는 중괄호까지가 컬럼 정의 블록이다.
    let depth = 0;
    let end = -1;
    const start = match.index + match[0].length - 1;
    for (let i = start; i < source.length; i += 1) {
      if (source[i] === "{") depth += 1;
      else if (source[i] === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) {
      fail(`db/schema.ts 의 ${tableName} 정의에서 블록 끝을 찾지 못했습니다.`);
      continue;
    }

    const block = source.slice(start, end);
    // text("col") / integer("col") / real("col") 의 첫 인자가 컬럼명이다.
    const columns = new Set();
    for (const col of block.matchAll(/\b(?:text|integer|real)\(\s*"([a-z_]+)"/g)) {
      columns.add(col[1]);
    }
    tables.set(tableName, columns);
  }

  return tables;
}

/** 마이그레이션을 순서대로 적용해 테이블별 컬럼 집합을 만든다. */
function columnsFromMigrations(files) {
  const tables = new Map();

  for (const { name, sql } of files) {
    for (const create of sql.matchAll(
      /CREATE TABLE(?:\s+IF NOT EXISTS)?\s+`?([a-z_]+)`?\s*\(([\s\S]*?)\n\)/gi,
    )) {
      const table = create[1];
      const columns = new Set();
      for (const line of create[2].split("\n")) {
        const column = line.trim().match(/^`([a-z_]+)`/);
        if (column) columns.add(column[1]);
      }
      if (tables.has(table)) {
        fail(`${name}: 테이블 ${table} 을 두 번 CREATE 합니다.`);
      }
      tables.set(table, columns);
    }

    for (const alter of sql.matchAll(
      /ALTER TABLE\s+`?([a-z_]+)`?\s+ADD\s+`?([a-z_]+)`?/gi,
    )) {
      const [, table, column] = alter;
      const existing = tables.get(table);
      if (!existing) {
        fail(`${name}: 만들어진 적 없는 테이블 ${table} 에 컬럼을 추가합니다.`);
        continue;
      }
      if (existing.has(column)) {
        fail(`${name}: ${table}.${column} 을 두 번 추가합니다.`);
      }
      existing.add(column);
    }
  }

  return tables;
}

/**
 * 손으로 쓴 SQL 이 참조하는 `alias.column` 을 모은다.
 *
 * alias 를 테이블에 매핑할 수 있을 때만 검사한다. 매핑을 못 하면 조용히
 * 넘어가는 대신 실패로 남긴다 — 검사하지 못한 SQL 이 검사에 통과한 것으로
 * 보이면 이 스크립트가 있는 의미가 없다.
 */
function referencesFromRuntimeSql(source, fileName) {
  const aliases = new Map();
  for (const from of source.matchAll(
    /(?:FROM|JOIN)\s+([a-z_]+)\s+([a-z])\b/gi,
  )) {
    aliases.set(from[2].toLowerCase(), from[1].toLowerCase());
  }

  const references = [];
  for (const ref of source.matchAll(/\b([a-z])\.([a-z_]{2,})\b/g)) {
    const [, alias, column] = ref;
    const table = aliases.get(alias);
    if (table) references.push({ table, column, fileName });
  }

  // INSERT INTO t (a, b, c) 의 컬럼 목록.
  for (const insert of source.matchAll(
    /INSERT INTO\s+([a-z_]+)\s*\(([\s\S]*?)\)\s*VALUES/gi,
  )) {
    const table = insert[1];
    for (const column of insert[2].split(",")) {
      const name = column.trim().replace(/`/g, "");
      if (/^[a-z_]+$/.test(name)) references.push({ table, column: name, fileName });
    }
  }

  // UPDATE t SET a = ?, b = ?
  for (const update of source.matchAll(
    /UPDATE\s+([a-z_]+)\s+SET\s+([\s\S]*?)(?:WHERE|$)/gi,
  )) {
    const table = update[1];
    for (const assignment of update[2].matchAll(/([a-z_]{2,})\s*=/g)) {
      references.push({ table, column: assignment[1], fileName });
    }
  }

  return references;
}

const schemaSource = await read("db/schema.ts");
const drizzleDir = resolve(root, "drizzle");

let migrationFiles = [];
try {
  const names = (await readdir(drizzleDir))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  migrationFiles = await Promise.all(
    names.map(async (name) => ({
      name,
      sql: await readFile(resolve(drizzleDir, name), "utf8"),
    })),
  );
} catch (error) {
  fail(`drizzle/ 를 읽을 수 없습니다 (${error.code ?? error.name}).`);
}

if (migrationFiles.length === 0) {
  fail("drizzle/ 에 마이그레이션이 없습니다. 비교할 대상이 없으면 실패입니다.");
}

const runtimeSqlFiles = ["app/lib/price-store.ts", "app/lib/kakao-import.ts"];
const runtimeSources = await Promise.all(
  runtimeSqlFiles.map(async (name) => ({ name, source: await read(name) })),
);

if (schemaSource && migrationFiles.length > 0) {
  const declared = columnsFromDrizzle(schemaSource);
  const applied = columnsFromMigrations(migrationFiles);

  if (declared.size === 0) {
    fail("db/schema.ts 에서 테이블을 하나도 읽지 못했습니다.");
  }

  for (const [table, columns] of declared) {
    const appliedColumns = applied.get(table);
    if (!appliedColumns) {
      fail(`테이블 ${table} 이 db/schema.ts 에만 있고 마이그레이션에 없습니다.`);
      continue;
    }
    for (const column of columns) {
      if (!appliedColumns.has(column)) {
        fail(
          `${table}.${column} 이 db/schema.ts 에만 있고 마이그레이션에 없습니다. ` +
            `타입은 통과하지만 실제 DB 에는 그 컬럼이 없습니다.`,
        );
      }
    }
    for (const column of appliedColumns) {
      if (!columns.has(column)) {
        fail(
          `${table}.${column} 이 마이그레이션에만 있고 db/schema.ts 에 없습니다.`,
        );
      }
    }
  }

  for (const table of applied.keys()) {
    if (!declared.has(table)) {
      fail(`테이블 ${table} 이 마이그레이션에만 있고 db/schema.ts 에 없습니다.`);
    }
  }

  // 런타임 SQL 이 실제로 존재하는 컬럼만 읽는지 확인한다.
  for (const { name, source } of runtimeSources) {
    if (!source) continue;
    for (const { table, column } of referencesFromRuntimeSql(source, name)) {
      const appliedColumns = applied.get(table);
      if (!appliedColumns) {
        fail(`${name}: SQL 이 존재하지 않는 테이블 ${table} 을 참조합니다.`);
        continue;
      }
      if (!appliedColumns.has(column)) {
        fail(
          `${name}: SQL 이 존재하지 않는 컬럼 ${table}.${column} 을 참조합니다. ` +
            `이런 문장은 배포 후 첫 요청에서야 터집니다.`,
        );
      }
    }
  }
}

if (failures.length > 0) {
  console.error("DB 스키마 drift 검사 실패:");
  for (const message of [...new Set(failures)]) console.error(`  - ${message}`);
  process.exit(1);
}

console.log("DB 스키마 drift 검사 통과.");
