import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPersonalComparison,
  buildVerifiedComparison,
  checkComparablePair,
  checkPairShape,
  selectPersonalComparison,
  sessionGapAmount,
} from "../app/lib/pricing.ts";

function offer(overrides = {}) {
  return {
    id: "o1",
    channel: "duty",
    source: "신라면세점",
    url: "https://example.com/o1",
    price: 50_000,
    shipping: 0,
    discount: 0,
    volume: 50,
    unit: "ml",
    currency: "KRW",
    variantKey: "anr",
    verification: "verified",
    total: 50_000,
    unitPrice: 1_000,
    condition: "",
    ...overrides,
  };
}

const verifiedDuty = offer();
const capturedRetail = offer({
  id: "c1",
  channel: "retail",
  source: "쿠팡",
  verification: "captured",
  total: 30_000,
  unitPrice: 600,
});
const verifiedRetail = offer({
  id: "o2",
  channel: "retail",
  source: "쿠팡",
  total: 75_000,
  unitPrice: 1_500,
});

test("두 빌더는 입력 공간을 나눠 갖는다", () => {
  // 양쪽 다 검수인 쌍은 공개 빌더의 것이다. 개인 빌더가 같은 쌍을 받으면
  // 같은 값이 두 규칙을 동시에 따르게 되고, 어느 쪽인지 호출부마다 갈린다.
  assert.equal(buildPersonalComparison(verifiedDuty, verifiedRetail), null);
  assert.ok(buildVerifiedComparison(verifiedDuty, verifiedRetail));

  // 한쪽이 캡처면 반대다.
  assert.ok(buildPersonalComparison(verifiedDuty, capturedRetail));
  assert.equal(buildVerifiedComparison(verifiedDuty, capturedRetail), null);
});

test("검수 게이트만 빠지고 나머지 계약은 그대로 적용된다", () => {
  const wrongUnit = { ...capturedRetail, unit: "g" };
  const wrongCurrency = { ...capturedRetail, currency: "USD" };
  const wrongVariant = { ...capturedRetail, variantKey: "other" };
  const wrongAmount = { ...capturedRetail, total: 0 };

  for (const bad of [wrongUnit, wrongCurrency, wrongVariant, wrongAmount]) {
    assert.equal(buildPersonalComparison(verifiedDuty, bad), null);
  }
});

test("검수 실패 사유의 우선순위가 분리 후에도 유지된다", () => {
  // UI 가 "검수 가격이 없습니다" 와 "단위가 다릅니다" 를 다르게 안내하므로
  // not-verified 가 먼저 걸려야 한다.
  const capturedWrongUnit = { ...capturedRetail, unit: "g" };
  assert.equal(
    checkComparablePair(verifiedDuty, capturedWrongUnit),
    "not-verified",
  );
  // 모양 검사만 부르면 실제 모양 문제가 드러난다.
  assert.equal(checkPairShape(verifiedDuty, capturedWrongUnit), "unit-mismatch");
});

test("개인 비교 금액은 감싸져 있어 공개 결론 함수에 넘어가지 않는다", () => {
  const personal = buildPersonalComparison(verifiedDuty, capturedRetail);
  assert.ok(personal);

  // 원시 숫자가 아니다. 꺼내려면 명시적으로 불러야 한다.
  assert.equal(typeof personal.differenceAtRetailVolume, "object");
  assert.equal(typeof sessionGapAmount(personal.differenceAtRetailVolume), "number");

  // 승패 필드가 없다 — 이 패널은 판정을 내리지 않는다.
  assert.equal("dutyWins" in personal, false);
  assert.equal("savingsAtRetailVolume" in personal, false);
  assert.equal("savingRate" in personal, false);
  assert.equal(personal.includesCapturedSide, true);
});

test("환산은 공개 비교와 같은 방식으로 한다", () => {
  const personal = buildPersonalComparison(verifiedDuty, capturedRetail);
  // 국내 용량 50ml 기준: 면세 환산 1,000 × 50 = 50,000, 국내 실결제 30,000
  assert.equal(sessionGapAmount(personal.dutyEquivalentAtRetailVolume), 50_000);
  assert.equal(sessionGapAmount(personal.retailPaidTotal), 30_000);
  assert.equal(sessionGapAmount(personal.differenceAtRetailVolume), -20_000);
});

test("캡처가 없으면 개인 비교를 만들지 않는다", () => {
  assert.equal(selectPersonalComparison([verifiedDuty, verifiedRetail]), null);
  assert.equal(selectPersonalComparison([]), null);
});

test("캡처가 있으면 단위가 최저를 골라 비교한다", () => {
  const personal = selectPersonalComparison([
    verifiedDuty,
    verifiedRetail,
    capturedRetail,
  ]);
  assert.ok(personal);
  // 단위가가 더 낮은 캡처 쪽이 국내 후보로 뽑힌다.
  assert.equal(personal.retail.verification, "captured");
});
