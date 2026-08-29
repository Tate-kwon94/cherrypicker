import {
  DAY_MS,
  MAX_OFFER_VALIDITY_MS,
  freshnessWindowDays,
} from "./freshness.ts";
import {
  calculateOfferTotal,
  calculateUnitPrice,
  isSafeExternalUrl,
  type Currency,
} from "./pricing.ts";
import { findRetailerByName } from "./retailers.ts";

export const offerStatuses = ["draft", "approved", "rejected"] as const;
export const offerEvidenceTypes = [
  "official_listing",
  "licensed_pickup",
  "receipt",
  "store_photo",
] as const;
export type OfferStatus = (typeof offerStatuses)[number];
export type OfferEvidenceType = (typeof offerEvidenceTypes)[number];
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
  /** 금액이 어느 통화로 적힌 값인지. 비교는 같은 통화끼리만 성립한다. */
  currency: Currency;
  volume: number;
  unit: OfferUnit;
  observedAt: number;
  expiresAt: number;
  evidenceType: OfferEvidenceType;
  storeLocation: string;
  abv: number | null;
  barcode: string;
  notes: string;
};

/**
 * 본품이 아님을 드러내는 상품명 표기.
 *
 * 검수 대상을 **본품 하나로 한정한다**. 이 제품은 아직 변형(variant) 개념이
 * 없어서 상품 id 가 곧 변형인데, 세트와 본품이 같은 id 로 들어오면 서로
 * 다른 구성의 가격이 같은 상품으로 비교된다 — 기획세트가 본품보다 싸
 * 보이는 식으로. 비교 계약의 `variant-mismatch` 검사는 그 상태에서
 * 도달할 수 없으므로 막아주지 못한다.
 *
 * 이름으로 거르는 것은 추측이지만, 여기서 통과시키면 잘못된 비교가
 * **조용히** 만들어진다. 잘못 걸린 경우에는 사람이 보고 판단할 수 있다.
 * 각 표기가 왜 걸렸는지 함께 말해 준다.
 */
export const nonSingleUnitMarkers: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /기획\s*세트|선물\s*세트|세트/, label: "세트 구성" },
  { pattern: /증정|사은품/, label: "증정품 포함" },
  { pattern: /한정판|리미티드/, label: "한정 구성" },
  { pattern: /리필\s*기획|기획\s*팩/, label: "기획 구성" },
  // `입` 뒤에 \b 를 두면 안 된다. JS 의 \b 는 ASCII 기준이라 한글은
  // 단어문자가 아니고, 문자열 끝의 `2입` 은 경계를 만들지 못해 매칭에
  // 실패했다 — 묶음 상품이 본품으로 등록됐다.
  { pattern: /\d+\s*개입|\d+\s*입(?![가-힣])/, label: "묶음 수량" },
  { pattern: /\b\d+\s*\+\s*\d+\b/, label: "덤 구성" },
];

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
  const nonSingleUnit = nonSingleUnitMarkers.find(({ pattern }) =>
    pattern.test(productName),
  );
  if (nonSingleUnit) {
    throw new OfferValidationError(
      `상품명에 ${nonSingleUnit.label}이 보입니다. 지금은 본품만 검수 가격으로 ` +
        `등록합니다 — 구성이 다른 가격을 같은 상품으로 비교하지 않기 위해서입니다.`,
    );
  }
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
  const knownRetailer = findRetailerByName(sourceName);
  if (knownRetailer && knownRetailer.channel !== channel) {
    throw new OfferValidationError(
      `${knownRetailer.name}의 판매 채널을 ${knownRetailer.channel === "duty" ? "온라인 면세" : "국내 리테일"}로 선택해 주세요.`,
    );
  }
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
  // 통화를 적지 않은 등록은 KRW 로 본다. 기존 데이터가 전부 원화이고
  // backfill 도 KRW 이므로, 이 기본값은 추측이 아니라 사실이다.
  const currency = enumValue(
    payload.currency ?? "KRW",
    ["KRW", "USD"] as const,
    "통화",
  );
  // USD 등록은 아직 열지 않는다. 금액 컬럼이 정수라 $89.50 을 저장할 수
  // 없고, 89 로 절사해 넣으면 통화를 바로잡으려던 변경이 더 조용한 오류를
  // 만든다. 컬럼과 계약 검사는 지금 넣어 두고 — 다른 경로로 USD 행이
  // 들어오더라도 비교가 거부되도록 — 손실이 있는 입력 경로만 닫는다.
  if (currency !== "KRW") {
    throw new OfferValidationError(
      "USD 가격 등록은 아직 지원하지 않습니다. 금액을 최소 단위로 저장하도록 바꾼 뒤 열립니다.",
    );
  }
  const volume = numberValue(payload.volume, "용량", 0.01);
  calculateUnitPrice(finalPrice, volume);

  const observedAt = timestampValue(payload.observedAt, "가격 확인 시각");
  const expiresAt = timestampValue(payload.expiresAt, "가격 만료 시각");
  const evidenceType = enumValue(
    payload.evidenceType ?? "official_listing",
    offerEvidenceTypes,
    "가격 증거",
  );
  const storeLocation = optionalText(payload.storeLocation, 160);
  const barcode = optionalText(payload.barcode, 40);
  const abv =
    payload.abv === undefined || payload.abv === null || payload.abv === ""
      ? null
      : numberValue(payload.abv, "도수", 0.1);

  if (observedAt > now + 5 * 60 * 1000) {
    throw new OfferValidationError("가격 확인 시각은 미래일 수 없습니다.");
  }
  if (expiresAt <= now) {
    throw new OfferValidationError("가격 만료 시각은 현재보다 뒤여야 합니다.");
  }
  if (expiresAt <= observedAt) {
    throw new OfferValidationError("가격 만료 시각은 확인 시각보다 뒤여야 합니다.");
  }
  if (expiresAt - observedAt > MAX_OFFER_VALIDITY_MS) {
    throw new OfferValidationError(
      `가격 유효기간은 최대 ${MAX_OFFER_VALIDITY_MS / DAY_MS}일입니다.`,
    );
  }
  const freshnessDays = freshnessWindowDays({ category, evidenceType });
  if (expiresAt - observedAt > freshnessDays * DAY_MS) {
    throw new OfferValidationError(
      `이 가격은 최대 ${freshnessDays}일까지만 최신 가격으로 등록할 수 있습니다.`,
    );
  }
  validateLiquorEvidence({
    category,
    channel,
    unit,
    evidenceType,
    storeLocation,
    abv,
  });

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
    currency,
    volume,
    unit,
    observedAt,
    expiresAt,
    evidenceType,
    storeLocation,
    abv,
    barcode,
    notes: optionalText(payload.notes, 500),
  };
}

