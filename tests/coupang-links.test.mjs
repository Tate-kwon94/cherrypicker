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
