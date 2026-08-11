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
 * 이 검사에서 가장 나쁜 실패는 **거짓 통과**다. 통과가 "세 곳이 일치한다"로
 * 읽히기 때문이다. 그래서:
 *   - SQL 은 문자열 리터럴 안에서만 찾는다. 파일 전체를 훑으면 평범한
 *     TypeScript 속성 접근이 컬럼 참조로 잡혀 엉뚱한 곳에서 빌드가 깨진다.
 *   - 별칭은 문장 단위로 푼다. 파일 전역 별칭표는 다른 문장의 별칭을
 *     끌어다 쓴다.
 *   - 해석하지 못한 마이그레이션 문법은 넘어가지 않고 실패한다. 모르는
 *     문장을 무시하면 컬럼 집합이 실제 DB 와 조용히 달라진다.
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

/** 식별자 문자. 숫자를 빼면 `encrypted_url_2` 같은 컬럼이 통째로 안 보인다. */
const IDENT = "[a-z_][a-z0-9_]*";

/** `sqliteTable("name", {...})` 블록에서 테이블별 실제 컬럼명을 뽑는다. */
function columnsFromDrizzle(source) {
  const tables = new Map();
  const tablePattern = new RegExp(`sqliteTable\\(\\s*"(${IDENT})"\\s*,\\s*\\{`, "g");

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
    for (const col of block.matchAll(
      new RegExp(`\\b(?:text|integer|real)\\(\\s*"(${IDENT})"`, "g"),
    )) {
      columns.add(col[1]);
    }
    tables.set(tableName, columns);
  }

  return tables;
}

/**
 * 마이그레이션을 순서대로 적용해 테이블별 컬럼 집합을 만든다.
 *
 * 인식하는 문장만 적용하고, **인식하지 못한 문장은 실패로 남긴다**. 예전에는
 * `ALTER TABLE ... DROP COLUMN` 을 조용히 무시해서 재구성된 컬럼 집합이 실제
 * DB 의 상위집합이 됐다 — 거짓 통과가 나오는 유일한 방향이다.
 */
function columnsFromMigrations(files) {
  const tables = new Map();

  for (const { name, sql } of files) {
    // 주석을 걷어내고 문장 단위로 자른다.
    const stripped = sql
      .replace(/^\s*--.*$/gm, "")
      .replace(/-->\s*statement-breakpoint/g, ";");

    for (const raw of stripped.split(";")) {
      const statement = raw.trim();
      if (!statement) continue;

      const create = statement.match(
        new RegExp(
          `^CREATE TABLE(?:\\s+IF NOT EXISTS)?\\s+\`?(${IDENT})\`?\\s*\\(([\\s\\S]*)\\)\\s*$`,
          "i",
        ),
      );
      if (create) {
        const table = create[1];
        const columns = new Set();
        for (const line of create[2].split("\n")) {
          const column = line.trim().match(new RegExp("^`(" + IDENT + ")`"));
          if (column) columns.add(column[1]);
        }
        if (tables.has(table)) {
          fail(`${name}: 테이블 ${table} 을 두 번 CREATE 합니다.`);
        }
        tables.set(table, columns);
        continue;
      }

      const add = statement.match(
        new RegExp(
          `^ALTER TABLE\\s+\`?(${IDENT})\`?\\s+ADD\\s+(?:COLUMN\\s+)?\`?(${IDENT})\`?`,
          "i",
        ),
      );
      if (add) {
        const [, table, column] = add;
        const existing = tables.get(table);
        if (!existing) {
          fail(`${name}: 만들어진 적 없는 테이블 ${table} 에 컬럼을 추가합니다.`);
          continue;
        }
        if (existing.has(column)) {
          fail(`${name}: ${table}.${column} 을 두 번 추가합니다.`);
        }
        existing.add(column);
        continue;
      }

      const drop = statement.match(
        new RegExp(
          `^ALTER TABLE\\s+\`?(${IDENT})\`?\\s+DROP\\s+(?:COLUMN\\s+)?\`?(${IDENT})\`?`,
          "i",
        ),
      );
      if (drop) {
        const [, table, column] = drop;
        const existing = tables.get(table);
        if (!existing) {
          fail(`${name}: 만들어진 적 없는 테이블 ${table} 에서 컬럼을 지웁니다.`);
          continue;
        }
        if (!existing.delete(column)) {
          fail(`${name}: 존재하지 않는 컬럼 ${table}.${column} 을 지웁니다.`);
        }
        continue;
      }

      const dropTable = statement.match(
        new RegExp(`^DROP TABLE(?:\\s+IF EXISTS)?\\s+\`?(${IDENT})\`?`, "i"),
      );
      if (dropTable) {
        tables.delete(dropTable[1]);
        continue;
      }

      // 컬럼 집합에 영향이 없는 문장들.
      if (/^(CREATE (UNIQUE )?INDEX|DROP INDEX|PRAGMA|INSERT|UPDATE|DELETE)\b/i.test(statement)) {
        continue;
      }

      // 해석하지 못한 문장은 넘어가지 않는다. 무시하면 재구성한 컬럼 집합이
      // 실제 DB 와 조용히 달라지고, 이 검사의 통과가 거짓말이 된다.
      fail(
        `${name}: 해석하지 못한 마이그레이션 문장이 있습니다 — ` +
          `"${statement.slice(0, 70).replace(/\s+/g, " ")}…". ` +
          `이 검사가 반영할 수 있도록 문법을 추가하거나 문장을 나눠 주세요.`,
      );
    }
  }

  return tables;
}

