export type Channel = "duty" | "retail";
export type Unit = "ml" | "g" | "개";

export type CapturedOffer = {
  id: string;
  productId: string;
  channel: Channel;
  source: string;
  url: string;
  price: number;
  shipping: number;
  discount: number;
  volume: number;
  unit: Unit;
  createdAt: number;
};

export type OfferView = {
  id: string;
  channel: Channel;
  source: string;
  url: string;
  price: number;
  shipping: number;
  discount: number;
  volume: number;
  unit: Unit;
  /** 비교 계약 필드. 이 셋이 있어야 공개 비교 후보가 될 수 있다. */
  currency: Currency;
  variantKey: string;
  verification: OfferVerification;
  total: number;
  unitPrice: number;
  condition: string;
  reference?: boolean;
};

/**
 * provenance 는 `verification` 하나뿐이다.
 *
 * 예전에는 같은 사실을 `captured`·`verified` 불리언으로 한 번 더 적어 두고
 * 호출부마다 다른 쪽을 읽었다. 공개 출처 수가 `offer.verified` 로 걸러지면서도
 * 안전했던 유일한 이유는 캡처 매퍼가 그 키를 **우연히** 빠뜨렸기 때문이다.
 * 그 우연이 H-02 의 실제 누수면이었으므로 필드 자체를 없앤다.
 */
export type VerifiedOfferView = OfferView & { verification: "verified" };
export type CapturedOfferView = OfferView & { verification: "captured" };

type Amounts = {
  price: number;
  shipping: number;
  discount: number;
};

type ComparableOffer = {
  channel: Channel;
  total: number;
  unitPrice: number;
  volume: number;
};

export type Currency = "KRW" | "USD";

/** 가격의 출처 등급. 공개 비교는 `verified`만 사용한다. */
export type OfferVerification = "verified" | "captured";

/**
 * 두 제안을 비교해도 되는지 판정하는 데 필요한 전체 필드.
 * `ComparableOffer`만으로는 단위·통화·상품 규격이 달라도 비교가 통과하므로,
 * 공개 비교 후보는 반드시 이 형태를 갖춘다.
 */
export type ContractOffer = ComparableOffer & {
  unit: Unit;
  currency: Currency;
  /** 같은 상품 구성을 가리키는 안정 식별자. 용량은 포함하지 않는다. */
  variantKey: string;
  verification: OfferVerification;
};

export type ComparabilityFailure =
  | "not-verified"
  | "channel-mismatch"
  | "unit-mismatch"
  | "currency-mismatch"
  | "variant-mismatch"
  | "invalid-amount";

/**
 * 공개 비교 결과. `retailPaidTotal`만 실제 결제 가능한 금액이고
 * `dutyEquivalentAtRetailVolume`은 국내 용량으로 환산한 값이라 결제할 수 없다.
 * 이름으로 두 성격을 구분해, 환산값이 절감액으로 저장되는 경로를 막는다.
 */
export type VerifiedComparison<T extends ContractOffer = ContractOffer> = {
  duty: T;
  retail: T;
  comparisonVolume: number;
  retailPaidTotal: number;
  dutyEquivalentAtRetailVolume: number;
  savingsAtRetailVolume: number;
  dutyWins: boolean;
  savingRate: number;
};

