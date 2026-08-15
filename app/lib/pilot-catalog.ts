import type { OfferCategory, OfferUnit } from "./offer-input";

export type PilotProduct = {
  id: string;
  brand: string;
  name: string;
  category: OfferCategory;
  defaultVolume: number;
  unit: OfferUnit;
  segment: string;
  comparisonMode: "same_product" | "unit_value";
  sourceTargets: readonly string[];
};

export const pilotRequiredSourcesPerChannel = 2;

export const pilotProducts: readonly PilotProduct[] = [
  {
    // 4대 온라인 면세점 취급 확인(2026-08-15): 롯데·신라·현대 상품 페이지
    // 검증, 신세계는 브라우저로 확인(봇 차단). 면세 표기는 "밤 B5"(트래블
    // 리테일 SKU), 국내는 "밤 B5+" — 같은 라인의 세대 차이로 보이며 등록
    // 시 용량·구성으로 대조한다.
    id: "lrp-cicaplast-balm-b5",
    brand: "라로슈포제",
    name: "시카플라스트 밤 B5",
    category: "cosmetics",
    defaultVolume: 100,
    unit: "ml",
    segment: "더모코스메틱 진정 밤",
    comparisonMode: "same_product",
    sourceTargets: ["롯데·신라·신세계·현대", "라로슈포제 공식몰·쿠팡"],
  },
  {
    // 면세는 50ml(점보)·50ml×2만 취급, 국내 본품은 30ml. 같은 상품의
    // 용량 차이이므로 단위가로 비교한다 (ANR 100/50과 같은 패턴).
    id: "lrp-hyalu-b5-serum",
    brand: "라로슈포제",
    name: "히알루 B5 세럼",
    category: "cosmetics",
    defaultVolume: 30,
    unit: "ml",
    segment: "더모코스메틱 세럼",
    comparisonMode: "same_product",
    sourceTargets: ["롯데·신라·신세계·현대", "라로슈포제 공식몰·쿠팡"],
  },
  {
    // 신라 단독 확인(2026-08-15): /p/4777651 라이브 검증, 세일가 $9.1
    // (12,875원), 바코드 8809695360527. 다른 3사는 미취급이지만 면세
    // 출처는 한 곳이면 비교가 성립한다. 공유 픽의 "약산성 클렌징 젤 폼
    // 200ml"과는 같은 브랜드의 다른 상품 — 그쪽 파트너 링크를 이 항목에
    // 이어붙이지 않는다.
    id: "drg-red-blemish-soothing-foam",
    brand: "닥터지",
    name: "약산성 레드 블레미쉬 클리어 수딩 폼",
    category: "cosmetics",
    defaultVolume: 150,
    unit: "ml",
    segment: "더모코스메틱 클렌징 폼",
    comparisonMode: "same_product",
    sourceTargets: ["신라", "올리브영·이랜드몰·쿠팡"],
  },
  {
    id: "estee-lauder-anr",
    brand: "에스티 로더",
    name: "어드밴스드 나이트 리페어",
    category: "cosmetics",
    defaultVolume: 50,
    unit: "ml",
    segment: "럭셔리 세럼",
    comparisonMode: "same_product",
    sourceTargets: ["롯데·신라·신세계·현대", "쿠팡·국내몰"],
  },
  {
    id: "sk-ii-facial-treatment-essence",
    brand: "SK-II",
    name: "페이셜 트리트먼트 에센스",
    category: "cosmetics",
    defaultVolume: 160,
    unit: "ml",
    segment: "럭셔리 에센스",
    comparisonMode: "same_product",
    sourceTargets: ["롯데·신라·신세계·현대", "쿠팡·국내몰"],
  },
  {
    id: "sulwhasoo-concentrated-ginseng-cream",
    brand: "설화수",
    name: "자음생크림 클래식",
    category: "cosmetics",
    defaultVolume: 50,
    unit: "ml",
    segment: "럭셔리 크림",
    comparisonMode: "same_product",
    sourceTargets: ["롯데·신라·신세계·현대", "국내 공식몰"],
  },
  {
    id: "anua-heartleaf-pore-control-cleansing-oil",
    brand: "아누아",
    name: "어성초 포어 컨트롤 클렌징오일",
    category: "cosmetics",
    defaultVolume: 200,
    unit: "ml",
    segment: "K-뷰티 클렌징",
    comparisonMode: "same_product",
    sourceTargets: ["롯데·신라·신세계·현대", "올리브영·쿠팡"],
  },
  {
    id: "anua-heartleaf-quercetinol-cleansing-foam",
    brand: "아누아",
    name: "어성초 쿼세티놀 모공 딥 클렌징 폼",
    category: "cosmetics",
    defaultVolume: 150,
    unit: "ml",
    segment: "K-뷰티 클렌징",
    comparisonMode: "same_product",
    sourceTargets: ["롯데·신라·신세계·현대", "올리브영·쿠팡"],
  },
  {
    id: "torriden-dive-in-serum",
    brand: "토리든",
    name: "다이브인 저분자 히알루론산 세럼",
    category: "cosmetics",
    defaultVolume: 50,
    unit: "ml",
    segment: "K-뷰티 세럼",
    comparisonMode: "unit_value",
    sourceTargets: ["롯데·신라·신세계·현대", "올리브영·쿠팡"],
  },
  {
    id: "round-lab-birch-juice-sunscreen",
    brand: "라운드랩",
    name: "자작나무 수분 선크림",
    category: "cosmetics",
    defaultVolume: 50,
    unit: "ml",
    segment: "K-뷰티 선케어",
    comparisonMode: "unit_value",
    sourceTargets: ["롯데·신라·신세계·현대", "올리브영·쿠팡"],
  },
  {
    id: "beauty-of-joseon-relief-sun",
    brand: "조선미녀",
    name: "맑은쌀 선크림",
    category: "cosmetics",
    defaultVolume: 50,
    unit: "ml",
    segment: "K-뷰티 선케어",
    comparisonMode: "unit_value",
    sourceTargets: ["롯데·신라·신세계·현대", "올리브영·쿠팡"],
  },
  {
    id: "aestura-atobarrier365-capsule-toner",
    brand: "에스트라",
    name: "아토베리어365 캡슐토너",
    category: "cosmetics",
    defaultVolume: 300,
    unit: "ml",
    segment: "K-뷰티 토너",
    comparisonMode: "unit_value",
    sourceTargets: ["롯데·신라·신세계·현대", "올리브영·쿠팡"],
  },
  {
    id: "medicube-zero-pore-pad",
    brand: "메디큐브",
    name: "제로 모공 패드 2.0",
    category: "cosmetics",
    defaultVolume: 70,
    unit: "개",
    segment: "K-뷰티 패드",
    comparisonMode: "unit_value",
    sourceTargets: ["롯데·신라·신세계·현대", "올리브영·쿠팡"],
  },
  {
    id: "balvenie-doublewood-12",
    brand: "더 발베니",
    name: "더블우드 12년",
    category: "liquor",
    defaultVolume: 700,
    unit: "ml",
    segment: "입문 싱글몰트",
    comparisonMode: "same_product",
    sourceTargets: ["롯데·신라·신세계·현대", "성인 인증 픽업몰 2곳"],
  },
  {
    id: "glenmorangie-lasanta-12",
    brand: "글렌모렌지",
    name: "라산타 12년",
    category: "liquor",
    defaultVolume: 700,
    unit: "ml",
    segment: "셰리 싱글몰트",
    comparisonMode: "same_product",
    sourceTargets: ["롯데·신라·신세계·현대", "성인 인증 픽업몰 2곳"],
  },
  {
    id: "laphroaig-10",
    brand: "라프로익",
    name: "10년",
    category: "liquor",
    defaultVolume: 700,
    unit: "ml",
    segment: "피트 싱글몰트",
    comparisonMode: "same_product",
    sourceTargets: ["롯데·신라·신세계·현대", "성인 인증 픽업몰 2곳"],
  },
  {
    id: "macallan-double-cask-12",
    brand: "맥캘란",
    name: "더블 캐스크 12년",
    category: "liquor",
    defaultVolume: 700,
    unit: "ml",
    segment: "프리미엄 싱글몰트",
    comparisonMode: "same_product",
    sourceTargets: ["롯데·신라·신세계·현대", "성인 인증 픽업몰 2곳"],
  },
  {
    id: "glenfiddich-15-solera",
    brand: "글렌피딕",
    name: "15년 솔레라",
    category: "liquor",
    defaultVolume: 700,
    unit: "ml",
    segment: "숙성 싱글몰트",
    comparisonMode: "same_product",
    sourceTargets: ["롯데·신라·신세계·현대", "성인 인증 픽업몰 2곳"],
  },
];
