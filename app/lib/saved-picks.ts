/**
 * 내 비교함 저장 모델 (Phase 0, schema v1).
 *
 * Phase 0의 원칙은 하나다: **금액을 추정하지 않는다.**
 * 검수된 실제 결제액 차이만 금액이 될 수 있는데 그 의미론은 Phase 1(PRICE-01a)에서
 * 확정되므로, Phase 0에서 만들어지는 모든 pick은 `amount: null`로 저장한다.
 * 기존 레코드도 삭제하지 않고 `legacy-unknown`으로 보존한다.
 */

export const SAVED_PICK_SCHEMA_VERSION = 1 as const;

/** 쓰기 전용 키. 구 번들이 이 키를 필터로 덮어쓰지 못하도록 v1과 분리한다. */
export const PICK_STORAGE_KEY = "cherrypicker-comparison-box-v2";
/** 읽기 전용 승격 대상. 이 키에는 다시 쓰지 않는다. */
export const LEGACY_PICK_STORAGE_KEYS = [
  "cherrypicker-comparison-box-v1",
  "cherrypicker-comparison-box",
] as const;
/** 파싱 실패 원문 보관. 삭제 대신 격리해 원인 조사를 가능하게 한다. */
export const PICK_QUARANTINE_KEY = "cherrypicker-comparison-box-quarantine";

export const MAX_SAVED_PICKS = 50;

export type SavedPickCategory = "cosmetics" | "liquor" | "other";
export type SavedPickAmountState = "pending" | "legacy-unknown" | "verified";
export type SavedPickComparisonMode = "pending" | "legacy-unknown" | "verified";
export type SavedPickSavedAtBasis = "user-action" | "legacy-import";

export type SavedPickV1 = {
  schemaVersion: typeof SAVED_PICK_SCHEMA_VERSION;
  /** 같은 선택을 가리키는 안정 식별자. 복구할 수 없으면 null. */
  identityKey: string | null;
  category: SavedPickCategory;
  productId: string | null;
  title: string;
  comparisonMode: SavedPickComparisonMode;
  /** Phase 0에서는 항상 null. 검증된 금액은 schema v2에서 도입한다. */
  amount: number | null;
  amountState: SavedPickAmountState;
  savedAt: number;
  savedAtBasis: SavedPickSavedAtBasis;
};

export type NormalizeResult = {
  picks: SavedPickV1[];
  /** 통째로 파싱 실패한 원문. 있으면 격리 키로 옮긴다. */
  quarantined: string | null;
  /** 배열 안에서 형태가 깨져 승격하지 못한 항목 수. */
  droppedItems: number;
};

