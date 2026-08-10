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

const liquorCatalog = [
  {
    id: "balvenie-doublewood-12",
    brand: "발베니",
    name: "더블우드 12년",
    unit: "ml",
    defaultVolume: 700,
  },
  {
    id: "laphroaig-10",
    brand: "라프로익",
    name: "라프로익 10년",
    unit: "ml",
    defaultVolume: 700,
  },
];

test("카탈로그에 없는 상품은 productId 를 null 로 둔다", () => {
  // 예전에는 UI 가 null 을 건너뛰어 미인식 캡처가 직전 기본 상품에 귀속됐다.
  const result = extractCartFields(
    `쿠팡\n랑콤 제니피끄 세럼 30ml\n최종 결제금액 120,000원`,
    catalog,
  );
  assert.equal(result.productId, null);
  assert.ok(!result.recognizedFields.includes("상품"));
});

test("주류 캡처는 주류 카탈로그로만 매칭한다", () => {
  const text = `쿠팡\n발베니 더블우드 12년 700ml\n최종 결제금액 135,000원`;

  // 화장품 카탈로그로 대조하면 발베니가 어떤 화장품에도 붙지 않는다.
  const wrong = extractCartFields(text, catalog);
  assert.equal(wrong.productId, null);

  // 주류 카탈로그로 대조하면 제대로 인식한다.
  const right = extractCartFields(text, liquorCatalog);
  assert.equal(right.productId, "balvenie-doublewood-12");
  assert.equal(right.volume, 700);
});

test("장바구니에 상품이 둘이면 다른 행의 가격을 붙이지 않는다", () => {
  // H-06. 예전에는 전체 텍스트에서 점수가 가장 높은 상품 하나만 고르고
  // 최종 결제금액을 거기에 붙였다. 그 금액은 두 상품의 합계다.
  const result = extractCartFields(
    `쿠팡\n에스티 로더 어드밴스드 나이트 리페어 50ml\n상품금액 92,000원\n` +
      `SK-II 페이셜 트리트먼트 에센스 160ml\n상품금액 190,000원\n` +
      `최종 결제금액 282,000원`,
    catalog,
  );

  assert.equal(result.productId, null);
  assert.equal(result.price, null);
  assert.ok(result.ambiguities.includes("multiple-products"));
  // 어느 상품들이 보였는지는 알려줘야 사용자가 고를 수 있다.
  assert.deepEqual(
    result.productCandidates.map((candidate) => candidate.id).sort(),
    ["anr", "skii"],
  );
});

test("상품이 하나면 예전처럼 최종 결제가를 쓴다", () => {
  const result = extractCartFields(
    `쿠팡\n에스티 로더 어드밴스드 나이트 리페어 50ml\n최종 결제금액 86,800원`,
    catalog,
  );
  assert.equal(result.productId, "anr");
  assert.equal(result.price, 86_800);
  assert.equal(result.ambiguities.includes("multiple-products"), false);
});

test("판매처는 목록 순서가 아니라 상품 근처에 있는 쪽을 고른다", () => {
  // L-16. 예전에는 sellerPatterns 배열에서 앞선 패턴이 이겨, 화면 어디에
  // 있든 상관없이 쿠팡이 롯데면세점을 이겼다.
  const result = extractCartFields(
    `롯데면세점\nSK-II 페이셜 트리트먼트 에센스 160ml\n상품금액 190,000원\n` +
      `쿠팡에서 더 알아보기`,
    catalog,
  );

  assert.equal(result.sourceName, "롯데면세점");
  assert.equal(result.channel, "duty");
});

test("채널이 다른 판매처가 함께 보이면 확인을 요구한다", () => {
  const result = extractCartFields(
    `쿠팡 92,000원\n롯데면세점 88,000원\n에스티 로더 어드밴스드 나이트 리페어 50ml`,
    catalog,
  );
  assert.ok(result.ambiguities.includes("seller-conflict"));
});

test("provenance는 실제로 읽은 값에서만 recognized가 된다", () => {
  // H-07. 예전에는 카탈로그 기본 용량을 채우고도 "용량 인식 완료"라고 했다.
  const withVolume = extractCartFields(
    `쿠팡\n에스티 로더 어드밴스드 나이트 리페어 50ml\n최종 결제금액 86,800원`,
    catalog,
  );
  assert.equal(withVolume.provenance.volume, "recognized");
  assert.ok(withVolume.recognizedFields.includes("용량"));

  const withoutVolume = extractCartFields(
    `쿠팡\n에스티 로더 어드밴스드 나이트 리페어\n최종 결제금액 86,800원`,
    catalog,
  );
  assert.equal(withoutVolume.volume, null);
  assert.equal(withoutVolume.provenance.volume, "unknown");
  assert.equal(withoutVolume.recognizedFields.includes("용량"), false);
  // 기본값 50ml 로 채우지 않는다.
  assert.equal(withoutVolume.provenance.productId, "recognized");
});

test("좌표가 있는 줄을 받으면 순서를 좌표로 정한다", () => {
  // OCR 은 줄을 읽는 순서를 보장하지 않는다. top 으로 다시 세운다.
  const result = extractCartFields(
    [
      { text: "최종 결제금액 86,800원", top: 300 },
      { text: "쿠팡", top: 100 },
      { text: "에스티 로더 어드밴스드 나이트 리페어 50ml", top: 200 },
    ],
    catalog,
  );

  assert.equal(result.sourceName, "쿠팡");
  assert.equal(result.productId, "anr");
  assert.equal(result.price, 86_800);
});

test("장바구니 밑의 추천 상품 띠가 가격을 가로채지 않는다", () => {
  // 아래에서 위로만 훑던 때는 띠에 있는 마지막 `판매가` 가 이겼다. 띠의
  // 상품은 카탈로그에 없으므로 상품 중복 판정에도 걸리지 않아, 179,000원짜리
  // 에센스가 12,900원으로 저장되고도 모호성 없이 신뢰도 100 이 됐다.
  const result = extractCartFields(
    `신라인터넷면세점 장바구니\nSK-II 페이셜 트리트먼트 에센스 230ml\n회원가 179,000원\n` +
      `함께 보면 좋은 상품\n아비브 어성초 토너 210ml\n판매가 12,900원`,
    catalog,
  );

  assert.equal(result.productId, "skii");
  assert.equal(result.price, 179_000);
  // 용량도 띠에서 새어 들어오지 않는다. 카탈로그 기본값(160)에 210 이 더
  // 가깝다는 이유로 이기던 자리다.
  assert.equal(result.volume, 230);
});

test("배송비·할인도 상품 줄에 가까운 값을 쓴다", () => {
  const result = extractCartFields(
    `쿠팡\n에스티 로더 어드밴스드 나이트 리페어 50ml\n상품금액 92,000원\n` +
      `쿠폰 할인 5,200원\n배송비 3,000원\n` +
      `함께 보면 좋은 상품\n다른 상품\n쿠폰 할인 30,000원\n배송비 무료`,
    catalog,
  );

  assert.equal(result.price, 92_000);
  assert.equal(result.discount, 5_200);
  assert.equal(result.shipping, 3_000);
});
