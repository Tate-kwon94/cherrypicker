import assert from "node:assert/strict";
import test from "node:test";
import { buildAuthorization } from "../build/sync-coupang-links.mjs";
import { COUPANG_PRODUCT_MAP } from "../build/coupang-product-map.mjs";
import {
  buildOfferDraft,
  parseStatedVolumes,
  selectApiItem,
} from "../build/sync-coupang-products.mjs";
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

test("검색어의 용량은 카탈로그 용량과 일치한다", () => {
  // 등록안의 용량은 카탈로그에서 오는데 검색어가 다른 용량의 리스팅으로
  // 이끌면, 230ml 가격이 160ml 로 기록돼 단위가가 조용히 어긋난다 —
  // 리뷰에서 실제로 두 건(SK-II 230↔160, 설화수 60↔50) 잡힌 결함이다.
  const byId = new Map(pilotProducts.map((item) => [item.id, item]));
  for (const [catalogId, entry] of Object.entries(COUPANG_PRODUCT_MAP)) {
    const stated = entry.keyword.match(/(\d+(?:\.\d+)?)\s*ml/i);
    if (!stated) continue;
    const product = byId.get(catalogId);
    assert.equal(
      Number(stated[1]),
      product.defaultVolume,
      `${catalogId}: 검색어는 ${stated[1]}ml, 카탈로그는 ${product.defaultVolume}${product.unit}`,
    );
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
  // 상품명은 리스팅 제목이 아니라 카탈로그 본품명이다 — 수동 면세 등록과
  // 이름이 같아야 상품 정체성 가드를 통과해 같은 상품으로 합쳐진다.
  assert.equal(draft.productName, anr.name);
  // 리스팅 제목은 증거로 notes 에 남는다.
  assert.match(draft.notes, /리스팅: 에스티로더 어드밴스드/);
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

// --- 확정 상품 한 줄 고르기 (2026-09-02 --discover 실측에서 드러난 계약) ---
test("같은 productId의 다른 용량 옵션을 본품 가격으로 쓰지 않는다", () => {
  // 실측: SK-II 는 productId 9016675424 가 160ml 186,150원과 230ml
  // 237,150원 두 줄로 온다. productId 만 보고 첫 줄을 집으면 230ml 가격이
  // 160ml 로 기록돼 단위가가 조용히 44% 틀린다.
  const rows = [
    { productId: 9016675424, productName: "에스케이투 피테라 에센스, 160ml, 1개", productPrice: 186150 },
    { productId: 9016675424, productName: "에스케이투 페이셜 트리트먼트 피테라 에센스, 230ml, 1개", productPrice: 237150 },
  ];

  const picked = selectApiItem(rows, { productId: 9016675424, volume: 160, unit: "ml" });
  assert.equal(picked.item.productPrice, 186150);

  const other = selectApiItem(rows, { productId: 9016675424, volume: 230, unit: "ml" });
  assert.equal(other.item.productPrice, 237150);
});

test("리스팅 용량이 카탈로그와 다르면 고르지 않는다", () => {
  // 실측: 닥터지 수딩 폼의 쿠팡 로켓 단품은 200ml 인데 카탈로그는 150ml.
  // 용량은 카탈로그에서 오므로, 이 줄을 쓰면 200ml 가격이 150ml 가 된다.
  const rows = [
    { productId: 8204719456, productName: "닥터지 약산성 레드 블레미쉬 클리어 수딩 폼, 200ml, 1개", productPrice: 13430 },
  ];
  const picked = selectApiItem(rows, { productId: 8204719456, volume: 150, unit: "ml" });
  assert.equal(picked.item, null);
  assert.match(picked.reason, /200ml.*카탈로그 150ml/);
});

test("용량 표기가 없으면 값이 하나로 정해질 때만 쓴다", () => {
  // 럭셔리 리스팅은 대개 용량을 적지 않는다. 사람이 --discover 를 보고
  // 고른 productId 이므로 가격이 하나면 쓰고, 갈리면 멈춘다.
  const single = [{ productId: 7839554815, productName: "더후 비첩 자생 에센스", productPrice: 133230 }];
  assert.equal(
    selectApiItem(single, { productId: 7839554815, volume: 50, unit: "ml" }).item.productPrice,
    133230,
  );

  const split = [
    { productId: 7839554815, productName: "더후 비첩 자생 에센스", productPrice: 133230 },
    { productId: 7839554815, productName: "더후 비첩 자생 에센스", productPrice: 266460 },
  ];
  const picked = selectApiItem(split, { productId: 7839554815, volume: 50, unit: "ml" });
  assert.equal(picked.item, null);
  assert.match(picked.reason, /특정할 수 없습니다/);
});

test("확정한 productId가 결과에 없으면 다른 상품으로 대체하지 않는다", () => {
  const rows = [{ productId: 111, productName: "다른 상품 50ml", productPrice: 1000 }];
  const picked = selectApiItem(rows, { productId: 999, volume: 50, unit: "ml" });
  assert.equal(picked.item, null);
  assert.match(picked.reason, /검색 결과에 없습니다/);
});

test("용량 파싱은 단위를 구분한다", () => {
  assert.deepEqual(parseStatedVolumes("파우더, 11g, 1개", "g"), [11]);
  assert.deepEqual(parseStatedVolumes("파우더, 11g, 1개", "ml"), []);
  assert.deepEqual(parseStatedVolumes("세럼 30ml + 앰플 3ml", "ml"), [30, 3]);
  assert.deepEqual(parseStatedVolumes("시카플라스트 밤 B5+", "ml"), []);
});
