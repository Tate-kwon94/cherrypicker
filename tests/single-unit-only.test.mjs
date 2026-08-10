import assert from "node:assert/strict";
import test from "node:test";
import { OfferValidationError, parseOfferDraft } from "../app/lib/offer-input.ts";
import { pilotProducts } from "../app/lib/pilot-catalog.ts";

const now = 1_770_000_000_000;

function draft(productName, overrides = {}) {
  return {
    productId: "anr",
    brand: "에스티 로더",
    productName,
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

test("본품이 아닌 구성은 검수 가격으로 등록하지 않는다", () => {
  // 변형(variant) 개념이 없어 상품 id 가 곧 변형이다. 세트가 본품과 같은
  // id 로 들어오면 구성이 다른 가격이 같은 상품으로 비교된다.
  const rejected = [
    "어드밴스드 나이트 리페어 기획세트",
    "어드밴스드 나이트 리페어 선물 세트",
    "어드밴스드 나이트 리페어 홀리데이세트",
    "어드밴스드 나이트 리페어 증정 기획",
    "어드밴스드 나이트 리페어 사은품 포함",
    "어드밴스드 나이트 리페어 한정판",
    "어드밴스드 나이트 리페어 리미티드 에디션",
    "어드밴스드 나이트 리페어 리필 기획",
    "어성초 클렌징 폼 2개입",
    "어성초 클렌징 폼 1+1",
  ];

  for (const name of rejected) {
    assert.throws(
      () => parseOfferDraft(draft(name), now),
      (error) => {
        assert.ok(error instanceof OfferValidationError);
        // 왜 걸렸는지 말해 줘야 사람이 판단할 수 있다.
        assert.match(error.message, /본품만/);
        return true;
      },
      `거부되지 않음: ${name}`,
    );
  }
});

test("파일럿 카탈로그의 실제 상품명은 하나도 걸리지 않는다", () => {
  // 이름으로 거르는 검사라 오탐이 가장 큰 위험이다. 지금 운영 중인
  // 상품이 등록 불가가 되면 그 사실을 여기서 먼저 알아야 한다.
  for (const item of pilotProducts) {
    assert.doesNotThrow(
      () =>
        parseOfferDraft(
          draft(item.name, {
            category: item.category,
            unit: item.unit,
            volume: item.defaultVolume,
            // 주류는 국내 채널에서 매장 정보를 요구하므로 공식 원본으로 둔다.
            evidenceType: "official_listing",
          }),
          now,
        ),
      `오탐: ${item.brand} ${item.name}`,
    );
  }
});

test("본품은 그대로 통과한다", () => {
  assert.doesNotThrow(() =>
    parseOfferDraft(draft("어드밴스드 나이트 리페어"), now),
  );
});
