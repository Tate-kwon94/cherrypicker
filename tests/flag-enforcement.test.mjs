import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { RUNTIME_FLAG_NAMES } from "../app/lib/runtime-flags.ts";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(repoRoot, path), "utf8");

/**
 * 플래그마다 그것이 실제로 막는 지점.
 *
 * 이 표가 있는 이유: 네 개 플래그가 이름 목록에만 있고 아무 코드도 읽지
 * 않는 상태로 배포 직전까지 갔다. 문서에는 fail-closed 라고 적혀 있었고,
 * 타입 검사도 테스트도 통과했다. 스위치가 무엇에 연결됐는지는 스위치를
 * 봐서는 알 수 없으므로, 연결된 쪽을 검사한다.
 */
const enforcement = {
  MONETIZATION_ENABLED: [
    ["app/layout.tsx", /flags\.MONETIZATION_ENABLED/],
    ["worker/security-headers.ts", /monetizationEnabled/],
  ],
  KAKAO_IMPORT_ENABLED: [
    ["app/api/kakao/skill/route.ts", /isFeatureEnabled\("KAKAO_IMPORT_ENABLED"\)/],
    ["app/api/kakao/import/route.ts", /isFeatureEnabled\("KAKAO_IMPORT_ENABLED"\)/],
  ],
  ALCOHOL_COMMERCE_ENABLED: [
    ["app/page-client.tsx", /flags\.ALCOHOL_COMMERCE_ENABLED/],
  ],
  AUTO_CONFIRM_ENABLED: [["app/page-client.tsx", /flags\.AUTO_CONFIRM_ENABLED/]],
  ADMIN_UI_ENABLED: [
    ["app/admin/page.tsx", /isFeatureEnabled\("ADMIN_UI_ENABLED"\)/],
    ["app/api/admin/offers/route.ts", /isFeatureEnabled\("ADMIN_UI_ENABLED"\)/],
  ],
};

test("모든 플래그는 실제로 무언가를 막는다", () => {
  for (const name of RUNTIME_FLAG_NAMES) {
    const sites = enforcement[name];
    assert.ok(
      sites && sites.length > 0,
      `${name} 에 적용 지점이 없습니다. 끌 대상이 없는 스위치는 운영자에게 ` +
        `끌 수 있다고 말하면서 아무것도 하지 않습니다.`,
    );
    for (const [path, pattern] of sites) {
      assert.match(read(path), pattern, `${name} 이 ${path} 에서 적용되지 않습니다`);
    }
  }
});

test("표에 있는 플래그는 전부 정식 플래그다", () => {
  // 없어진 플래그의 적용 지점이 남아 있으면, 표가 사실이 아니게 된다.
  for (const name of Object.keys(enforcement)) {
    assert.ok(
      RUNTIME_FLAG_NAMES.includes(name),
      `${name} 은 정식 플래그가 아닙니다`,
    );
  }
});

test("끌 대상이 없는 플래그는 두지 않는다", () => {
  // TELEMETRY_ENABLED 를 없앤 이유. 이 저장소에는 텔레메트리 코드가 없다.
  assert.equal(RUNTIME_FLAG_NAMES.includes("TELEMETRY_ENABLED"), false);
});

test("보안 경로는 인증보다 플래그를 먼저 본다", () => {
  // 인증이 먼저 돌면 로그인·권한 상태가 응답 차이로 새어, 꺼둔 기능의
  // 존재가 드러난다.
  // import 줄이 아니라 **호출** 위치를 비교한다.
  const ordered = [
    ["app/admin/page.tsx", 'isFeatureEnabled("ADMIN_UI_ENABLED")', "await requireAdminUser()"],
    ["app/api/admin/offers/route.ts", 'isFeatureEnabled("ADMIN_UI_ENABLED")', "await getAuthorizedAdmin()"],
    ["app/api/kakao/skill/route.ts", 'isFeatureEnabled("KAKAO_IMPORT_ENABLED")', "await verifyKakaoSkillRequest("],
  ];

  for (const [path, gate, auth] of ordered) {
    const source = read(path);
    const gateAt = source.indexOf(gate);
    const authAt = source.indexOf(auth);
    assert.notEqual(gateAt, -1, `${path} 에 플래그 검사가 없습니다`);
    assert.notEqual(authAt, -1, `${path} 에서 ${auth} 를 찾지 못했습니다`);
    assert.ok(gateAt < authAt, `${path} 가 인증을 플래그보다 먼저 실행합니다`);
  }
});