/**
 * 소스에서 SQL 문자열 리터럴만 뽑는다.
 *
 * 파일 전체를 훑으면 평범한 TypeScript(`offers.filter((o) => o.reference)`)가
 * `o.reference` 컬럼 참조로 잡혀, DB 를 건드리지도 않은 변경에서 빌드가
 * SQL 얘기를 하며 깨진다.
 */
function sqlLiterals(source) {
  // `const offerSelect = \`SELECT ... FROM price_offers o ...\`` 처럼 다른
  // 리터럴에 이름으로 끼워 넣는 조각을 먼저 모은다.
  const fragments = new Map();
  for (const declaration of source.matchAll(
    new RegExp("\\b(?:const|let)\\s+(\\w+)\\s*=\\s*`([^`]*)`", "g"),
  )) {
    fragments.set(declaration[1], declaration[2]);
  }

  const literals = [];
  const pattern = /`([^`]*)`|"((?:[^"\\]|\\.)*)"/g;
  for (const match of source.matchAll(pattern)) {
    const raw = match[1] ?? match[2] ?? "";

    // 보간을 먼저 푼다. 풀지 않으면 `${offerSelect} WHERE o.id = ?` 같은
    // 조각에 SELECT 가 없어 SQL 로 인식되지 않고, 그 문장의 WHERE·ORDER BY
    // 컬럼이 통째로 검사에서 빠진다. 별칭 선언도 그 조각 안에 있으므로
    // 풀지 않으면 `o.id` 를 어느 테이블로 볼지도 알 수 없다.
    const text = raw.replace(
      /\$\{(\w+)\}/g,
      (whole, name) => fragments.get(name) ?? whole,
    );

    if (/\b(SELECT|INSERT INTO|UPDATE|DELETE FROM)\b/i.test(text)) {
      literals.push(text);
    }
  }
  return literals;
}

const SQL_KEYWORDS = new Set([
  "select", "from", "where", "and", "or", "not", "null", "is", "in", "as",
  "insert", "into", "values", "update", "set", "delete", "join", "inner",
  "left", "outer", "on", "order", "by", "asc", "desc", "limit", "offset",
  "group", "having", "count", "sum", "min", "max", "avg", "distinct",
  "case", "when", "then", "else", "end", "exists", "between", "like",
]);

/**
 * 손으로 쓴 SQL 이 참조하는 컬럼을 문장 단위로 모은다.
 *
 * 별칭표는 문장마다 새로 만든다. 파일 전역으로 두면 한 문장의 별칭이 다른
 * 문장에서 되살아난다. 별칭이 없는 단일 테이블 문장은 맨 이름으로 푼다 —
 * 예전에는 그런 문장이 통째로 검사에서 빠져, kakao_cart_imports 의 컬럼
 * 대부분이 사실상 확인되지 않았다.
 */
function referencesFromRuntimeSql(source) {
  const references = [];

  for (const raw of sqlLiterals(source)) {
    // SQL 안의 작은따옴표 문자열은 값이지 컬럼이 아니다. 걷어내지 않으면
    // `status` 기본값 `'draft'` 가 컬럼 참조로 잡힌다.
    const sql = raw.replace(/'[^']*'/g, "''");

    // 하위 질의를 별도 문장으로 다루지 않는다 — 같은 테이블 집합을 쓴다.
    const aliases = new Map();
    const tablesInStatement = new Set();

    for (const from of sql.matchAll(
      new RegExp(`(?:FROM|JOIN|INTO|UPDATE)\\s+(${IDENT})(?:\\s+(${IDENT}))?`, "gi"),
    )) {
      const table = from[1].toLowerCase();
      const alias = from[2]?.toLowerCase();
      tablesInStatement.add(table);
      if (alias && !SQL_KEYWORDS.has(alias)) aliases.set(alias, table);
    }

    // 1) 별칭이 붙은 참조.
    for (const ref of sql.matchAll(
      new RegExp(`\\b(${IDENT})\\.(${IDENT})\\b`, "g"),
    )) {
      const table = aliases.get(ref[1].toLowerCase());
      if (table) references.push({ table, column: ref[2] });
    }

    // 2) INSERT 컬럼 목록. VALUES 형과 INSERT ... SELECT 형을 모두 받는다.
    for (const insert of sql.matchAll(
      new RegExp(
        `INSERT INTO\\s+(${IDENT})\\s*\\(([\\s\\S]*?)\\)\\s*(?:VALUES|SELECT)`,
        "gi",
      ),
    )) {
      const table = insert[1].toLowerCase();
      for (const column of insert[2].split(",")) {
        const name = column.trim().replace(/`/g, "");
        if (new RegExp(`^${IDENT}$`).test(name)) references.push({ table, column: name });
      }
    }

    // 3) UPDATE ... SET 대상.
    for (const update of sql.matchAll(
      new RegExp(`UPDATE\\s+(${IDENT})[\\s\\S]*?\\bSET\\b([\\s\\S]*?)(?:\\bWHERE\\b|$)`, "gi"),
    )) {
      const table = update[1].toLowerCase();
      for (const assignment of update[2].matchAll(
        new RegExp(`(${IDENT})\\s*=`, "g"),
      )) {
        references.push({ table, column: assignment[1] });
      }
    }

    // 4) 테이블이 하나뿐이고 별칭이 없으면 맨 식별자를 그 테이블로 푼다.
    if (tablesInStatement.size === 1 && aliases.size === 0) {
      const [table] = tablesInStatement;
      // 테이블 이름 자체와 SQL 키워드는 제외한다.
      for (const bare of sql.matchAll(new RegExp(`\\b(${IDENT})\\b`, "g"))) {
        const name = bare[1].toLowerCase();
        if (SQL_KEYWORDS.has(name)) continue;
        if (tablesInStatement.has(name)) continue;
        references.push({ table, column: name });
      }
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

/**
 * `_journal.json` 과 실제 `.sql` 파일이 같은 집합인지 본다.
 *
 * 마이그레이터가 무엇을 적용할지 정하는 것은 journal 이다. `.sql` 파일만
 * 추가하면 그 마이그레이션은 **영원히 실행되지 않고**, 컬럼은 없는데
 * 코드와 스키마와 이 검사는 모두 있다고 말한다. 실제로 그렇게 됐다 —
 * 통화 컬럼 마이그레이션이 journal 에 없는 채로 배포 패키지에 들어갔다.
 */
try {
  const journal = JSON.parse(
    await readFile(resolve(drizzleDir, "meta/_journal.json"), "utf8"),
  );
  const journalTags = (journal.entries ?? []).map((entry) => entry.tag);
  const fileTags = migrationFiles.map(({ name }) => name.replace(/\.sql$/, ""));

  for (const tag of fileTags) {
    if (!journalTags.includes(tag)) {
      fail(
        `${tag}.sql 이 _journal.json 에 없습니다. 마이그레이터는 journal 을 ` +
          `보고 적용하므로, 이 마이그레이션은 배포해도 실행되지 않습니다.`,
      );
    }
  }
  for (const tag of journalTags) {
    if (!fileTags.includes(tag)) {
      fail(`_journal.json 의 ${tag} 에 해당하는 .sql 파일이 없습니다.`);
    }
  }
  if (JSON.stringify(journalTags) !== JSON.stringify([...journalTags].sort())) {
    fail("_journal.json 항목이 파일 이름 순서와 다릅니다. 적용 순서가 어긋납니다.");
  }
} catch (error) {
  if (error instanceof SyntaxError) {
    fail(`drizzle/meta/_journal.json 을 파싱할 수 없습니다: ${error.message}`);
  } else {
    fail(
      `drizzle/meta/_journal.json 을 읽을 수 없습니다 (${error.code ?? error.name}). ` +
        `마이그레이터가 이 파일을 보고 적용하므로 없으면 실패입니다.`,
    );
  }
}

/**
 * SQL 을 담은 파일을 직접 찾는다.
 *
 * 목록을 손으로 적어 두면, SQL 을 쓰는 모듈이 새로 생겨도 검사에서 조용히
 * 빠진다. 빠진 파일은 실패가 아니라 통과로 보이므로 알아챌 방법이 없다.
 */
async function findRuntimeSqlFiles() {
  const found = [];
  const stack = ["app", "worker", "db"];
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = await readdir(resolve(root, dir), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) stack.push(path);
      else if (/\.(ts|tsx)$/.test(entry.name)) {
        const source = await readFile(resolve(root, path), "utf8");
        if (/\.prepare\(/.test(source)) found.push(path);
      }
    }
  }
  return found.sort();
}

const runtimeSqlFiles = await findRuntimeSqlFiles();
if (runtimeSqlFiles.length === 0) {
  fail(
    "SQL 을 담은 파일을 하나도 찾지 못했습니다. 탐색이 깨졌다면 통과가 " +
      "아니라 실패입니다 — 검사할 대상이 없는 것과 못 찾은 것은 다릅니다.",
  );
}
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
    for (const { table, column } of referencesFromRuntimeSql(source)) {
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
