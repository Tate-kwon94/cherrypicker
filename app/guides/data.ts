export type GuideArticle = {
  slug: string;
  category: "화장품" | "위스키";
  brand: string;
  title: string;
  subtitle: string;
  image: string;
  imageAlt: string;
  imageSource: string;
  verdict: string;
  summary: string;
  dutySpec: string;
  retailSpec: string;
  checkpoints: string[];
  paragraphs: string[];
  caution: string;
};

export const guideArticles: GuideArticle[] = [
  {
    slug: "estee-lauder-anr-unit-price",
    category: "화장품",
    brand: "에스티 로더",
    title: "어드밴스드 나이트 리페어, 50ml와 면세 100ml 비교법",
    subtitle: "총액이 아닌 1ml 가격으로 구성 차이를 읽는 방법",
    image: "/products/estee-lauder-anr.jpg",
    imageAlt: "에스티 로더 어드밴스드 나이트 리페어 제품",
    imageSource:
      "https://www.esteelauder.com/product/689/77491/product-catalog/skincare/repair-serum/advanced-night-repair-serum/synchronized-multi-recovery-complex",
    verdict: "사용량이 꾸준하고 출국 일정이 확실할 때 대용량 면세 구성이 유리할 수 있어요.",
    summary:
      "국내 50ml와 면세 100ml는 결제금액만 보면 국내 구성이 저렴해 보입니다. 하지만 실제 비교에서는 배송비와 적용 가능한 할인까지 반영한 뒤 1ml 가격을 계산해야 합니다.",
    dutySpec: "온라인 면세 100ml 구성",
    retailSpec: "국내 리테일 50ml 구성",
    checkpoints: [
      "면세점 회원 할인과 적립금은 실제 적용 가능한 금액만 반영",
      "국내 가격은 배송비를 포함한 최종 결제가 사용",
      "개봉 후 사용기간 안에 100ml를 사용할 수 있는지 확인",
    ],
    paragraphs: [
      "ANR처럼 반복 구매가 많은 세럼은 대용량의 단위가격 장점이 비교적 분명합니다. 다만 처음 사용하는 제품이라면 용량이 큰 것 자체가 절약을 의미하지는 않습니다. 피부에 맞지 않거나 사용기간 안에 소진하지 못하면 실제 효용은 낮아집니다.",
      "가격 비교표에서는 면세 100ml 가격을 100으로 나누고, 국내 50ml의 배송비 포함 가격을 50으로 나눕니다. 두 단위가격의 차이에 국내 용량인 50ml를 곱하면 같은 용량 기준 절감액을 확인할 수 있습니다.",
    ],
    caution: "표시 가격은 서비스 구조를 설명하기 위한 예시이며 결제 전 판매처에서 다시 확인해야 합니다.",
  },
  {
    slug: "skii-essence-volume-comparison",
    category: "화장품",
    brand: "SK-II",
    title: "페이셜 트리트먼트 에센스, 면세 대용량이 항상 이득일까",
    subtitle: "160ml와 230ml의 실사용 기간까지 고려한 비교",
    image: "/products/skii-facial-treatment-essence.png",
    imageAlt: "SK-II 페이셜 트리트먼트 에센스 230ml 제품",
    imageSource: "https://www.sk2.co.kr/product/facial-treatment-essence",
    verdict: "매일 사용하는 기존 사용자라면 면세 230ml의 단위가격을 우선 확인해보세요.",
    summary:
      "에센스는 병 크기뿐 아니라 세트 구성과 증정품이 자주 달라집니다. 본품 용량만 분리해 계산하고, 증정품은 실제 사용할 때만 별도 가치로 보는 편이 안전합니다.",
    dutySpec: "온라인 면세 230ml 구성",
    retailSpec: "국내 리테일 160ml 구성",
    checkpoints: [
      "본품과 증정품 용량을 구분",
      "면세 전용 세트인지 단품인지 확인",
      "카드 청구할인은 기본가와 별도 시나리오로 표시",
    ],
    paragraphs: [
      "SK-II 에센스는 판매처별 구성이 다양해 상품명만으로 같은 상품이라고 판단하기 어렵습니다. 바코드, 본품 용량, 세트 수량을 먼저 맞춰야 잘못된 최저가 연결을 줄일 수 있습니다.",
      "회원 등급이나 카드 조건이 필요한 할인은 모든 사용자가 받을 수 없으므로 기본 비교가에서 제외하고, 조건부 최저가로 따로 표시하는 것이 좋습니다. 이렇게 해야 추천 결과가 특정 결제수단에 과도하게 좌우되지 않습니다.",
    ],
    caution: "세트 상품은 본품·증정품·미니어처 구성을 판매처 상세페이지에서 확인하세요.",
  },
  {
    slug: "sulwhasoo-cream-duty-free",
    category: "화장품",
    brand: "설화수",
    title: "자음생크림 면세 60ml와 국내 50ml, 무엇을 봐야 할까",
    subtitle: "용량 차이와 공식 판매처 여부를 함께 보는 기준",
    image: "/products/sulwhasoo-ginseng-cream.jpg",
    imageAlt: "설화수 자음생크림 제품",
    imageSource:
      "https://www.sulwhasoo.com/product/%EC%9E%90%EC%9D%8C%EC%83%9D%ED%81%AC%EB%A6%BC/53/",
    verdict: "가격 차이가 작다면 공식 판매처와 교환 편의성까지 비교하는 편이 좋아요.",
    summary:
      "고가 크림은 단위가격뿐 아니라 판매자 신뢰도와 교환 조건이 구매 만족도에 큰 영향을 줍니다. 절감액이 작을 때는 국내 공식 판매처의 편의성이 더 나을 수 있습니다.",
    dutySpec: "온라인 면세 60ml 구성",
    retailSpec: "국내 리테일 50ml 구성",
    checkpoints: [
      "공식 판매자·병행수입 여부 확인",
      "리뉴얼 전후 패키지와 제조번호 확인",
      "면세 수령 실패 시 취소 조건 확인",
    ],
    paragraphs: [
      "자음생크림처럼 면세와 국내 용량이 10ml 정도 차이 나는 상품은 총액만 보면 판단이 흔들리기 쉽습니다. 두 가격을 1ml 기준으로 바꾼 뒤, 실제 필요한 용량에 맞춰 환산해야 합니다.",
      "단위가격 차이가 크지 않다면 배송 속도, 선물 포장, 반품 가능 여부도 비용으로 볼 수 있습니다. 살까?는 이런 조건을 가격 옆에 함께 표시해 숫자 하나만으로 구매를 유도하지 않는 방향을 지향합니다.",
    ],
    caution: "화장품의 정품 여부와 교환 정책은 판매처마다 다르므로 구매 전 확인이 필요합니다.",
  },
  {
    slug: "balvenie-12-duty-free-guide",
    category: "위스키",
    brand: "발베니",
    title: "발베니 12 더블우드, 입문용 면세 위스키로 보는 이유",
    subtitle: "가격 차이와 취향 실패 가능성을 함께 판단하는 방법",
    image: "/products/balvenie-doublewood-12.png",
    imageAlt: "발베니 12 더블우드 보틀과 패키지",
    imageSource:
      "https://shop.us.thebalvenie.com/products/the-balvenie-doublewood-12",
    verdict: "부드럽고 달콤한 스타일을 선호하고 가격 차이가 충분하다면 면세 후보로 적합해요.",
    summary:
      "위스키는 저렴하다는 이유만으로 추천하기 어렵습니다. 향의 강도와 단맛, 피트 성향을 먼저 확인한 뒤 면세가와 국내 픽업 가격을 비교해야 합니다.",
    dutySpec: "온라인 면세 700ml",
    retailSpec: "국내 주류 매장 픽업 700ml",
    checkpoints: [
      "꿀·말린 과일·오크 계열 취향인지 확인",
      "주류 면세 한도와 병 수 사용 여부 확인",
      "국내 가격은 택배가 아닌 합법적인 픽업 기준으로 비교",
    ],
    paragraphs: [
      "발베니 12 더블우드는 강한 피트 향보다 달콤한 과일과 나무 향이 중심이라 처음 싱글몰트를 고르는 사람에게 비교적 설명하기 쉬운 편입니다. 다만 평소 강한 스모키 향을 원하는 사람에게는 개성이 약하게 느껴질 수 있습니다.",
      "면세 추천은 가격 차이가 공항 수령의 번거로움을 충분히 보상할 때만 의미가 있습니다. 출국 일정이 없거나 절감액이 작다면 가까운 주류 매장에서 픽업하는 편이 더 합리적일 수 있습니다.",
    ],
    caution: "주류 구매·수령에는 성인 인증과 판매처 규정이 적용됩니다.",
  },
  {
    slug: "glenmorangie-lasanta-sweet-whisky",
    category: "위스키",
    brand: "글렌모렌지",
    title: "글렌모렌지 라산타 12, 달콤한 위스키를 찾는다면",
    subtitle: "셰리 캐스크 취향과 100ml 가격을 함께 비교하기",
    image: "/products/glenmorangie-lasanta-12.png",
    imageAlt: "글렌모렌지 라산타 12 보틀",
    imageSource: "https://www.glenmorangie.com/en-us/products/the-lasanta",
    verdict: "건과일과 초콜릿 계열을 좋아한다면 가격과 취향이 함께 맞는지 확인해보세요.",
    summary:
      "라산타는 가격표만으로는 알 수 없는 셰리 캐스크 특유의 단맛이 중요한 상품입니다. 추천 카드에서는 취향 프로필과 100ml 가격을 함께 보여주는 것이 유용합니다.",
    dutySpec: "온라인 면세 700ml",
    retailSpec: "국내 주류 매장 픽업 700ml",
    checkpoints: [
      "건포도·초콜릿·계피 계열 선호도 확인",
      "도수와 병 용량이 동일한지 확인",
      "면세 쿠폰이 특정 브랜드에서 제외되는지 확인",
    ],
    paragraphs: [
      "셰리 캐스크 위스키는 달콤하다는 표현 안에서도 건과일, 초콜릿, 향신료의 비중이 다릅니다. 단순히 입문용이라고 묶기보다 사용자가 좋아하는 향을 태그로 선택하게 하면 추천의 설명력이 높아집니다.",
      "가격은 700ml 총액과 함께 100ml 단위가격을 표시합니다. 다른 병 용량과 비교할 때도 같은 기준을 유지할 수 있어, 대용량이나 한정 패키지가 실제로 저렴한지 판단하기 쉽습니다.",
    ],
    caution: "한정 패키지와 일반 제품은 구성품이 다를 수 있어 동일 상품 매칭이 필요합니다.",
  },
  {
    slug: "laphroaig-10-smoky-whisky",
    category: "위스키",
    brand: "라프로익",
    title: "라프로익 10, 가격보다 취향 확인이 먼저인 이유",
    subtitle: "피트 위스키의 강한 개성과 국내 픽업 대안",
    image: "/products/laphroaig-10.webp",
    imageAlt: "라프로익 10 보틀과 패키지",
    imageSource: "https://www.laphroaig.com/whiskies/10-year-old",
    verdict: "처음 피트 위스키를 마신다면 큰 가격 차이가 없을 때 국내에서 먼저 경험해보는 편이 안전해요.",
    summary:
      "라프로익 10은 연기, 바다, 약초를 연상시키는 강한 향이 특징입니다. 면세가가 조금 저렴해도 취향을 모르면 한 병 전체가 부담이 될 수 있습니다.",
    dutySpec: "온라인 면세 700ml",
    retailSpec: "국내 주류 매장 픽업 700ml",
    checkpoints: [
      "피트 위스키 경험 여부 확인",
      "가격 차이가 공항 수령 비용보다 큰지 확인",
      "가능하면 잔술이나 작은 용량으로 먼저 경험",
    ],
    paragraphs: [
      "주류 추천에서 가격만 강조하면 취향 실패 비용을 놓치게 됩니다. 라프로익처럼 개성이 강한 제품은 스모키 강도를 최우선 정보로 보여주고, 절감액은 그 다음에 배치하는 편이 합리적입니다.",
      "면세와 국내 픽업 가격 차이가 작다면 가까운 매장에서 구매해 교환이나 상담 편의를 얻는 선택도 가능합니다. 추천 결과는 항상 가장 싼 판매처가 아니라 사용자의 상황에 맞는 구매 방법을 설명해야 합니다.",
    ],
    caution: "주류는 온라인 택배 가격이 아니라 관련 규정을 준수하는 국내 픽업 가격과 비교합니다.",
  },
];
