import assert from "node:assert/strict";
import test from "node:test";
import { extractCartFields } from "../app/lib/cart-ocr.ts";

const catalog = [
  {
    id: "anr",
    brand: "에스티 로더",
    name: "어드밴스드 나이트 리페어",
    unit: "ml",
    defaultVolume: 50,
  },
  {
    id: "skii",
    brand: "SK-II",
    name: "페이셜 트리트먼트 에센스",
    unit: "ml",
    defaultVolume: 160,
  },
];

test("쿠팡 캡처에서 상품과 최종 결제가를 추출한다", () => {
  const result = extractCartFields(
    `쿠팡\n에스티 로더 어드밴스드 나이트 리페어 50ml\n상품금액 92,000원\n쿠폰 할인 5,200원\n배송비 무료\n최종 결제금액 86,800원`,
    catalog,
  );

  assert.equal(result.sourceName, "쿠팡");
  assert.equal(result.channel, "retail");
  assert.equal(result.productId, "anr");
  assert.equal(result.price, 86_800);
  assert.equal(result.shipping, 0);
  assert.equal(result.discount, 0);
  assert.equal(result.volume, 50);
  assert.equal(result.usedFinalPrice, true);
  assert.equal(result.confidence, 100);
});

test("면세점 캡처의 판매처와 상품가·할인을 구분한다", () => {
  const result = extractCartFields(
    `LOTTE DUTY FREE\nSK-II 페이셜 트리트먼트 에센스 230ml\n상품금액 190,000원\n쿠폰 할인 11,000원`,
    catalog,
  );

  assert.equal(result.sourceName, "롯데면세점");
  assert.equal(result.channel, "duty");
  assert.equal(result.productId, "skii");
  assert.equal(result.price, 190_000);
  assert.equal(result.discount, 11_000);
  assert.equal(result.volume, 230);
  assert.equal(result.usedFinalPrice, false);
});

test("주문번호나 연락처만 있는 캡처는 가격으로 사용하지 않는다", () => {
  const result = extractCartFields(
    `주문번호 2026073112345678\n연락처 010-1234-5678\n서울시 중구`,
    catalog,
  );

  assert.equal(result.price, null);
  assert.equal(result.productId, null);
  assert.equal(result.confidence, 0);
});
