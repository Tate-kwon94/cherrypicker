import assert from "node:assert/strict";
import test from "node:test";
import {
  DAY_MS,
  FEED_QUERY_RETENTION_MS,
  MAX_FRESHNESS_DAYS,
  MAX_OFFER_VALIDITY_MS,
  describeFreshnessPolicy,
  freshUntil,
  freshnessWindowDays,
} from "../app/lib/freshness.ts";
import { parseOfferDraft, OfferValidationError } from "../app/lib/offer-input.ts";

test("공식 원본은 1일이 정본이다", () => {
  assert.equal(
    freshnessWindowDays({
      category: "cosmetics",
      evidenceType: "official_listing",
    }),
    1,
  );
  assert.equal(
    freshnessWindowDays({
      category: "liquor",
      evidenceType: "official_listing",
    }),
    1,
  );
});

test("성인 인증 픽업 7일은 주류에만 적용된다", () => {
  assert.equal(
    freshnessWindowDays({
      category: "liquor",
      evidenceType: "licensed_pickup",
    }),
    7,
  );
  // 화장품에는 성인 인증 픽업이라는 개념이 없다. 값이 새어나가면 화장품
  // 가격이 일주일 동안 "최신"으로 남는다.
  assert.equal(
    freshnessWindowDays({
      category: "cosmetics",
      evidenceType: "licensed_pickup",
    }),
    1,
  );
});

test("영수증·매장 가격표는 3일이다", () => {
  for (const evidenceType of ["receipt", "store_photo"]) {
    assert.equal(freshnessWindowDays({ category: "liquor", evidenceType }), 3);
    assert.equal(
      freshnessWindowDays({ category: "cosmetics", evidenceType }),
      3,
    );
  }
});

test("14일은 어떤 조합으로도 나오지 않는다", () => {
  // L-21: 주류 전용 표에 14일이 적혀 있었지만 범용 검사가 먼저 던져
  // 도달할 수 없었다. 그 값이 UI 로만 새어나갔다.
  for (const category of ["cosmetics", "liquor"]) {
    for (const evidenceType of [
      "official_listing",
      "licensed_pickup",
      "receipt",
      "store_photo",
    ]) {
      assert.ok(freshnessWindowDays({ category, evidenceType }) <= 7);
    }
  }
  assert.equal(MAX_FRESHNESS_DAYS, 7);
});

test("freshUntil 은 등록 만료와 정책 창 중 먼저 오는 쪽을 쓴다", () => {
  const observedAt = 1_700_000_000_000;
  const subject = { category: "liquor", evidenceType: "licensed_pickup" };

  // 등록자가 30일을 적어도 정책이 7일로 자른다.
  assert.equal(
    freshUntil({ ...subject, observedAt, expiresAt: observedAt + 30 * DAY_MS }),
    observedAt + 7 * DAY_MS,
  );

  // 등록자가 더 짧게 잡으면 그 값을 존중한다.
  assert.equal(
    freshUntil({ ...subject, observedAt, expiresAt: observedAt + 2 * DAY_MS }),
    observedAt + 2 * DAY_MS,
  );
});

test("등록 검증이 정책과 같은 값을 쓴다", () => {
  const now = 1_700_000_000_000;
  const base = {
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
    evidenceType: "official_listing",
    storeLocation: "",
    abv: null,
    barcode: "",
    notes: "",
  };

  // 딱 1일은 통과한다.
  assert.doesNotThrow(() =>
    parseOfferDraft({ ...base, expiresAt: now + DAY_MS }, now),
  );

  // 1일 + 1ms 는 거부되고, 메시지가 정책값을 그대로 말한다.
  assert.throws(
    () => parseOfferDraft({ ...base, expiresAt: now + DAY_MS + 1 }, now),
    (error) => {
      assert.ok(error instanceof OfferValidationError);
      assert.match(error.message, /최대 1일/);
      return true;
    },
  );
});

test("신선도와 다른 두 시간창은 별개로 남는다", () => {
  // 90일 유효기간 상한은 입력 위생 검사이지 신선도가 아니다.
  assert.equal(MAX_OFFER_VALIDITY_MS, 90 * DAY_MS);
  // 30일 조회 보존은 참고가격을 언제까지 보여줄지의 문제다.
  assert.equal(FEED_QUERY_RETENTION_MS, 30 * DAY_MS);
  // 셋이 같아지면 통합 실수가 일어난 것이다.
  assert.ok(MAX_FRESHNESS_DAYS * DAY_MS < FEED_QUERY_RETENTION_MS);
  assert.ok(FEED_QUERY_RETENTION_MS < MAX_OFFER_VALIDITY_MS);
});

test("사용자 문구는 정책 표에서 유도된다", () => {
  const text = describeFreshnessPolicy();
  assert.match(text, /공식 원본 1일/);
  assert.match(text, /성인 인증 픽업 7일/);
  assert.match(text, /영수증·매장 가격표 3일/);
  assert.doesNotMatch(text, /14일/);
});
