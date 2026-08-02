#!/usr/bin/env node
/**
 * 배포 설정 drift 검사.
 *
 * 설정 원본이 둘이다 — 제어면이 소유한 `.openai/hosting.json` 의 binding
 * 이름과, 저장소가 소유한 `wrangler.jsonc` 의 배포 설정. 정적 JSON 은
 * "제어면이 주입한 이름을 따른다" 를 표현할 수 없으므로, 두 파일이
 * 어긋나는 순간을 빌드 전에 잡는다.
 *
 *   빌드 전 (--pre)  : hosting.json ↔ wrangler.jsonc
 *   빌드 후 (--post) : 위 둘 ↔ dist/server/wrangler.json (유효 설정)
 *
 * 자동 수정하지 않는다. 승인된 설정 변경이 두 원본을 먼저 갱신해야 한다.
 * 비교 대상 원본이 없으면 통과가 아니라 실패다.
 */
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import process from "node:process";

const root = process.cwd();
const mode = process.argv.includes("--post") ? "post" : "pre";
const failures = [];

function fail(message) {
  failures.push(message);
}

async function readJson(relativePath, { required = true } = {}) {
  const path = resolve(root, relativePath);
  try {
    const raw = await readFile(path, "utf8");
    // wrangler.jsonc 의 주석을 제거한다. 문자열 안의 // 는 건드리지 않는다.
    const stripped = raw
      .replace(/^\s*\/\/.*$/gm, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    return JSON.parse(stripped);
  } catch (error) {
    if (required) {
      fail(
        `${relativePath} 를 읽을 수 없습니다 (${error.code ?? error.name}). ` +
          `비교 대상 원본이 없으면 통과가 아니라 실패입니다.`,
      );
    }
    return null;
  }
}

function bindingNames(list) {
  return (Array.isArray(list) ? list : []).map((entry) => entry?.binding);
}

const hosting = await readJson(".openai/hosting.json");
const declared = await readJson("wrangler.jsonc");

if (hosting && declared) {
  // D1
  const hostingD1 = hosting.d1 ? [hosting.d1] : [];
  const declaredD1 = bindingNames(declared.d1_databases);
  if (JSON.stringify(hostingD1) !== JSON.stringify(declaredD1)) {
    fail(
      `D1 binding 불일치: hosting.json=${JSON.stringify(hostingD1)} ` +
        `wrangler.jsonc=${JSON.stringify(declaredD1)}`,
    );
  }

  // R2
  const hostingR2 = hosting.r2 ? [hosting.r2] : [];
  const declaredR2 = bindingNames(declared.r2_buckets);
  if (JSON.stringify(hostingR2) !== JSON.stringify(declaredR2)) {
    fail(
      `R2 binding 불일치: hosting.json=${JSON.stringify(hostingR2)} ` +
        `wrangler.jsonc=${JSON.stringify(declaredR2)}`,
    );
  }
}

if (mode === "post") {
  const effective = await readJson("dist/server/wrangler.json");

  if (effective && declared) {
    for (const field of ["name", "compatibility_date", "compatibility_flags"]) {
      const a = JSON.stringify(declared[field]);
      const b = JSON.stringify(effective[field]);
      if (a !== b) {
        fail(`${field} 가 선언과 다릅니다: 선언=${a} 유효=${b}`);
      }
    }

    const declaredBindings = bindingNames(declared.d1_databases);
    const effectiveBindings = bindingNames(effective.d1_databases);
    if (
      JSON.stringify(declaredBindings) !== JSON.stringify(effectiveBindings)
    ) {
      fail(
        `D1 binding 이 산출물에서 달라졌습니다: ` +
          `선언=${JSON.stringify(declaredBindings)} ` +
          `유효=${JSON.stringify(effectiveBindings)}`,
      );
    }

    if (effective.observability?.enabled !== true) {
      fail("observability 가 산출물에서 꺼졌습니다.");
    }

    // 빌드 머신 경로가 배포 산출물에 남으면 재현성·정보노출 문제다.
    const raw = JSON.stringify(effective);
    const absolute = raw.match(/"(?:\/Users|\/home|[A-Z]:\\\\)[^"]*"/g);
    if (absolute) {
      fail(`산출물에 빌드 머신 절대경로가 남았습니다: ${absolute[0]}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`설정 drift 검사 실패 (${mode}):`);
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}

console.log(`설정 drift 검사 통과 (${mode}).`);
