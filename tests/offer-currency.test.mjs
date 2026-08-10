import assert from "node:assert/strict";
import test from "node:test";
import {
  OfferValidationError,
  parseOfferDraft,
} from "../app/lib/offer-input.ts";
import {
  buildVerifiedComparison,
  checkComparablePair,
} from "../app/lib/pricing.ts";

const now = 1_700_000_000_000;

function draft(overrides = {}) {
  return {
    productId: "anr",
    brand: "에스티 로더",
    productName: "어드밴스드 나이트 리페어",
    category: "cosmetics",
    sourceName: "쿠팡",
    sourceUrl: "https://example.com/anr",
    channel: "retail",
    listPrice: 92_000,
    shipping: 0,
    instantDiscount: 0,
    volume: 50,
    unit: "ml",
    observedAt: now,
    expiresAt: now + 24 * 60 * 60 * 1000,
    evidenceType: "official_listing",
    storeLocation: "",
    abv: null,
    barcode: "",
    notes: "",
    ...overrides,
  };
}

test("통화를 적지 않으면 KRW로 저장한다", () => {
  // 기존 행 backfill 이 KRW 이므로 이 기본값은 추측이 아니라 사실이다.
  assert.equal(parseOfferDraft(draft(), now).currency, "KRW");
});

test("명시한 KRW는 그대로 통과한다", () => {
  assert.equal(parseOfferDraft(draft({ currency: "KRW" }), now).currency, "KRW");
});

test("알 수 없는 통화는 거부한다", () => {
  assert.throws(
    () => parseOfferDraft(draft({ currency: "EUR" }), now),
    OfferValidationError,
  );
  assert.throws(
    () => parseOfferDraft(draft({ currency: "krw" }), now),
    OfferValidationError,
  );
});

test("USD 등록은 절사하지 않고 거부한다", () => {
  // 금액 컬럼이 정수라 $89.50 을 저장할 수 없다. 89 로 깎아 넣으면
  // 통화를 바로잡으려던 변경이 더 조용한 오류를 만든다.
  assert.throws(
    () => parseOfferDraft(draft({ currency: "USD" }), now),
    (error) => {
      assert.ok(error instanceof OfferValidationError);
      assert.match(error.message, /USD/);
      return true;
    },
  );
});

const base = {
  channel: "duty",
  unit: "ml",
  currency: "KRW",
  variantKey: "anr",
  verification: "verified",
  volume: 50,
  total: 90_000,
  unitPrice: 1_800,
};

test("통화가 다른 쌍은 비교하지 않는다", () => {
  const duty = { ...base, currency: "USD", total: 70, unitPrice: 1.4 };
  const retail = { ...base, channel: "retail", total: 92_000, unitPrice: 1_840 };

  // 예전에는 코드가 모든 검수 가격을 KRW 로 단정해 이 검사가 도달 불가였다.
  // 그 상태에서 USD 70 과 KRW 92,000 을 빼면 "91,930원 절약"이 나온다.
  assert.equal(checkComparablePair(duty, retail), "currency-mismatch");
  assert.equal(buildVerifiedComparison(duty, retail), null);
});

test("통화가 같으면 정상적으로 비교한다", () => {
  const duty = { ...base };
  const retail = { ...base, channel: "retail", total: 92_000, unitPrice: 1_840 };

  const comparison = buildVerifiedComparison(duty, retail);
  assert.ok(comparison);
  assert.equal(comparison.duty.currency, "KRW");
  assert.equal(comparison.retail.currency, "KRW");
});
