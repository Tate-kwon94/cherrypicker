import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateOfferTotal,
  calculateUnitPrice,
  compareEquivalentVolumes,
  isSafeExternalUrl,
  parseCapturedOffers,
  selectBestUnitOffer,
} from "../app/lib/pricing.ts";

test("배송비와 할인을 반영해 실결제가를 계산한다", () => {
  assert.equal(
    calculateOfferTotal({ price: 100_000, shipping: 3_000, discount: 10_000 }),
    93_000,
  );
  assert.equal(calculateUnitPrice(93_000, 50), 1_860);
});

test("0원 이하 가격과 결제가 이상 할인은 거부한다", () => {
  assert.throws(
    () => calculateOfferTotal({ price: 0, shipping: 0, discount: 0 }),
    RangeError,
  );
  assert.throws(
    () => calculateOfferTotal({ price: 10_000, shipping: 0, discount: 10_000 }),
    RangeError,
  );
  assert.throws(() => calculateUnitPrice(10_000, 0), RangeError);
});

test("총액이 아니라 단위가격을 기준으로 최적 제안을 선택한다", () => {
  const offers = [
    {
      id: "small",
      channel: "retail",
      total: 50_000,
      unitPrice: 1_000,
      volume: 50,
    },
    {
      id: "large",
      channel: "retail",
      total: 80_000,
      unitPrice: 800,
      volume: 100,
    },
  ];

  assert.equal(selectBestUnitOffer(offers, "retail")?.id, "large");
});

test("여러 면세점 가운데 단위가격이 가장 낮은 제안을 선택한다", () => {
  const offers = [
    { id: "lotte", channel: "duty", total: 80_000, unitPrice: 800, volume: 100 },
    { id: "shilla", channel: "duty", total: 75_000, unitPrice: 750, volume: 100 },
    { id: "hyundai", channel: "duty", total: 70_000, unitPrice: 875, volume: 80 },
    { id: "coupang", channel: "retail", total: 65_000, unitPrice: 650, volume: 100 },
  ];

  assert.equal(selectBestUnitOffer(offers, "duty")?.id, "shilla");
});

test("같은 용량으로 환산한 절감액과 절감률을 계산한다", () => {
  const comparison = compareEquivalentVolumes(
    { channel: "duty", total: 100_000, unitPrice: 1_000, volume: 100 },
    { channel: "retail", total: 75_000, unitPrice: 1_500, volume: 50 },
  );

  assert.deepEqual(comparison, {
    comparisonVolume: 50,
    dutyEquivalent: 50_000,
    retailEquivalent: 75_000,
    savings: 25_000,
    dutyWins: true,
    savingRate: 33,
  });
});

test("외부 링크는 http와 https만 허용한다", () => {
  assert.equal(isSafeExternalUrl("https://www.coupang.com/product"), true);
  assert.equal(isSafeExternalUrl("http://localhost:3000/product"), true);
  assert.equal(isSafeExternalUrl("javascript:alert(1)"), false);
  assert.equal(isSafeExternalUrl("not a url"), false);
});

test("브라우저 저장 가격은 알려진 상품과 유효한 수치만 복원한다", () => {
  const valid = {
    id: "captured-1",
    productId: "anr",
    channel: "retail",
    source: "테스트 판매처",
    url: "https://example.com/product",
    price: 80_000,
    shipping: 3_000,
    discount: 5_000,
    volume: 50,
    unit: "ml",
    createdAt: 1,
  };
  const invalid = {
    ...valid,
    id: "captured-2",
    productId: "unknown",
    url: "javascript:alert(1)",
  };

  assert.deepEqual(
    parseCapturedOffers(JSON.stringify([valid, invalid]), new Set(["anr"])),
    [valid],
  );
  assert.deepEqual(parseCapturedOffers("not-json", new Set(["anr"])), []);
});
