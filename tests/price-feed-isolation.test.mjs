import assert from "node:assert/strict";
import test from "node:test";
import { mapPublishedOffers } from "../app/lib/price-store.ts";

function row(overrides = {}) {
  return {
    id: "offer-ok",
    product_id: "anr",
    brand: "에스티 로더",
    product_name: "어드밴스드 나이트 리페어",
    category: "cosmetics",
    source_name: "롯데면세점",
    source_url: "https://example.com/a",
    channel: "duty",
    list_price: 100_000,
    shipping: 0,
    instant_discount: 0,
    final_price: 100_000,
    volume: 100,
    unit: "ml",
    status: "approved",
    observed_at: Date.now(),
    expires_at: Date.now() + 86_400_000,
    evidence_type: "official_listing",
    store_location: "",
    abv: null,
    barcode: "",
    notes: "",
    created_by: "admin@example.com",
    approved_by: "admin@example.com",
    approved_at: Date.now(),
    created_at: Date.now(),
    updated_at: Date.now(),
    ...overrides,
  };
}

test("불량 행 하나가 피드 전체를 무너뜨리지 않는다", () => {
  // 예전에는 map 안에서 그대로 던져 승인된 행 한 건이 검수 피드 전체를
  // 503 으로 만들고 사이트를 "준비 중" 상태로 떨어뜨렸다.
  const { offers, excluded } = mapPublishedOffers(
    [
      row({ id: "offer-good-1" }),
      row({ id: "offer-bad", volume: 0 }),
      row({ id: "offer-good-2" }),
    ],
    Date.now(),
  );

  assert.deepEqual(
    offers.map((offer) => offer.id),
    ["offer-good-1", "offer-good-2"],
  );
  assert.deepEqual(excluded, ["offer-bad"]);
});

test("제외된 행은 조용히 사라지지 않고 식별자가 남는다", () => {
  const { excluded } = mapPublishedOffers(
    [
      row({ id: "zero-price", final_price: 0 }),
      row({ id: "negative-volume", volume: -5 }),
    ],
    Date.now(),
  );

  assert.deepEqual(excluded.sort(), ["negative-volume", "zero-price"]);
});

test("정상 행만 있으면 아무것도 제외하지 않는다", () => {
  const { offers, excluded } = mapPublishedOffers(
    [row({ id: "a" }), row({ id: "b" })],
    Date.now(),
  );

  assert.equal(offers.length, 2);
  assert.deepEqual(excluded, []);
  assert.equal(offers[0].unitPrice, 1_000);
});

test("빈 결과도 예외 없이 처리한다", () => {
  const { offers, excluded } = mapPublishedOffers([], Date.now());
  assert.deepEqual(offers, []);
  assert.deepEqual(excluded, []);
});
