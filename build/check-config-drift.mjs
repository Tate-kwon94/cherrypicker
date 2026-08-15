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

/**
 * 제어면과 저장소가 함께 아는 바인딩 종류.
 *
 * 목록으로 두는 이유: 예전에는 D1 과 R2 만 손으로 비교했다. `wrangler.jsonc`
 * 에 다른 종류를 추가하면 그 바인딩은 어느 쪽과도 대조되지 않고, 검사는
 * 통과한다 — 검사하지 않은 것과 일치하는 것을 구분할 수 없게 된다.
 */
const BINDING_KINDS = [
  { hosting: "d1", declared: "d1_databases", label: "D1" },
  { hosting: "r2", declared: "r2_buckets", label: "R2" },
  { hosting: "kv", declared: "kv_namespaces", label: "KV" },
  { hosting: "queues", declared: "queues", label: "Queues" },
  { hosting: "ai", declared: "ai", label: "AI" },
  { hosting: "vectorize", declared: "vectorize", label: "Vectorize" },
];

if (hosting && declared) {
  for (const { hosting: hostingKey, declared: declaredKey, label } of BINDING_KINDS) {
    const fromHosting = hosting[hostingKey] ? [hosting[hostingKey]] : [];
    const fromDeclared = bindingNames(declared[declaredKey]);
    if (JSON.stringify(fromHosting) !== JSON.stringify(fromDeclared)) {
      fail(
        `${label} binding 불일치: hosting.json=${JSON.stringify(fromHosting)} ` +
          `wrangler.jsonc=${JSON.stringify(fromDeclared)}`,
      );
    }
  }

  // 목록에 없는 바인딩 종류가 선언되면, 대조 없이 지나가는 것이 아니라
  // 검사를 확장하라고 말한다.
  const known = new Set(BINDING_KINDS.map(({ declared: key }) => key));
  for (const key of Object.keys(declared)) {
    if (!/_?(databases|buckets|namespaces|queues|vectorize)$|^ai$/.test(key)) continue;
    if (!known.has(key)) {
      fail(
        `wrangler.jsonc 의 ${key} 는 이 검사가 모르는 바인딩 종류입니다. ` +
          `BINDING_KINDS 에 추가해 주세요 — 모르는 채로 통과시키면 ` +
          `"일치한다" 와 "확인하지 않았다" 를 구분할 수 없습니다.`,
      );
    }
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

    // 빌드 전에 확인한 종류를 산출물에서도 전부 다시 본다. 한 종류만
    // 재확인하면 나머지 종류의 보증이 빌드 경계에서 사라진다.
    for (const { declared: key, label } of BINDING_KINDS) {
      const declaredBindings = bindingNames(declared[key]);
      const effectiveBindings = bindingNames(effective[key]);
      if (
        JSON.stringify(declaredBindings) !== JSON.stringify(effectiveBindings)
      ) {
        fail(
          `${label} binding 이 산출물에서 달라졌습니다: ` +
            `선언=${JSON.stringify(declaredBindings)} ` +
            `유효=${JSON.stringify(effectiveBindings)}`,
        );
      }
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
