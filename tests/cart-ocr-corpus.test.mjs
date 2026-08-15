import assert from "node:assert/strict";
import test from "node:test";
import { extractCartFields } from "../app/lib/cart-ocr.ts";

/**
 * OCR-01a 파서 회귀 corpus.
 *
 * 여기 있는 사례는 전부 예전 파서가 **높은 신뢰도로 틀린 금액을 자동 입력**
 * 하던 입력이다. 값이 맞거나, 맞출 수 없으면 확인 필요 상태여야 한다.
 */
const catalog = [
  {
    id: "anr",
    brand: "에스티 로더",
    name: "어드밴스드 나이트 리페어",
    unit: "ml",
    defaultVolume: 50,
  },
];

const header = "쿠팡\n에스티 로더 어드밴스드 나이트 리페어 50ml";

function parse(body) {
  return extractCartFields(`${header}\n${body}`, catalog);
}

test("할부 안내가 붙어도 결제 총액을 고른다", () => {
  // 예전에는 줄의 마지막 금액을 골라 월 할부금 7,233원이 결제가가 됐다.
  const sameLine = parse(
    "최종 결제금액 86,800원 (12개월 무이자 할부 시 월 7,233원)",
  );
  assert.equal(sameLine.price, 86_800);
  assert.ok(sameLine.ambiguities.includes("installment-detected"));

  // 할부금이 총액보다 앞에 오는 배치도 같은 결과여야 한다.
  assert.equal(parse("최종 결제금액 월 7,233원 (총 86,800원)").price, 86_800);
  assert.equal(parse("최종 결제금액 86,800원 · 7,233원/월").price, 86_800);
});

test("배송지 우편번호를 결제가로 읽지 않는다", () => {
  // `최종` 뒤에 결제/결재가 없으면 최종가 줄이 아니다.
  const result = parse("상품금액 92,000원\n최종 배송지 서울시 강남구 12345");

  assert.equal(result.price, 92_000);
  assert.equal(result.usedFinalPrice, false);
});

test("주문번호·전화번호는 금액이 아니다", () => {
  // 통화 표기가 없는 숫자는 금액으로 보지 않는다.
  assert.equal(parse("주문금액 20260802\n상품금액 92,000원").price, 92_000);
  assert.equal(
    parse("상품금액 92,000원 문의 010-1234-5678").price,
    92_000,
  );
  assert.equal(
    extractCartFields("주문번호 2026073112345678\n연락처 010-1234-5678", catalog)
      .price,
    null,
  );
});

test("긴 숫자열 안의 일부를 금액으로 잘라내지 않는다", () => {
  assert.equal(parse("승인번호 123456789012원").price, null);
  assert.equal(parse("상품금액 92,000원").price, 92_000);
});

test("다수량·묶음 표기는 확인 필요로 표시한다", () => {
  for (const body of [
    "최종 결제금액 184,000원\n수량 2개",
    "1+1 행사\n최종 결제금액 184,000원",
    "최종 결제금액 184,000원 x2",
  ]) {
    assert.ok(
      parse(body).ambiguities.includes("quantity-detected"),
      `${body} 는 수량 확인이 필요하다`,
    );
  }

  // 단품이면 확인 요구가 붙지 않는다.
  assert.deepEqual(parse("최종 결제금액 92,000원").ambiguities, []);
});

test("구성요소가 최종가와 맞지 않으면 확인 필요로 표시한다", () => {
  const inconsistent = parse(
    "상품금액 92,000원\n배송비 3,000원\n최종 결제금액 86,800원",
  );
  assert.ok(inconsistent.ambiguities.includes("total-composition-unclear"));

  const consistent = parse(
    "상품금액 92,000원\n쿠폰 할인 5,200원\n배송비 무료\n최종 결제금액 86,800원",
  );
  assert.deepEqual(consistent.ambiguities, []);
});

test("최종가를 쓸 때 배송비·할인을 다시 빼지 않는다", () => {
  // 최종가는 이미 배송비와 할인을 포함한다. 구성요소를 그대로 두면
  // price + shipping - discount 계산에서 이중 차감이 된다.
  const result = parse(
    "상품금액 92,000원\n쿠폰 할인 5,200원\n배송비 무료\n최종 결제금액 86,800원",
  );

  assert.equal(result.price, 86_800);
  assert.equal(result.shipping, 0);
  assert.equal(result.discount, 0);
});

test("읽지 못한 배송비·할인은 0이 아니라 null이다", () => {
  const result = parse("상품금액 92,000원");

  assert.equal(result.price, 92_000);
  assert.equal(result.shipping, null);
  assert.equal(result.discount, null);
});

test("용량은 인식했을 때만 채우고 기본값으로 위장하지 않는다", () => {
  // 예전에는 용량을 못 읽으면 카탈로그 기본값(50ml)을 넣고도
  // "용량 인식 완료"로 계상해 1,000ml 상품이 50ml로 저장됐다.
  const missing = extractCartFields(
    "쿠팡\n에스티 로더 어드밴스드 나이트 리페어\n최종 결제금액 86,800원",
    catalog,
  );
  assert.equal(missing.volume, null);
  assert.ok(!missing.recognizedFields.includes("용량"));
  assert.equal(missing.confidence, 85);

  // 천 단위 구분자가 붙은 용량도 읽는다.
  const large = extractCartFields(
    "쿠팡\n에스티 로더 어드밴스드 나이트 리페어 1,000ml\n최종 결제금액 168,000원",
    catalog,
  );
  assert.equal(large.volume, 1_000);
});
