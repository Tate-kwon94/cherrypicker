import assert from "node:assert/strict";
import test from "node:test";
import { parseProxyTrust } from "../app/lib/proxy-trust.ts";

test("헤더 신뢰는 정확히 \"true\"일 때만 선다", () => {
  // Sites 프록시 밖에서 oai-* 사용자 헤더를 믿으면 아무나 관리자다.
  // getChatGPTUser 는 이 판정이 서기 전에는 헤더를 읽지도 않는다 —
  // Cloudflare 직접 서빙에서는 값을 두지 않으므로 관리자 로그인 자체가
  // 닫혀 있고, 별도 인증(Cloudflare Access 등)이 붙을 때 열린다.
  assert.equal(parseProxyTrust("true"), true);
  for (const value of ["TRUE", "True", "1", "yes", "", undefined, null, true]) {
    assert.equal(parseProxyTrust(value), false, `${String(value)} 는 불신`);
  }
});
