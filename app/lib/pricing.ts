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
  total: number;
  unitPrice: number;
  condition: string;
  captured: boolean;
  verified?: boolean;
  reference?: boolean;
};

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
export type VerifiedComparison = {
  duty: ContractOffer;
  retail: ContractOffer;
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
export function checkComparablePair(
  duty: ContractOffer,
  retail: ContractOffer,
): ComparabilityFailure | null {
  if (duty.verification !== "verified" || retail.verification !== "verified") {
    return "not-verified";
  }
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
export function buildVerifiedComparison(
  duty: ContractOffer,
  retail: ContractOffer,
): VerifiedComparison | null {
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
export function selectVerifiedComparison(
  offers: readonly ContractOffer[],
): VerifiedComparison | null {
  const verified = offers.filter((offer) => offer.verification === "verified");
  const duty = selectBestUnitOffer(verified, "duty");
  const retail = selectBestUnitOffer(verified, "retail");
  if (!duty || !retail) return null;

  return buildVerifiedComparison(duty, retail);
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
