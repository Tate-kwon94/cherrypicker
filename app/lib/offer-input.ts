import {
  calculateOfferTotal,
  calculateUnitPrice,
  isSafeExternalUrl,
} from "./pricing.ts";

export const offerStatuses = ["draft", "approved", "rejected"] as const;
export type OfferStatus = (typeof offerStatuses)[number];
export type OfferCategory = "cosmetics" | "liquor";
export type OfferChannel = "duty" | "retail";
export type OfferUnit = "ml" | "g" | "개";

export type OfferDraft = {
  productId: string;
  brand: string;
  productName: string;
  category: OfferCategory;
  sourceName: string;
  sourceUrl: string;
  channel: OfferChannel;
  listPrice: number;
  shipping: number;
  instantDiscount: number;
  finalPrice: number;
  volume: number;
  unit: OfferUnit;
  observedAt: number;
  expiresAt: number;
  notes: string;
};

export class OfferValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OfferValidationError";
  }
}

export function parseOfferDraft(
  input: unknown,
  now = Date.now(),
): OfferDraft {
  if (!input || typeof input !== "object") {
    throw new OfferValidationError("가격 정보를 확인해 주세요.");
  }

  const payload = input as Record<string, unknown>;
  const brand = requiredText(payload.brand, "브랜드", 80);
  const productName = requiredText(payload.productName, "상품명", 160);
  const category = enumValue(
    payload.category,
    ["cosmetics", "liquor"] as const,
    "카테고리",
  );
  const unit = enumValue(payload.unit, ["ml", "g", "개"] as const, "단위");
  const sourceName = requiredText(payload.sourceName, "판매처", 100);
  const sourceUrl = requiredText(payload.sourceUrl, "원본 URL", 1000);
  if (!isSafeExternalUrl(sourceUrl)) {
    throw new OfferValidationError("원본 URL은 http 또는 https 주소여야 합니다.");
  }

  const channel = enumValue(
    payload.channel,
    ["duty", "retail"] as const,
    "판매 채널",
  );
  const listPrice = integerValue(payload.listPrice, "상품가", 1);
  const shipping = integerValue(payload.shipping, "배송비", 0);
  const instantDiscount = integerValue(
    payload.instantDiscount,
    "즉시할인",
    0,
  );
  const finalPrice = calculateOfferTotal({
    price: listPrice,
    shipping,
    discount: instantDiscount,
  });
  const volume = numberValue(payload.volume, "용량", 0.01);
  calculateUnitPrice(finalPrice, volume);

  const observedAt = timestampValue(payload.observedAt, "가격 확인 시각");
  const expiresAt = timestampValue(payload.expiresAt, "가격 만료 시각");
  if (observedAt > now + 5 * 60 * 1000) {
    throw new OfferValidationError("가격 확인 시각은 미래일 수 없습니다.");
  }
  if (expiresAt <= now) {
    throw new OfferValidationError("가격 만료 시각은 현재보다 뒤여야 합니다.");
  }
  if (expiresAt <= observedAt) {
    throw new OfferValidationError("가격 만료 시각은 확인 시각보다 뒤여야 합니다.");
  }
  if (expiresAt - observedAt > 90 * 24 * 60 * 60 * 1000) {
    throw new OfferValidationError("가격 유효기간은 최대 90일입니다.");
  }

  const requestedProductId = optionalText(payload.productId, 100);
  const productId = requestedProductId
    ? normalizeProductId(requestedProductId)
    : normalizeProductId(`${brand}-${productName}`);

  return {
    productId,
    brand,
    productName,
    category,
    sourceName,
    sourceUrl,
    channel,
    listPrice,
    shipping,
    instantDiscount,
    finalPrice,
    volume,
    unit,
    observedAt,
    expiresAt,
    notes: optionalText(payload.notes, 500),
  };
}

export function normalizeProductId(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^a-z0-9가-힣]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  if (!normalized) {
    throw new OfferValidationError("상품 ID를 만들 수 없습니다.");
  }
  return normalized;
}

export function isApprovedOfferActive(
  status: OfferStatus,
  expiresAt: number,
  now = Date.now(),
): boolean {
  return status === "approved" && Number.isFinite(expiresAt) && expiresAt > now;
}

function requiredText(value: unknown, label: string, maxLength: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) throw new OfferValidationError(`${label}을(를) 입력해 주세요.`);
  if (text.length > maxLength) {
    throw new OfferValidationError(`${label}은(는) ${maxLength}자 이하여야 합니다.`);
  }
  return text;
}

function optionalText(value: unknown, maxLength: number): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (text.length > maxLength) {
    throw new OfferValidationError(`입력값은 ${maxLength}자 이하여야 합니다.`);
  }
  return text;
}

function integerValue(
  value: unknown,
  label: string,
  minimum: number,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum) {
    throw new OfferValidationError(`${label}을(를) 올바른 원 단위로 입력해 주세요.`);
  }
  return parsed;
}

function numberValue(value: unknown, label: string, minimum: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum) {
    throw new OfferValidationError(`${label}을(를) 올바르게 입력해 주세요.`);
  }
  return parsed;
}

function timestampValue(value: unknown, label: string): number {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Date.parse(value)
        : Number.NaN;
  if (!Number.isFinite(parsed)) {
    throw new OfferValidationError(`${label}을(를) 올바르게 입력해 주세요.`);
  }
  return parsed;
}

function enumValue<const T extends readonly string[]>(
  value: unknown,
  values: T,
  label: string,
): T[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    throw new OfferValidationError(`${label}을(를) 선택해 주세요.`);
  }
  return value as T[number];
}