function validateLiquorEvidence({
  category,
  channel,
  unit,
  evidenceType,
  storeLocation,
  abv,
}: {
  category: OfferCategory;
  channel: OfferChannel;
  unit: OfferUnit;
  evidenceType: OfferEvidenceType;
  storeLocation: string;
  abv: number | null;
}) {
  if (category !== "liquor") return;
  if (unit !== "ml") {
    throw new OfferValidationError("주류 용량은 ml 단위로 등록해 주세요.");
  }
  if (abv !== null && abv > 100) {
    throw new OfferValidationError(
      "주류 도수는 확인 가능한 경우에만 0.1~100% 범위로 입력해 주세요.",
    );
  }
  if (
    channel === "retail" &&
    evidenceType !== "official_listing" &&
    !storeLocation
  ) {
    throw new OfferValidationError(
      "국내 픽업·영수증 가격은 확인한 매장이나 픽업 지점을 입력해 주세요.",
    );
  }

  // 신선도 상한은 여기서 다시 계산하지 않는다. 예전에는 주류 전용 표가
  // 따로 있었고 공식 원본을 14일로 적어뒀지만, 범용 검사가 먼저 1일로
  // 던지므로 그 분기는 한 번도 실행된 적이 없다. 그런데 UI 는 그 14일을
  // 읽어 사용자에게 보여줬다. 정책은 freshness.ts 한 곳에만 있다.
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

/** 상품 행이 가진 정체성. 가격 관측이 아니라 상품 자체를 규정한다. */
export type ProductIdentity = {
  brand: string;
  name: string;
  category: OfferCategory;
  unit: OfferUnit;
};

export type ProductConflict = {
  field: keyof ProductIdentity;
  existing: string;
  submitted: string;
};

const productFieldLabels: Record<keyof ProductIdentity, string> = {
  brand: "브랜드",
  name: "상품명",
  category: "카테고리",
  unit: "단위",
};

/**
 * 이미 있는 상품과 새 가격 관측이 선언한 상품 정보를 대조한다.
 *
 * `category`와 `unit`은 신선도 규칙과 단위가격 의미를 바꾸므로, 어긋난 채로
 * 덮어쓰면 **이미 승인된 다른 가격들의 해석까지** 소급해서 달라진다.
 * `brand`와 `name`은 공개 화면에 그대로 나가므로 마찬가지로 함부로 바꿀 수 없다.
 */
export function findProductConflicts(
  existing: ProductIdentity,
  submitted: ProductIdentity,
): ProductConflict[] {
  const fields: Array<keyof ProductIdentity> = [
    "brand",
    "name",
    "category",
    "unit",
  ];

  return fields
    .filter((field) => existing[field] !== submitted[field])
    .map((field) => ({
      field,
      existing: existing[field],
      submitted: submitted[field],
    }));
}

export function describeProductConflicts(
  productId: string,
  conflicts: readonly ProductConflict[],
): string {
  const detail = conflicts
    .map(
      (conflict) =>
        `${productFieldLabels[conflict.field]}: 등록됨 "${conflict.existing}" · 입력 "${conflict.submitted}"`,
    )
    .join(", ");

  return (
    `이미 등록된 상품 ${productId}의 정보와 다릅니다 (${detail}). ` +
    `가격 등록으로 상품 정보를 바꾸면 이미 승인된 다른 가격의 표시와 신선도 ` +
    `기준까지 함께 바뀝니다. 상품 정보 수정은 별도 작업으로 처리해 주세요.`
  );
}
