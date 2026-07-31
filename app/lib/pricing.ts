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
