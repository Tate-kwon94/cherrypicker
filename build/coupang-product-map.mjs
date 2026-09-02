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
    // 2026-09-02 --discover: 본품 단품(9304082897·8166595672·6598493)이 전부 로켓이 아니라 배송비가 확인되지 않는다 — 자동 등록 대상이 아니다.
    keyword: "라로슈포제 시카플라스트 밤 B5+ 100ml",
    productId: null,
  },
  "lrp-hyalu-b5-serum": {
    // 2026-09-02 --discover: 본품 단품 7210333033 은 로켓이 아니다(배송비 미확인).
    keyword: "라로슈포제 히알루 B5 세럼 30ml",
    productId: null,
  },
  "drg-red-blemish-soothing-foam": {
    // 2026-09-02 --discover: 쿠팡 로켓 단품은 200ml(8204719456)로 카탈로그 150ml 와 다르다. 150ml 단품 7261408597 은 로켓이 아니다.
    keyword: "닥터지 약산성 레드 블레미쉬 클리어 수딩 폼 150ml",
    productId: null,
    barcode: "8809695360527",
  },
  "estee-lauder-anr": {
    // 2026-09-02 --discover: 후보 7216491261(170,000원 로켓)은 리스팅에 용량이 없다 — 50ml 인지 확인 후 적을 것.
    keyword: "에스티로더 어드밴스드 나이트 리페어 세럼 50ml",
    productId: null,
  },
  "sk-ii-facial-treatment-essence": {
    // 2026-09-02 --discover 확정: 리스팅이 "160ml"를 명시하고 로켓배송이다.
    // 같은 productId 로 230ml 줄도 오므로 selectApiItem 이 용량으로 고른다.
    // "맨 페이셜 트리트먼트 에센스"(5149548156)는 다른 제품이다.
    keyword: "SK-II 페이셜 트리트먼트 에센스 160ml",
    productId: 9016675424,
  },
  "sulwhasoo-concentrated-ginseng-cream": {
    keyword: "설화수 자음생크림 클래식 50ml",
    productId: null,
  },
  // ── 2026-08-30 확대 1차 ─────────────────────────────────────────
  // 쿠팡에 공식·로켓 유통이 있는 브랜드만 넣는다. 랑콤·라메르·시슬리·
  // 키엘·나스·맥은 쿠팡 리스팅이 병행수입 중심이라 자동 수집에서 뺐다 —
  // 병행 가격을 국내 기준가로 등록하면 비교가 왜곡된다. 그 여섯은 국내
  // 기준을 공식몰 가격으로 손 등록한다.
  "whoo-bichup-essence": {
    // 2026-09-02 --discover: 후보 7839554815(133,230원 로켓) — 리스팅에 용량 없음. 50ml 확인 후 적을 것.
    keyword: "더후 비첩 자생 에센스 50ml",
    productId: null,
  },
  "whoo-cheongidan-cream": {
    // 2026-09-02 --discover: 후보 8300080908(346,750원 로켓) — 리스팅에 용량 없음. 60ml 확인 후 적을 것.
    keyword: "더후 천기단 화현 래디언스크림 60ml",
    productId: null,
  },
  "sulwhasoo-first-care-essence": {
    // 2026-09-02 --discover: 후보 8597776710(115,920원 로켓) — 리스팅에 용량 없음. 90ml 확인 후 적을 것.
    keyword: "설화수 윤조에센스 6세대 90ml",
    productId: null,
  },
  "avene-cicalfate-plus": {
    // 2026-09-02 --discover: 후보 71062498(13,960원 로켓) — 리스팅에 용량 없음. 40ml 확인 후 적을 것.
    keyword: "아벤느 시칼파트 플러스 SOS 크림 40ml",
    productId: null,
  },
  "biotherm-life-plankton-essence": {
    // 2026-09-02 --discover: 검색 결과가 전부 무관 상품(신발·주방용품)이다 — 쿠팡 정식 유통이 없다.
    keyword: "비오템 라이프 플랑크톤 에센스 200ml",
    productId: null,
  },
  "biotherm-homme-aquapower": {
    keyword: "비오템 옴므 아쿠아파워 75ml",
    productId: null,
  },
  "clarins-double-serum": {
    keyword: "클라랑스 더블세럼 50ml",
    productId: null,
  },
  "lrp-anthelios-uvmune": {
    keyword: "라로슈포제 안뗄리오스 UV뮨 400 하이드레이팅 50ml",
    productId: null,
  },
  "lrp-effaclar-serum": {
    keyword: "라로슈포제 에빠끌라 울트라 컨센트레이트 세럼 30ml",
    productId: null,
  },
  "physiogel-red-soothing-cream": {
    keyword: "피지오겔 레드수딩 AI 리페어 크림 100ml",
    productId: null,
  },
  "manyo-pure-cleansing-oil": {
    keyword: "마녀공장 퓨어 클렌징 오일 200ml",
    productId: null,
  },
  "numbuzin-no5-toner": {
    keyword: "넘버즈인 5번 글루타치온C 에센셜토너 200ml",
    productId: null,
  },
  "abib-heartleaf-toner": {
    keyword: "아비브 어성초 카밍 토너 스킨 부스터 200ml",
    productId: null,
  },
  "hera-uv-protector": {
    keyword: "헤라 UV프로텍터 멀티디펜스 EX 50ml",
    productId: null,
  },
  "ahc-airrich-sunstick": {
    keyword: "AHC 마스터즈 에어리치 선스틱 22g",
    productId: null,
  },
};
