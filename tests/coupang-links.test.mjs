import assert from "node:assert/strict";
import test from "node:test";
import {
  cosmeticPartnerUrls,
  isCoupangPartnerUrl,
  resolveCoupangLink,
  sharedCoupangPicks,
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
    ...sharedCoupangPicks.map((pick) => [pick.id, pick.url]),
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
  mergeGeneratedBlock,
  parseGeneratedBlock,
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
  assert.match(next, /manual/);
  assert.match(next, /사람이 쓴 주석/);
});

test("동기화 병합은 직접 채운 생성 항목을 지우지 않는다", () => {
  // 간편 링크로 채운 cicaplast·hyalu 가 블록 안에 있다. 통째로 교체하는
  // 동기화는 이 링크들을 지우고 수익 귀속을 조용히 끊는다 — main 은
  // rewrite 가 아니라 이 병합 경로만 쓴다.
  const source = [
    "const table = {",
    "  // BEGIN GENERATED cosmetics — 설명",
    "  cicaplast: \"https://link.coupang.com/a/manual1\",",
    "  \"한글 키\": \"https://link.coupang.com/a/manual2\",",
    "  // END GENERATED cosmetics",
    "};",
  ].join("\n");

  assert.deepEqual(parseGeneratedBlock(source, "cosmetics"), {
    cicaplast: "https://link.coupang.com/a/manual1",
    "한글 키": "https://link.coupang.com/a/manual2",
  });

  const next = mergeGeneratedBlock(source, "cosmetics", {
    anr: "https://link.coupang.com/a/api1",
  });
  // 기존 항목은 남고, 변환된 키가 추가된다.
  assert.match(next, /cicaplast: "https:\/\/link\.coupang\.com\/a\/manual1"/);
  assert.match(next, /"한글 키": "https:\/\/link\.coupang\.com\/a\/manual2"/);
  assert.match(next, /anr: "https:\/\/link\.coupang\.com\/a\/api1"/);

  // 같은 키를 TARGETS 로 변환했을 때만 갱신된다.
  const updated = mergeGeneratedBlock(source, "cosmetics", {
    cicaplast: "https://link.coupang.com/a/api2",
  });
  assert.match(updated, /cicaplast: "https:\/\/link\.coupang\.com\/a\/api2"/);
  assert.doesNotMatch(updated, /a\/manual1/);
});

test("블록 안의 해석 불가 줄은 조용히 삭제되지 않고 실패한다", () => {
  // 파싱을 통과 못 한 항목은 다음 병합에서 사라진다 — 링크는 계속 열리고
  // 귀속만 끊기는, 테스트로 못 잡는 손실이므로 읽는 시점에 멈춘다.
  const source = [
    "const table = {",
    "  // BEGIN GENERATED cosmetics",
    "  cicaplast: 'https://link.coupang.com/a/single-quoted',",
    "  // END GENERATED cosmetics",
    "};",
  ].join("\n");

  assert.throws(
    () => parseGeneratedBlock(source, "cosmetics"),
    /해석하지 못했습니다/,
  );
});

test("값에 치환 특수문자가 있어도 파일이 망가지지 않는다", () => {
  // String.replace 의 문자열 템플릿은 "$&" 를 매치 전체로 해석한다 —
  // 함수 치환이어야 결과가 문자 그대로 들어간다.
  const source = [
    "const table = {",
    "  // BEGIN GENERATED cosmetics",
    "  // END GENERATED cosmetics",
    "};",
  ].join("\n");

  const next = rewriteGeneratedBlock(source, "cosmetics", {
    weird: "https://link.coupang.com/a/x$&y$1z",
  });
  assert.match(next, /weird: "https:\/\/link\.coupang\.com\/a\/x\$&y\$1z"/);
  // 블록이 복제되지 않았다.
  assert.equal(next.match(/BEGIN GENERATED cosmetics/g).length, 1);
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

test("공유 픽에는 가격 필드가 존재하지 않는다", () => {
  // 비교 데이터가 없는 상품이다. 가격 필드가 생기는 순간 검수하지 않은
  // 금액이 화면에 실릴 통로가 열린다 — 표현할 수 없게 둔다.
  for (const pick of sharedCoupangPicks) {
    assert.deepEqual(Object.keys(pick).sort(), ["id", "name", "url"]);
  }
});