const categories = new Set<SavedPickCategory>(["cosmetics", "liquor", "other"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * 저장된 선택 하나를 가리키는 안정 식별자를 만든다.
 *
 * 가격에 따라 변하는 값(승자, 절감액, `decisionTone`)은 섞지 않는다. 예전
 * 저장 키가 `decisionTone`을 포함하고 있었는데, 그러면 같은 상품이 가격이
 * 움직일 때마다 새 항목으로 쌓이고 중복 방지가 동작하지 않는다.
 *
 * 상품 단위로 한 칸을 쓴다. `내 비교함`은 판정 이력이 아니라 지켜보는 상품의
 * 목록이고, Phase 0에서는 금액을 저장하지 않으므로 나란히 보관할 판정 자체가
 * 없다. 같은 상품의 "지난주 면세 우위 / 이번주 국내 우위"를 함께 남기려면
 * schema v2에서 이력 항목을 따로 두는 편이 맞다.
 *
 * 주류는 `productId` 자리에 취향(`taste`) 키가 들어오는데, 카탈로그 항목당
 * 하나로 안정적이므로 같은 규칙을 쓴다.
 */
export function buildIdentityKey(input: {
  category: SavedPickCategory;
  productId: string | null;
}): string | null {
  // 안정 식별자를 만들 수 없으면 null이다. null은 "모르는 항목"이라는 뜻이고,
  // 모르는 항목끼리는 같은 선택으로 병합하지 않는다.
  if (!input.productId) return null;
  return `${input.category}:${input.productId}`;
}

/** Phase 0에서 새로 저장하는 pick. 금액은 언제나 비운다. */
export function createPendingPick(input: {
  category: SavedPickCategory;
  productId: string | null;
  title: string;
  savedAt: number;
}): SavedPickV1 {
  return {
    schemaVersion: SAVED_PICK_SCHEMA_VERSION,
    identityKey: buildIdentityKey(input),
    category: input.category,
    productId: input.productId,
    title: input.title,
    comparisonMode: "pending",
    amount: null,
    amountState: "pending",
    savedAt: input.savedAt,
    savedAtBasis: "user-action",
  };
}

function upgradeLegacyPick(value: Record<string, unknown>): SavedPickV1 | null {
  const title = value.title;
  if (typeof title !== "string" || title.length === 0) return null;

  const savedAt = value.savedAt;

  return {
    schemaVersion: SAVED_PICK_SCHEMA_VERSION,
    // 구 레코드의 key는 `${category}-${productId}-${decisionTone}` 합성 문자열이라
    // 안정 식별자를 되돌릴 수 없다. 추측해서 중복 제거하지 않는다.
    identityKey: null,
    category: "other",
    productId: null,
    title,
    comparisonMode: "legacy-unknown",
    // 구 금액은 환산가일 수 있어 검증 없이 되살리지 않는다.
    amount: null,
    amountState: "legacy-unknown",
    // 구 savedAt은 `event.timeStamp`(페이지 로드 후 경과 ms)일 수 있으므로
    // epoch로 재해석하지 않고 basis로 표시만 남긴다.
    savedAt: isFiniteNumber(savedAt) ? savedAt : 0,
    savedAtBasis: "legacy-import",
  };
}

function upgradeV1Pick(value: Record<string, unknown>): SavedPickV1 | null {
  const { title, category, productId, identityKey, savedAt } = value;
  if (typeof title !== "string" || title.length === 0) return null;
  if (typeof category !== "string" || !categories.has(category as SavedPickCategory)) {
    return null;
  }

  const amount = isFiniteNumber(value.amount) ? value.amount : null;
  const amountState =
    value.amountState === "verified" && amount !== null
      ? "verified"
      : value.amountState === "legacy-unknown"
        ? "legacy-unknown"
        : "pending";

  return {
    schemaVersion: SAVED_PICK_SCHEMA_VERSION,
    identityKey: typeof identityKey === "string" ? identityKey : null,
    category: category as SavedPickCategory,
    productId: typeof productId === "string" ? productId : null,
    title,
    comparisonMode:
      value.comparisonMode === "verified"
        ? "verified"
        : value.comparisonMode === "legacy-unknown"
          ? "legacy-unknown"
          : "pending",
    amount: amountState === "verified" ? amount : null,
    amountState,
    savedAt: isFiniteNumber(savedAt) ? savedAt : 0,
    savedAtBasis:
      value.savedAtBasis === "legacy-import" ? "legacy-import" : "user-action",
  };
}

/**
 * 저장소 원문을 `SavedPickV1[]`로 정규화한다.
 *
 * 실패 처리 원칙:
 *   - 원문 전체가 깨지면 격리하고 빈 목록을 돌려준다. 다른 키는 건드리지 않는다.
 *   - 배열 안의 개별 항목이 깨지면 그 항목만 버리고 나머지는 살린다.
 *   - 금액이 없는 항목은 유효한 상태이며 절대 탈락시키지 않는다.
 */
export function normalizeStoredPicks(raw: string | null): NormalizeResult {
  if (!raw) return { picks: [], quarantined: null, droppedItems: 0 };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { picks: [], quarantined: raw, droppedItems: 0 };
  }

  if (!Array.isArray(parsed)) {
    return { picks: [], quarantined: raw, droppedItems: 0 };
  }

  const picks: SavedPickV1[] = [];
  let droppedItems = 0;

  for (const item of parsed) {
    if (!isRecord(item)) {
      droppedItems += 1;
      continue;
    }
    const upgraded =
      item.schemaVersion === SAVED_PICK_SCHEMA_VERSION
        ? upgradeV1Pick(item)
        : upgradeLegacyPick(item);
    if (upgraded) picks.push(upgraded);
    else droppedItems += 1;
  }

  return {
    picks: picks.slice(-MAX_SAVED_PICKS),
    quarantined: null,
    droppedItems,
  };
}

/** 이미 저장된 선택인지 판정한다. identity를 모르는 항목끼리는 같다고 보지 않는다. */
export function findExistingPick(
  picks: readonly SavedPickV1[],
  identityKey: string | null,
): SavedPickV1 | undefined {
  if (identityKey === null) return undefined;
  return picks.find((pick) => pick.identityKey === identityKey);
}

/** 검증된 금액만 합산한다. pending·legacy는 0으로 조용히 더해지지 않는다. */
export function sumVerifiedAmounts(picks: readonly SavedPickV1[]): number {
  return picks.reduce(
    (sum, pick) =>
      pick.amountState === "verified" && isFiniteNumber(pick.amount)
        ? sum + pick.amount
        : sum,
    0,
  );
}
