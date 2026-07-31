import assert from "node:assert/strict";
import test from "node:test";
import {
  OfferValidationError,
  isApprovedOfferActive,
  normalizeProductId,
  parseOfferDraft,
} from "../app/lib/offer-input.ts";

const now = Date.parse("2026-07-31T06:00:00.000Z");

function validDraft(overrides = {}) {
  return {
    brand: "에스티 로더",
    productName: "어드밴스드 나이트 리페어",
    category: "cosmetics",
    sourceName: "공식몰",
    sourceUrl: "https://example.com/product",
    channel: "retail",
    listPrice: 100_000,
    shipping: 3_000,
    instantDiscount: 10_000,
    volume: 50,
    unit: "ml",
    observedAt: now - 60_000,
    expiresAt: now + 7 * 24 * 60 * 60 * 1000,
    notes: "누구나 적용 가능한 즉시할인",
    ...overrides,
  };
}

test("관리자 가격 입력을 정규화하고 최종 결제가를 계산한다", () => {
  const parsed = parseOfferDraft(validDraft(), now);

  assert.equal(parsed.productId, "에스티-로더-어드밴스드-나이트-리페어");
  assert.equal(parsed.finalPrice, 93_000);
  assert.equal(parsed.volume, 50);
  assert.equal(parsed.expiresAt, now + 7 * 24 * 60 * 60 * 1000);
});

test("위험한 URL과 만료된 가격은 등록을 거부한다", () => {
  assert.throws(
    () => parseOfferDraft(validDraft({ sourceUrl: "javascript:alert(1)" }), now),
    OfferValidationError,
  );
  assert.throws(
    () => parseOfferDraft(validDraft({ expiresAt: now - 1 }), now),
    OfferValidationError,
  );
});

test("승인되고 만료되지 않은 가격만 공개 대상으로 본다", () => {
  assert.equal(isApprovedOfferActive("approved", now + 1, now), true);
  assert.equal(isApprovedOfferActive("draft", now + 1, now), false);
  assert.equal(isApprovedOfferActive("approved", now, now), false);
});

test("상품 ID는 URL에 안전한 슬러그로 정규화한다", () => {
  assert.equal(normalizeProductId("  SK-II / 에센스 230ml  "), "sk-ii-에센스-230ml");
});

test("주류는 ml 기준으로 받고 도수는 선택 정보로 검증한다", () => {
  const liquorDraft = validDraft({
    brand: "더 발베니",
    productName: "더블우드 12",
    category: "liquor",
    sourceName: "성인 인증 픽업몰",
    channel: "retail",
    evidenceType: "licensed_pickup",
    storeLocation: "강남 픽업점",
    abv: 40,
    volume: 700,
    unit: "ml",
    expiresAt:
      now - 60_000 + 7 * 24 * 60 * 60 * 1000 - 1,
  });

  const parsed = parseOfferDraft(liquorDraft, now);
  assert.equal(parsed.evidenceType, "licensed_pickup");
  assert.equal(parsed.storeLocation, "강남 픽업점");
  assert.equal(parsed.abv, 40);

  const withoutAbv = parseOfferDraft({ ...liquorDraft, abv: "" }, now);
  assert.equal(withoutAbv.abv, null);
  assert.throws(
    () => parseOfferDraft({ ...liquorDraft, abv: 101 }, now),
    OfferValidationError,
  );
  assert.throws(
    () =>
      parseOfferDraft(
        {
          ...liquorDraft,
          expiresAt: now + 8 * 24 * 60 * 60 * 1000,
        },
        now,
      ),
    OfferValidationError,
  );
});

test("영수증 기반 주류 가격은 확인 지점을 요구한다", () => {
  assert.throws(
    () =>
      parseOfferDraft(
        validDraft({
          category: "liquor",
          channel: "retail",
          unit: "ml",
          volume: 700,
          abv: 46,
          evidenceType: "receipt",
          storeLocation: "",
          expiresAt: now + 24 * 60 * 60 * 1000,
        }),
        now,
      ),
    OfferValidationError,
  );
});
