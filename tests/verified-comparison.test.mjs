import assert from "node:assert/strict";
import test from "node:test";
import {
  buildVerifiedComparison,
  checkComparablePair,
  isComparablePair,
  selectVerifiedComparison,
} from "../app/lib/pricing.ts";

/** 계약을 통과하는 기준 쌍. 각 테스트는 필요한 필드만 덮어쓴다. */
function dutyOffer(overrides = {}) {
  return {
    channel: "duty",
    total: 100_000,
    unitPrice: 1_000,
    volume: 100,
    unit: "ml",
    currency: "KRW",
    variantKey: "anr-serum",
    verification: "verified",
    ...overrides,
  };
}

function retailOffer(overrides = {}) {
  return {
    channel: "retail",
    total: 75_000,
    unitPrice: 1_500,
    volume: 50,
    unit: "ml",
    currency: "KRW",
    variantKey: "anr-serum",
    verification: "verified",
    ...overrides,
  };
}

test("계약을 통과한 검수 쌍만 공개 비교를 만든다", () => {
  assert.equal(checkComparablePair(dutyOffer(), retailOffer()), null);
  assert.equal(isComparablePair(dutyOffer(), retailOffer()), true);

  const comparison = buildVerifiedComparison(dutyOffer(), retailOffer());
  assert.deepEqual(comparison, {
    duty: dutyOffer(),
    retail: retailOffer(),
    comparisonVolume: 50,
    retailPaidTotal: 75_000,
    dutyEquivalentAtRetailVolume: 50_000,
    savingsAtRetailVolume: 25_000,
    dutyWins: true,
    savingRate: 33,
  });
});

test("사용자 직접 입력이 섞인 쌍은 공개 비교 후보가 아니다", () => {
  assert.equal(
    checkComparablePair(dutyOffer({ verification: "captured" }), retailOffer()),
    "not-verified",
  );
  assert.equal(
    checkComparablePair(dutyOffer(), retailOffer({ verification: "captured" })),
    "not-verified",
  );
  assert.equal(
    buildVerifiedComparison(
      dutyOffer({ verification: "captured" }),
      retailOffer(),
    ),
    null,
  );
});

test("단위·통화·상품 규격이 다르면 비교를 거부한다", () => {
  assert.equal(
    checkComparablePair(dutyOffer(), retailOffer({ unit: "g" })),
    "unit-mismatch",
  );
  assert.equal(
    checkComparablePair(dutyOffer(), retailOffer({ currency: "USD" })),
    "currency-mismatch",
  );
  assert.equal(
    checkComparablePair(dutyOffer(), retailOffer({ variantKey: "anr-eye" })),
    "variant-mismatch",
  );
});

test("채널이 어긋나거나 금액이 유효하지 않으면 비교를 거부한다", () => {
  assert.equal(
    checkComparablePair(dutyOffer({ channel: "retail" }), retailOffer()),
    "channel-mismatch",
  );
  assert.equal(
    checkComparablePair(dutyOffer(), retailOffer({ volume: 0 })),
    "invalid-amount",
  );
  assert.equal(
    checkComparablePair(dutyOffer({ total: Number.NaN }), retailOffer()),
    "invalid-amount",
  );
});

test("계약 실패는 0원 절감이 아니라 비교 없음이다", () => {
  const mismatched = buildVerifiedComparison(
    dutyOffer(),
    retailOffer({ unit: "g" }),
  );
  assert.equal(mismatched, null);
});

test("환산가는 실제 결제액과 다른 이름으로 분리해 노출한다", () => {
  const comparison = buildVerifiedComparison(dutyOffer(), retailOffer());

  // 국내 실제 결제액은 그대로 결제할 수 있는 금액이다.
  assert.equal(comparison.retailPaidTotal, retailOffer().total);
  // 면세 환산가는 100ml 상품을 50ml로 환산한 값이라 결제할 수 없다.
  assert.notEqual(comparison.dutyEquivalentAtRetailVolume, dutyOffer().total);
  assert.equal(
    comparison.savingsAtRetailVolume,
    comparison.retailPaidTotal - comparison.dutyEquivalentAtRetailVolume,
  );
});

test("C1~C8 입력 상태에서 공개 비교 생성 여부가 결정된다", () => {
  const duty = dutyOffer();
  const retail = retailOffer();
  const capturedDuty = dutyOffer({ verification: "captured" });
  const capturedRetail = retailOffer({ verification: "captured" });

  // C1 가격 없음
  assert.equal(selectVerifiedComparison([]), null);
  // C2 검수 면세만
  assert.equal(selectVerifiedComparison([duty]), null);
  // C3 검수 국내만
  assert.equal(selectVerifiedComparison([retail]), null);
  // C4 직접 입력만
  assert.equal(selectVerifiedComparison([capturedDuty, capturedRetail]), null);
  // C5 검수 면세 + 직접 입력 국내
  assert.equal(selectVerifiedComparison([duty, capturedRetail]), null);
  // C6 직접 입력 면세 + 검수 국내
  assert.equal(selectVerifiedComparison([capturedDuty, retail]), null);
  // C7 검수 양쪽이나 계약 실패
  assert.equal(
    selectVerifiedComparison([duty, retailOffer({ unit: "g" })]),
    null,
  );
  // C8 검수 양쪽 + 계약 통과
  assert.notEqual(selectVerifiedComparison([duty, retail]), null);
});

test("공개 비교 후보 선정은 검수 제안 중 단위가격이 가장 낮은 쪽을 쓴다", () => {
  const cheapDuty = dutyOffer({ unitPrice: 800, total: 80_000 });
  const pricyDuty = dutyOffer({ unitPrice: 1_200, total: 120_000 });
  // 직접 입력이 더 싸더라도 공개 비교 후보로 올라오지 않는다.
  const cheapestCaptured = dutyOffer({
    unitPrice: 100,
    total: 10_000,
    verification: "captured",
  });

  const comparison = selectVerifiedComparison([
    pricyDuty,
    cheapDuty,
    cheapestCaptured,
    retailOffer(),
  ]);

  assert.equal(comparison.duty.unitPrice, 800);
});
