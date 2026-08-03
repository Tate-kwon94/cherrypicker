import assert from "node:assert/strict";
import test from "node:test";
import {
  selectPreferredDomesticOffer,
  verdictFor,
  DOMESTIC_PREFERENCE_MAX_GAP,
} from "../app/lib/pricing.ts";

const isCoupang = (offer) => offer.source === "쿠팡";

function retail(overrides) {
  return {
    channel: "retail",
    source: "기타몰",
    total: 50_000,
    unitPrice: 1_000,
    volume: 50,
    ...overrides,
  };
}

test("임계값은 양쪽에 대칭으로 적용된다", () => {
  // 예전에는 면세 쪽만 임계값을 두고 국내 쪽은 0원만 넘으면 우위로 봤다.
  // 그래서 -10,000 ~ 0원 구간에서 같은 화면의 두 문구가 서로 달랐다.
  assert.equal(verdictFor(-5_000, 10_000), "tie");
  assert.equal(verdictFor(5_000, 10_000), "tie");
  assert.equal(verdictFor(-15_000, 10_000), "retail");
  assert.equal(verdictFor(15_000, 10_000), "duty");
});

test("정확히 임계값이면 동률이다", () => {
  assert.equal(verdictFor(10_000, 10_000), "tie");
  assert.equal(verdictFor(-10_000, 10_000), "tie");
  assert.equal(verdictFor(10_001, 10_000), "duty");
  assert.equal(verdictFor(-10_001, 10_000), "retail");
});

test("계산할 수 없는 값은 결론을 만들지 않는다", () => {
  assert.equal(verdictFor(Number.NaN, 3_000), "tie");
  assert.equal(verdictFor(Number.POSITIVE_INFINITY, 3_000), "tie");
});

test("선호 판매처가 없으면 단위가격 최저를 고른다", () => {
  const chosen = selectPreferredDomesticOffer(
    [retail({ source: "A", unitPrice: 1_200 }), retail({ source: "B", unitPrice: 900 })],
    isCoupang,
  );
  assert.equal(chosen.source, "B");
});

test("허용오차는 실제로 사게 될 구성의 용량으로 잰다", () => {
  // 예전에는 지는 쪽 용량으로 계산했다. 선호 판매처가 더 큰 용량을 팔면
  // 화면에 뜨는 금액이 의도한 3,000원 갭보다 몇 배 커질 수 있었다.
  const lowest = retail({ source: "최저몰", unitPrice: 1_000, volume: 50 });
  const bigPack = retail({
    source: "쿠팡",
    unitPrice: 1_010, // 단위가 차이는 10원
    volume: 1_000, // 그러나 실제로는 10,000원을 더 낸다
    total: 1_010_000,
  });

  // 지는 쪽 용량(50ml)으로 재면 500원이라 통과해버린다.
  assert.ok((1_010 - 1_000) * lowest.volume <= DOMESTIC_PREFERENCE_MAX_GAP);
  // 사게 될 구성(1,000ml)으로 재면 10,000원이라 통과하면 안 된다.
  assert.equal(
    selectPreferredDomesticOffer([lowest, bigPack], isCoupang).source,
    "최저몰",
  );
});

test("실제 차이가 작으면 선호 판매처를 쓴다", () => {
  const lowest = retail({ source: "최저몰", unitPrice: 1_000, volume: 50 });
  const coupang = retail({
    source: "쿠팡",
    unitPrice: 1_020,
    volume: 50, // 실제 추가 부담 1,000원
    total: 51_000,
  });

  assert.equal(
    selectPreferredDomesticOffer([lowest, coupang], isCoupang).source,
    "쿠팡",
  );
});

test("비율 기준을 넘으면 금액이 작아도 선호하지 않는다", () => {
  // 두 기준 중 더 엄격한 쪽이 이긴다.
  const lowest = retail({ source: "최저몰", unitPrice: 100, volume: 10 });
  const coupang = retail({
    source: "쿠팡",
    unitPrice: 200, // 100% 비쌈
    volume: 10, // 절대 금액은 1,000원뿐
    total: 2_000,
  });

  assert.equal(
    selectPreferredDomesticOffer([lowest, coupang], isCoupang).source,
    "최저몰",
  );
});

test("국내 제안이 없으면 아무것도 고르지 않는다", () => {
  assert.equal(
    selectPreferredDomesticOffer(
      [{ channel: "duty", source: "면세", total: 1, unitPrice: 1, volume: 1 }],
      isCoupang,
    ),
    undefined,
  );
  assert.equal(selectPreferredDomesticOffer([], isCoupang), undefined);
});
