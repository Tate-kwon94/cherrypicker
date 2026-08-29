import assert from "node:assert/strict";
import test from "node:test";
import { buildAuthorization } from "../build/sync-coupang-links.mjs";
import { COUPANG_PRODUCT_MAP } from "../build/coupang-product-map.mjs";
import { buildOfferDraft } from "../build/sync-coupang-products.mjs";
import { pilotProducts } from "../app/lib/pilot-catalog.ts";
import { OfferValidationError } from "../app/lib/offer-input.ts";
import { DAY_MS } from "../app/lib/freshness.ts";

const anr = pilotProducts.find((item) => item.id === "estee-lauder-anr");
const now = Date.UTC(2026, 7, 29, 12, 0, 0);

function apiItem(overrides = {}) {
  return {
    productId: 76543210,
    productName: "에스티로더 어드밴스드 나이트 리페어 싱크로나이즈드 세럼, 50ml, 1개",
    productPrice: 86800,
    productImage: "https://static.coupangcdn.com/image/example.jpg",
    productUrl: "https://link.coupang.com/re/AFFSDP?lptag=AF3480139&pageKey=1",
    isRocket: true,
    isFreeShipping: false,
    ...overrides,
  };
}

test("매핑 키는 카탈로그 화장품과 같은 네임스페이스다", () => {
  // 등록안의 productId 가 카탈로그에 없으면, 등록은 성공하는데 어떤 비교
  // 에도 잡히지 않는 유령 가격이 된다.
  const byId = new Map(pilotProducts.map((item) => [item.id, item]));
  for (const [catalogId, entry] of Object.entries(COUPANG_PRODUCT_MAP)) {
    const product = byId.get(catalogId);
    assert.ok(product, `카탈로그에 없는 매핑: ${catalogId}`);
    assert.equal(product.category, "cosmetics", `${catalogId}: 주류는 쿠팡에 없다`);
    assert.ok(entry.keyword.trim().length > 0, `${catalogId}: 검색어가 비었다`);
  }
});

test("등록안은 검수 계약을 통과하는 형태로 만들어진다", () => {
  const result = buildOfferDraft({
    catalogId: "estee-lauder-anr",
    mapEntry: { keyword: "무관", productId: 76543210 },
    product: anr,
    apiItem: apiItem(),
    now,
  });

  assert.equal(result.skipped, false);
  const draft = result.draft;
  assert.equal(draft.productId, "estee-lauder-anr");
  assert.equal(draft.channel, "retail");
  assert.equal(draft.sourceName, "쿠팡");
  // 증거 URL 은 추적 링크가 아니라 재검증 가능한 상품 페이지다.
  assert.equal(draft.sourceUrl, "https://www.coupang.com/vp/products/76543210");
  assert.equal(draft.listPrice, 86800);
  // 용량은 이름 파싱이 아니라 카탈로그에서 온다.
  assert.equal(draft.volume, anr.defaultVolume);
  assert.equal(draft.unit, anr.unit);
  // official_listing 신선도 창(1일)에 정확히 맞춘다.
  assert.equal(draft.expiresAt - draft.observedAt, DAY_MS);
  assert.equal(result.imageUrl, "https://static.coupangcdn.com/image/example.jpg");
});

test("무료배송이 확인되지 않으면 등록안을 만들지 않는다", () => {
  // 배송비 0 을 지어내면 국내가가 실제보다 싸 보인다 — 그 오차는 비교
  // 결론을 조용히 뒤집으므로, 자동 경로에서는 만들지 않는 쪽을 고른다.
  const result = buildOfferDraft({
    catalogId: "estee-lauder-anr",
    mapEntry: { keyword: "무관", productId: 76543210 },
    product: anr,
    apiItem: apiItem({ isRocket: false, isFreeShipping: false }),
    now,
  });
  assert.equal(result.skipped, true);
  assert.match(result.reason, /배송비/);
});

test("세트·증정 리스팅은 본품 가드에 걸려 등록안이 되지 못한다", () => {
  // 리스팅 제목을 다듬지 않고 그대로 쓰는 이유다 — 묶음 가격이 본품
  // 가격으로 등록되는 것을 기존 가드가 막아 준다.
  assert.throws(
    () =>
      buildOfferDraft({
        catalogId: "estee-lauder-anr",
        mapEntry: { keyword: "무관", productId: 76543210 },
        product: anr,
        apiItem: apiItem({ productName: "에스티로더 ANR 세럼 50ml 1+1 기획" }),
        now,
      }),
    OfferValidationError,
  );
});

test("검색 서명에는 쿼리 문자열이 참여한다", () => {
  // 쿼리가 서명에서 빠지면 서버 검증과 어긋나 401 이 난다 — 딥링크(쿼리
  // 없음)만 검증된 상태에서 검색 API 를 추가했으므로 여기서 못박는다.
  const base = {
    method: "GET",
    accessKey: "AK",
    secretKey: "SK",
    now: new Date(now),
  };
  const a = buildAuthorization({
    ...base,
    path: "/v2/providers/affiliate_open_api/apis/openapi/products/search?keyword=a&limit=10",
  });
  const b = buildAuthorization({
    ...base,
    path: "/v2/providers/affiliate_open_api/apis/openapi/products/search?keyword=b&limit=10",
  });
  assert.notEqual(a, b);
});
