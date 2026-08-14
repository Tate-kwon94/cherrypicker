import assert from "node:assert/strict";
import test from "node:test";
import {
  cosmeticPartnerUrls,
  isCoupangPartnerUrl,
  resolveCoupangLink,
  travelPartnerUrls,
  COUPANG_PARTNER_LINK_PREFIX,
} from "../app/lib/coupang-links.ts";

test("등록된 간편 링크는 전부 파트너스 링크 형식이다", () => {
  // 쿠팡 페이지 URL 을 그대로 붙여 넣으면 링크는 동작하지만 수익이
  // 집계되지 않는다 — 파트너스 가이드가 명시한 함정이다. 잘못 붙여
  // 넣는 순간 여기서 실패해야 운영 중에 조용히 새지 않는다.
  for (const [key, url] of [
    ...Object.entries(cosmeticPartnerUrls),
    ...Object.entries(travelPartnerUrls),
  ]) {
    assert.ok(
      url.startsWith(COUPANG_PARTNER_LINK_PREFIX),
      `${key}: 간편 링크가 아닙니다 — ${url}`,
    );
    assert.ok(url.startsWith("https://"), `${key}: https 가 아닙니다`);
  }
});

test("일반 쿠팡 URL은 파트너스 링크로 인정하지 않는다", () => {
  assert.equal(isCoupangPartnerUrl("https://link.coupang.com/a/abc123"), true);
  assert.equal(isCoupangPartnerUrl("https://www.coupang.com/vp/products/1"), false);
  assert.equal(isCoupangPartnerUrl("http://link.coupang.com/a/abc123"), false);
});

test("플래그가 꺼지면 간편 링크가 등록돼 있어도 중립 링크로 돌아간다", () => {
  // 수익화를 끈다는 것은 링크의 수익 귀속도 끊긴다는 뜻이어야 한다.
  const link = resolveCoupangLink({
    partnerUrl: "https://link.coupang.com/a/abc123",
    fallbackUrl: "https://www.coupang.com/np/search?q=x",
    partnersActive: false,
  });
  assert.equal(link.href, "https://www.coupang.com/np/search?q=x");
  assert.equal(link.sponsored, false);
});

test("sponsored는 실제로 파트너스 링크를 쓸 때만 붙는다", () => {
  // 중립 검색 링크에는 수익 귀속이 없다. 플래그만 보고 sponsored 를
  // 붙이면 광고가 아닌 링크에 광고 표기가 붙는다.
  const neutral = resolveCoupangLink({
    partnerUrl: undefined,
    fallbackUrl: "https://www.coupang.com/np/search?q=x",
    partnersActive: true,
  });
  assert.equal(neutral.sponsored, false);

  const partner = resolveCoupangLink({
    partnerUrl: "https://link.coupang.com/a/abc123",
    fallbackUrl: "https://www.coupang.com/np/search?q=x",
    partnersActive: true,
  });
  assert.equal(partner.href, "https://link.coupang.com/a/abc123");
  assert.equal(partner.sponsored, true);
});

test("형식이 틀린 등록값은 파트너스 링크로 쓰지 않는다", () => {
  // 잘못 붙여 넣은 값이 그대로 나가느니 중립 링크가 낫다.
  const link = resolveCoupangLink({
    partnerUrl: "https://www.coupang.com/vp/products/1",
    fallbackUrl: "https://www.coupang.com/np/search?q=x",
    partnersActive: true,
  });
  assert.equal(link.href, "https://www.coupang.com/np/search?q=x");
  assert.equal(link.sponsored, false);
});

// --- 동기화 스크립트의 순수 부분 ---
import {
  buildAuthorization,
  rewriteGeneratedBlock,
  TARGETS,
} from "../build/sync-coupang-links.mjs";

test("GENERATED 블록만 다시 쓰고 마커 밖은 건드리지 않는다", () => {
  const source = [
    "const table = {",
    "  // 사람이 쓴 주석",
    "  // BEGIN GENERATED cosmetics — 설명",
    "  old: \"https://link.coupang.com/a/old\",",
    "  // END GENERATED cosmetics",
    "  manual: \"https://link.coupang.com/a/manual\",",
    "};",
  ].join("\n");

  const next = rewriteGeneratedBlock(source, "cosmetics", {
    anr: "https://link.coupang.com/a/new1",
    "한글 키": "https://link.coupang.com/a/new2",
  });

  assert.match(next, /anr: "https:\/\/link\.coupang\.com\/a\/new1"/);
  assert.match(next, /"한글 키": "https:\/\/link\.coupang\.com\/a\/new2"/);
  // 이전 생성분은 사라지고, 손으로 쓴 항목과 주석은 남는다.
  assert.doesNotMatch(next, /a\/old/);
  assert.match(next, /manual/);
  assert.match(next, /사람이 쓴 주석/);
});

test("마커가 없으면 조용히 넘어가지 않고 실패한다", () => {
  assert.throws(
    () => rewriteGeneratedBlock("const table = {};", "cosmetics", {}),
    /마커를 찾지 못했습니다/,
  );
});

test("변환 대상 키는 화면 카탈로그·테이블과 같은 네임스페이스다", () => {
  // 스크립트가 쓰는 키와 렌더가 읽는 키가 어긋나면, 변환은 성공했는데
  // 화면에는 아무것도 반영되지 않는다.
  for (const key of Object.keys(TARGETS.cosmetics)) {
    assert.match(key, /^[a-z][\w-]*$/i, `화장품 키 형식: ${key}`);
  }
  for (const url of [
    ...Object.values(TARGETS.cosmetics),
    ...Object.values(TARGETS.travel),
  ]) {
    assert.match(url, /^https:\/\/www\.coupang\.com\//);
  }
});

test("서명은 결정적이고 헤더에 넣을 수 있는 형태다", () => {
  const auth = buildAuthorization({
    method: "POST",
    path: "/v2/providers/affiliate_open_api/apis/openapi/v1/deeplink",
    accessKey: "AK",
    secretKey: "SK",
    now: new Date(Date.UTC(2026, 7, 11, 12, 0, 0)),
  });
  assert.match(
    auth,
    /^CEA algorithm=HmacSHA256, access-key=AK, signed-date=260811T120000Z, signature=[0-9a-f]{64}$/,
  );
});