const units = new Set<Unit>(["ml", "g", "개"]);

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function isSafeExternalUrl(value: string): boolean {
  if (!value) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function calculateOfferTotal({
  price,
  shipping,
  discount,
}: Amounts): number {
  if (
    !isFiniteNumber(price) ||
    !isFiniteNumber(shipping) ||
    !isFiniteNumber(discount) ||
    price <= 0 ||
    shipping < 0 ||
    discount < 0 ||
    discount >= price + shipping
  ) {
    throw new RangeError("유효한 상품가, 배송비, 할인 금액이 필요합니다.");
  }

  return price + shipping - discount;
}

export function calculateUnitPrice(total: number, volume: number): number {
  if (
    !isFiniteNumber(total) ||
    !isFiniteNumber(volume) ||
    total <= 0 ||
    volume <= 0
  ) {
    throw new RangeError("단위가격 계산에는 0보다 큰 금액과 용량이 필요합니다.");
  }

  return total / volume;
}

export function selectBestUnitOffer<T extends ComparableOffer>(
  offers: T[],
  channel: Channel,
): T | undefined {
  return offers
    .filter((offer) => offer.channel === channel)
    .sort(
      (a, b) =>
        a.unitPrice - b.unitPrice ||
        a.total - b.total ||
        a.volume - b.volume,
    )[0];
}

export function compareEquivalentVolumes<
  TDuty extends ComparableOffer,
  TRetail extends ComparableOffer,
>(duty: TDuty, retail: TRetail) {
  const dutyEquivalent = duty.unitPrice * retail.volume;
  const retailEquivalent = retail.unitPrice * retail.volume;
  const savings = retailEquivalent - dutyEquivalent;
  const savingRate =
    retailEquivalent > 0
      ? Math.round((Math.abs(savings) / retailEquivalent) * 100)
      : 0;

  return {
    comparisonVolume: retail.volume,
    dutyEquivalent,
    retailEquivalent,
    savings,
    dutyWins: savings > 0,
    savingRate,
  };
}

/**
 * 두 제안을 공개 비교에 쓸 수 있는지 판정한다.
 * 통과하면 `null`, 실패하면 첫 번째 실패 사유를 반환한다.
 * 사유를 돌려주는 이유는 UI가 "단위가 달라 비교할 수 없습니다"처럼
 * 구체적으로 안내하고, 테스트가 실패 원인을 단언할 수 있게 하기 위해서다.
 */
/**
 * 검수 여부를 뺀 나머지 계약.
 *
 * 내 입력이 섞인 비교도 채널·금액·단위·통화·규격은 똑같이 지켜야 한다.
 * 그 쪽에서 검수 게이트를 "완화"하는 대신, 게이트가 들어 있는 함수를 아예
 * 부르지 않도록 여기서 나눈다.
 */
export function checkPairShape(
  duty: ContractOffer,
  retail: ContractOffer,
): ComparabilityFailure | null {
  if (duty.channel !== "duty" || retail.channel !== "retail") {
    return "channel-mismatch";
  }
  for (const offer of [duty, retail]) {
    if (
      !isFiniteNumber(offer.total) ||
      !isFiniteNumber(offer.unitPrice) ||
      !isFiniteNumber(offer.volume) ||
      offer.total <= 0 ||
      offer.unitPrice <= 0 ||
      offer.volume <= 0
    ) {
      return "invalid-amount";
    }
  }
  if (duty.unit !== retail.unit) return "unit-mismatch";
  if (duty.currency !== retail.currency) return "currency-mismatch";
  if (duty.variantKey !== retail.variantKey) return "variant-mismatch";

  return null;
}

export function checkComparablePair(
  duty: ContractOffer,
  retail: ContractOffer,
): ComparabilityFailure | null {
  // `not-verified` 가 먼저 걸린다는 우선순위는 UI 가 분기하는 근거이므로
  // 함수를 나눈 뒤에도 구조적으로 유지한다.
  if (duty.verification !== "verified" || retail.verification !== "verified") {
    return "not-verified";
  }
  return checkPairShape(duty, retail);
}

export function isComparablePair(
  duty: ContractOffer,
  retail: ContractOffer,
): boolean {
  return checkComparablePair(duty, retail) === null;
}

/**
 * 계약을 통과한 경우에만 공개 비교를 만든다.
 * 계약 실패는 `0원 절감`이 아니라 `null` 비교 상태다.
 */
export function buildVerifiedComparison<T extends ContractOffer>(
  duty: T,
  retail: T,
): VerifiedComparison<T> | null {
  if (checkComparablePair(duty, retail) !== null) return null;

  const comparisonVolume = retail.volume;
  const dutyEquivalentAtRetailVolume = duty.unitPrice * comparisonVolume;
  const retailPaidTotal = retail.total;
  const savingsAtRetailVolume = retailPaidTotal - dutyEquivalentAtRetailVolume;

  return {
    duty,
    retail,
    comparisonVolume,
    retailPaidTotal,
    dutyEquivalentAtRetailVolume,
    savingsAtRetailVolume,
    dutyWins: savingsAtRetailVolume > 0,
    savingRate:
      retailPaidTotal > 0
        ? Math.round(
            (Math.abs(savingsAtRetailVolume) / retailPaidTotal) * 100,
          )
        : 0,
  };
}

/**
 * 공개 비교 후보를 고른다. `verified` 제안만 사용하며,
 * 어느 한쪽이라도 없거나 계약이 실패하면 `null`을 반환한다.
 */
export function selectVerifiedComparison<T extends ContractOffer>(
  offers: readonly T[],
): VerifiedComparison<T> | null {
  const verified = offers.filter((offer) => offer.verification === "verified");
  const duty = selectBestUnitOffer(verified, "duty");
  const retail = selectBestUnitOffer(verified, "retail");
  if (!duty || !retail) return null;

  return buildVerifiedComparison(duty, retail);
}

/**
 * 내 입력이 섞인 비교의 금액.
 *
 * `number & { ... }` 같은 phantom 브랜드로는 부족하다 — 교집합 타입은 각
 * 구성요소에 대입되므로 `verdictFor(gap)`도 `formatWon(gap)`도 그대로
 * 컴파일된다. 막으려면 애초에 `number`가 아니어야 한다.
 *
 * 그래서 감싼다. 꺼내려면 `sessionGapAmount()`를 명시적으로 불러야 하고,
 * 그 호출이 코드 리뷰에서 보이는 지점이 된다. 이름만 다르게 하는 방식은
 * 객체 통째 대입만 막을 뿐, 필드 하나를 꺼내 공개 결론 함수에 넘기는
 * 경로 — 사용자가 타이핑한 숫자로 헤드라인을 만드는 바로 그 경로 — 는
 * 열어 둔다.
 */
export type SessionGap = { readonly sessionGapAmount: number };

/** 감싼 금액을 꺼낸다. 표시 외의 용도로 부르면 안 된다. */
export function sessionGapAmount(gap: SessionGap): number {
  return gap.sessionGapAmount;
}

/**
 * 내 입력이 섞인 비교. `VerifiedComparison` 과 **별개 타입**이다.
 *
 * `savingsAtRetailVolume` 이 아니라 `differenceAtRetailVolume` 이라 구조적으로
 * 대입되지 않고, 승패를 뜻하는 필드가 아예 없다. 이 패널은 판정을 내리지
 * 않으므로 `dutyWins` 는 소비자가 없고 복사·붙여넣기 대상으로만 존재한다.
 */
export type PersonalComparison = {
  duty: OfferView;
  retail: OfferView;
  comparisonVolume: number;
  retailPaidTotal: SessionGap;
  dutyEquivalentAtRetailVolume: SessionGap;
  differenceAtRetailVolume: SessionGap;
  includesCapturedSide: true;
};

/**
 * 내 입력이 섞인 비교를 만든다.
 *
 * 양쪽 다 검수면 `null` 이다 — 그 쌍은 공개 빌더의 것이고, 두 빌더는 입력
 * 공간을 나눠 갖는다. 한 값이 두 경로로 들어가면 어느 쪽 규칙을 따르는지
 * 호출부마다 달라진다.
 */
export function buildPersonalComparison(
  duty: OfferView,
  retail: OfferView,
): PersonalComparison | null {
  if (duty.verification === "verified" && retail.verification === "verified") {
    return null;
  }
  if (checkPairShape(duty, retail) !== null) return null;

  const comparisonVolume = retail.volume;
  const dutyEquivalentAtRetailVolume = duty.unitPrice * comparisonVolume;
  const retailPaidTotal = retail.total;

  return {
    duty,
    retail,
    comparisonVolume,
    retailPaidTotal: { sessionGapAmount: retailPaidTotal },
    dutyEquivalentAtRetailVolume: {
      sessionGapAmount: dutyEquivalentAtRetailVolume,
    },
    differenceAtRetailVolume: {
      sessionGapAmount: retailPaidTotal - dutyEquivalentAtRetailVolume,
    },
    includesCapturedSide: true,
  };
}

/** 내 입력이 섞인 비교 후보를 고른다. 캡처가 하나도 없으면 `null` 이다. */
export function selectPersonalComparison(
  offers: readonly OfferView[],
): PersonalComparison | null {
  if (!offers.some((offer) => offer.verification === "captured")) return null;
  const candidates = [...offers];
  const duty = selectBestUnitOffer(candidates, "duty");
  const retail = selectBestUnitOffer(candidates, "retail");
  if (!duty || !retail) return null;

  return buildPersonalComparison(duty, retail);
}

export function parseCapturedOffers(
  raw: string | null,
  productIds: ReadonlySet<string>,
): CapturedOffer[] {
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  return parsed.filter((value): value is CapturedOffer => {
    if (!isRecord(value)) return false;

    const channel = value.channel;
    const unit = value.unit;
    const url = value.url;
    const totalBeforeDiscount =
      isFiniteNumber(value.price) && isFiniteNumber(value.shipping)
        ? value.price + value.shipping
        : Number.NaN;

    return (
      typeof value.id === "string" &&
      typeof value.productId === "string" &&
      productIds.has(value.productId) &&
      (channel === "duty" || channel === "retail") &&
      typeof value.source === "string" &&
      value.source.trim().length > 0 &&
      typeof url === "string" &&
      isSafeExternalUrl(url) &&
      isFiniteNumber(value.price) &&
      value.price > 0 &&
      isFiniteNumber(value.shipping) &&
      value.shipping >= 0 &&
      isFiniteNumber(value.discount) &&
      value.discount >= 0 &&
      value.discount < totalBeforeDiscount &&
      isFiniteNumber(value.volume) &&
      value.volume > 0 &&
      typeof unit === "string" &&
      units.has(unit as Unit) &&
      isFiniteNumber(value.createdAt) &&
      value.createdAt > 0
    );
  });
}

/** 국내 대표 판매처 선호의 허용오차. 둘 다 통과해야 한다. */
export const DOMESTIC_PREFERENCE_MAX_GAP = 3_000;
export const DOMESTIC_PREFERENCE_MAX_RATE = 0.05;

/**
 * 국내 대표 제안을 고른다.
 *
 * 단위가격이 가장 낮은 곳을 기본으로 하되, 선호 판매처가 근소한 차이면
 * 그쪽을 쓴다. 차이는 **실제로 사게 될 구성의 용량**으로 잰다 — 예전에는
 * 지는 쪽 용량으로 계산해서, 선호 판매처가 더 큰 용량을 팔면 화면에 뜨는
 * 금액이 의도한 3,000원 갭보다 몇 배 커질 수 있었다.
 */
export function selectPreferredDomesticOffer<T extends ComparableOffer>(
  offers: readonly T[],
  isPreferred: (offer: T) => boolean,
): T | undefined {
  const domestic = [...offers]
    .filter((offer) => offer.channel === "retail")
    .sort((a, b) => a.unitPrice - b.unitPrice || a.volume - b.volume);

  const lowest = domestic[0];
  if (!lowest) return undefined;

  const preferred = domestic.find(isPreferred);
  if (!preferred || preferred === lowest) return lowest;

  const unitGap = preferred.unitPrice - lowest.unitPrice;
  // 선호 판매처의 구성을 살 때 실제로 더 내는 금액.
  const gapAtPurchaseVolume = unitGap * preferred.volume;
  const gapRate =
    lowest.unitPrice > 0 ? unitGap / lowest.unitPrice : Number.POSITIVE_INFINITY;

  return gapAtPurchaseVolume <= DOMESTIC_PREFERENCE_MAX_GAP &&
    gapRate <= DOMESTIC_PREFERENCE_MAX_RATE
    ? preferred
    : lowest;
}

export type ComparisonVerdict = "duty" | "retail" | "tie";

/**
 * 절감액 하나에서 결론을 낸다.
 *
 * 임계값은 **양쪽에 대칭으로** 적용한다. 예전에는 면세 쪽만 임계값을 두고
 * 국내 쪽은 0원만 넘으면 우위로 판정해, 같은 화면의 두 문구가 서로 다른
 * 결론을 말했다 — 절감액이 -10,000 ~ 0원 구간에서 한쪽은 "차이가 작다",
 * 다른 쪽은 "국내 우위" 였다.
 */
export function verdictFor(
  savings: number,
  threshold: number,
): ComparisonVerdict {
  if (!Number.isFinite(savings)) return "tie";
  if (Math.abs(savings) <= threshold) return "tie";
  return savings > 0 ? "duty" : "retail";
}
