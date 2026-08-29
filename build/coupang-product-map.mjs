/**
 * 카탈로그 상품 ↔ 쿠팡 상품 매핑.
 *
 * productId 는 사람이 한 번 확정해서 적는다 — 검색 순위는 흔들리므로
 * "첫 번째 결과"를 믿으면 세트·병행수입·다른 용량이 본품 자리로 들어온다.
 * null 이면 아직 미확정: `--discover` 가 후보를 보여 주고, 여기 적기 전
 * 까지 가격 수집 대상이 아니다.
 *
 * keyword 는 쿠팡 검색어다. 본품 단품이 상위에 오도록 용량까지 적는다.
 * 브랜드·상품명·용량·단위는 여기 적지 않는다 — app/lib/pilot-catalog.ts
 * 가 원본이고, 스크립트가 거기서 읽는다 (어긋나면 테스트가 잡는다).
 */
export const COUPANG_PRODUCT_MAP = {
  "lrp-cicaplast-balm-b5": {
    keyword: "라로슈포제 시카플라스트 밤 B5+ 100ml",
    productId: null,
  },
  "lrp-hyalu-b5-serum": {
    keyword: "라로슈포제 히알루 B5 세럼 30ml",
    productId: null,
  },
  "drg-red-blemish-soothing-foam": {
    keyword: "닥터지 약산성 레드 블레미쉬 클리어 수딩 폼 150ml",
    productId: null,
    barcode: "8809695360527",
  },
  "estee-lauder-anr": {
    keyword: "에스티로더 어드밴스드 나이트 리페어 세럼 50ml",
    productId: null,
  },
  "sk-ii-facial-treatment-essence": {
    keyword: "SK-II 페이셜 트리트먼트 에센스 160ml",
    productId: null,
  },
  "sulwhasoo-concentrated-ginseng-cream": {
    keyword: "설화수 자음생크림 클래식 50ml",
    productId: null,
  },
};
