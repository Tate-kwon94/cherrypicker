/**
 * 내 비교함 저장 모델 (schema v2).
 *
 * v2가 한 번에 확정하는 것: `schemaVersion`, 저장 근거(`basis`), 저장 시각의
 * 해석(`savedAt`). 셋을 따로 옮기면 그때마다 저장소를 다시 건드려야 한다.
 *
 * 두 가지 원칙이 모델 전체를 결정한다.
 *
 *   1. **캡처 근거 pick은 표현 불가능하다.** `SavedPickBasis`에 `"captured"`
 *      멤버가 없다. 런타임 검사로 막는 게 아니라 타입에 자리가 없다 —
 *      H-02/TRUST-01a0의 저장소 측 방어다.
 *   2. **숫자와 그 숫자의 해석을 한 필드에 담지 않는다.** `savedAt: number`에는
 *      "이건 시계가 아니다"를 적을 자리가 없었고, 그래서 구 코드가
 *      `event.timeStamp`를 epoch로 위장했다(L-11).
 */

export const SAVED_PICK_SCHEMA_VERSION = 2 as const;

/**
 * 쓰기 키를 한 번 더 올린다.
 *
 * 이미 배포된 v1 번들의 분기는 `schemaVersion !== 1`인 행을 전부 legacy 승격
 * 경로로 보내 `category`·`productId`를 지운 뒤 저장소에 되쓴다. 그 번들은
 * 소급 수정할 수 없으므로, 그것이 읽지 않는 키가 유일한 방어다.
 */
export const PICK_STORAGE_KEY = "cherrypicker-comparison-box-v3";

/**
 * 읽기 전용 승격 대상. 삭제하지 않는다 — 롤백된 구 번들이 자기 데이터를
 * 그 자리에서 찾을 수 있어야 한다. 구 `-v2`를 맨 앞에 넣지 않으면 이미
 * 저장한 사용자의 비교함이 통째로 고아가 된다.
 */
export const LEGACY_PICK_STORAGE_KEYS = [
  "cherrypicker-comparison-box-v2",
  "cherrypicker-comparison-box-v1",
  "cherrypicker-comparison-box",
] as const;

/** 파싱 실패 원문 보관. 삭제 대신 격리해 원인 조사를 가능하게 한다. */
export const PICK_QUARANTINE_KEY = "cherrypicker-comparison-box-quarantine";

export const MAX_SAVED_PICKS = 50;

/**
 * 2024-01-01T00:00:00Z. 이 서비스가 있기 전 시각은 저장 시각일 수 없다.
 * `1e12` 같은 관습적 경계 대신 제품 사실을 쓴다 — 임의 경계는 나중에 완화될
 * 빌미가 된다.
 */
export const SAVED_AT_EPOCH_FLOOR_MS = 1_704_067_200_000;

/** 기기 시계가 조금 앞선 사용자를 벌하지 않는다. 쓰기 시점에만 적용한다. */
export const SAVED_AT_FUTURE_SKEW_MS = 86_400_000;

export type SavedPickCategory = "cosmetics" | "liquor" | "other";

/**
 * 이 행이 무엇에 근거해 저장됐는가.
 *
 * 비교 모드와 오퍼 provenance를 한 축으로 합쳤다. 저장 어피던스가 기본 추천
 * 카드 하나뿐이고 그 카드는 검수 비교가 성립할 때만 렌더되므로 두 질문의
 * 답이 언제나 같다. 상관된 두 필드를 따로 두면 서로 어긋난 조합
 * ("검수 쌍인데 캡처 근거")이 표현 가능해진다.
 *
 * 인식하지 못한 값은 `"unknown"`으로 강등한다(fail-closed).
 */
export type SavedPickBasis = "verified-pair" | "unknown";

/**
 * 저장 시각과 그 시각을 얼마나 믿을 수 있는지.
 *
 * `device-clock`은 **기기가 그렇게 보고했다**는 뜻이지 **그 시각이 맞다**는
 * 뜻이 아니다. 시계가 2025년에 멈춘 기기는 범위 검사를 통과하고, 어떤 검사도
 * 그걸 반증할 수 없다. 그래서 이 arm 이름은 판정이 아니라 출처를 말한다.
 * v2는 절대 날짜를 렌더하지 않는다 — 저장 시각은 정렬에만 쓴다.
 *
 * 숫자는 어느 arm에서도 버리지 않는다. 이름만 바뀐다.
 */
export type SavedPickTime =
  | { basis: "device-clock"; epochMs: number }
  | { basis: "legacy-import"; rawValue: number }
  | { basis: "unknown"; rawValue: number | null };

export type SavedPickV2 = {
  schemaVersion: typeof SAVED_PICK_SCHEMA_VERSION;
  category: SavedPickCategory;
  /**
   * identity의 나머지 절반. 화장품은 카탈로그 상품 id, 주류는 취향 키다.
   * 오퍼의 `variantKey`와는 다른 네임스페이스이므로 섞어 쓰지 않는다.
   */
  productId: string | null;
  /** legacy 행에서 유일하게 살아남는 필드. 없으면 사용자가 식별할 수 없다. */
  title: string;
  basis: SavedPickBasis;
  savedAt: SavedPickTime;
};

/**
 * v1에서 삭제한 필드와 이유:
 *
 *   identityKey    → `buildIdentityKey(pick)`로 파생한다. 저장본이 계산본과
 *                    할 수 있는 일은 어긋나는 것뿐이다.
 *   amount /
 *   amountState    → v2는 금액을 도입하지 않는다. 실제 저장된 값은 언제나
 *                    null이었으므로 손실이 0이고, 언제나 null인 금액 필드는
 *                    합계를 통해 공개 문자열로 새는 통로만 남긴다. 금액
 *                    의미론은 PRICE-01a 소관이다.
 *   comparisonMode → `basis`로 대체. 이름 자체가 카탈로그·운영 화면의
 *                    `comparisonMode`(비교 *방식*)와 충돌해 두 개념이 한
 *                    이름으로 읽혔다.
 *   savedAtBasis   → `SavedPickTime`의 discriminant로 흡수.
 */

export type NormalizeResult = {
  picks: SavedPickV2[];
  /** 통째로 파싱 실패한 원문. 있으면 격리 키로 옮긴다. */
  quarantined: string | null;
  /** 배열 안에서 형태가 깨져 승격하지 못한 항목 수. */
  droppedItems: number;
  /**
   * 이해할 수 없는 미래 schemaVersion 행을 봤다.
   *
   * 이때 호출부는 저장소를 되쓰지 **않고**, 새 저장도 거부해야 한다. 읽기만
   * 막으면 목록이 비어 보이고 저장 버튼이 열려, 클릭 한 번에 미래 행이
   * 전부 사라진다.
   */
  blockedByNewerSchema: boolean;
};

const categories = new Set<SavedPickCategory>(["cosmetics", "liquor", "other"]);
const bases = new Set<SavedPickBasis>(["verified-pair", "unknown"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * 저장된 선택 하나를 가리키는 안정 식별자를 만든다.
 *
 * 가격에 따라 변하는 값(승자, 절감액, 판정 톤)은 섞지 않는다. 구 저장 키가
 * 판정 톤을 포함하고 있었는데, 그러면 같은 상품이 가격이 움직일 때마다 새
 * 항목으로 쌓이고 중복 방지가 동작하지 않는다.
 *
 * 형식 `${category}:${productId}`는 v2에서 동결한다. 바꾸면 저장된 모든
 * pick을 한 번에 놓치고 중복 저장이 다시 열린다.
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

/**
 * epoch로 볼 수 있는 값인지.
 *
 * `checkCeiling`은 쓰기에서만 켠다. 읽기에서 상한을 다시 보면, 시계가 앞선
 * 기기에서 저장한 뒤 NTP가 시계를 되돌렸을 때 멀쩡히 저장된 값이 전부
 * 강등되고 — 마운트가 정규화 결과를 되쓰므로 — 그 강등이 저장소에 영구히
 * 굳는다. 바닥값은 시계와 무관하므로 읽기에서도 안전하다.
 *
 * 정수 검사는 소수점이 붙는 `event.timeStamp`를 걸러내지만, 그것만으로 두
 * 값이 갈리지는 않는다 — `event.timeStamp`도 정수일 수 있다. 실제로 가르는
 * 것은 바닥값이다.
 */
function isPlausibleEpoch(
  value: unknown,
  now: number,
  { checkCeiling }: { checkCeiling: boolean },
): value is number {
  if (!isFiniteNumber(value)) return false;
  if (!Number.isInteger(value)) return false;
  if (value < SAVED_AT_EPOCH_FLOOR_MS) return false;
  if (checkCeiling && value > now + SAVED_AT_FUTURE_SKEW_MS) return false;
  return true;
}

/**
 * 시각 하나를 분류한다. 쓰기와 읽기가 같은 규칙을 쓴다.
 *
 * 던지지도, 대체하지도 않는다. 던지면 시계가 이상한 기기에서 저장 버튼이
 * 죽고, `Date.now()`로 대체하면 없는 데이터를 지어낸다.
 */
export function classifySavedAt(
  value: unknown,
  now: number,
  claim: "device-clock" | "legacy-import",
  options: { checkCeiling?: boolean } = {},
): SavedPickTime {
  if (claim === "legacy-import") {
    // legacy 값은 아무것도 주장하지 않으므로 반증할 것도 없다. 그대로 둔다.
    return isFiniteNumber(value)
      ? { basis: "legacy-import", rawValue: value }
      : { basis: "unknown", rawValue: null };
  }
  if (isPlausibleEpoch(value, now, {
    checkCeiling: options.checkCeiling ?? false,
  })) {
    return { basis: "device-clock", epochMs: value };
  }
  return {
    basis: "unknown",
    rawValue: isFiniteNumber(value) ? value : null,
  };
}

/**
 * 새로 저장하는 pick을 만드는 **유일한** 팩토리.
 *
 * `basis` 인자가 없는 것이 "내 입력 포함 비교"가 저장될 수 없는 구조적
 * 이유다. 호출부가 근거를 고를 수 없다.
 */
export function createVerifiedPick(input: {
  category: SavedPickCategory;
  productId: string | null;
  title: string;
  savedAt: number;
  now?: number;
}): SavedPickV2 {
  const now = input.now ?? Date.now();
  return {
    schemaVersion: SAVED_PICK_SCHEMA_VERSION,
    category: input.category,
    productId: input.productId,
    title: input.title,
    basis: "verified-pair",
    // 쓰기에서는 상한도 본다. 여기서 통과한 값만 이후 읽기에서 유지된다.
    savedAt: classifySavedAt(input.savedAt, now, "device-clock", {
      checkCeiling: true,
    }),
  };
}

function readTime(value: unknown, now: number): SavedPickTime {
  if (!isRecord(value)) return { basis: "unknown", rawValue: null };
  if (value.basis === "device-clock") {
    // 읽기 재검증은 바닥값만 본다. 통과한 값이 나중에 실패할 수 없으므로
    // 이 분기는 손으로 고친 행에서만 발동한다.
    return classifySavedAt(value.epochMs, now, "device-clock");
  }
  if (value.basis === "legacy-import") {
    return classifySavedAt(value.rawValue, now, "legacy-import");
  }
  // unknown은 그대로 두고 절대 승격하지 않는다. 신뢰는 단조 비증가여야
  // 재정규화가 시간에 독립적이다.
  return {
    basis: "unknown",
    rawValue: isFiniteNumber(value.rawValue) ? value.rawValue : null,
  };
}

function readV2(value: Record<string, unknown>, now: number): SavedPickV2 | null {
  const { title, category, productId } = value;
  if (typeof title !== "string" || title.length === 0) return null;
  if (
    typeof category !== "string" ||
    !categories.has(category as SavedPickCategory)
  ) {
    return null;
  }

  return {
    schemaVersion: SAVED_PICK_SCHEMA_VERSION,
    category: category as SavedPickCategory,
    productId: typeof productId === "string" ? productId : null,
    title,
    // 손으로 써 넣은 `"captured"` 같은 값은 인식하지 않고 강등한다.
    basis: bases.has(value.basis as SavedPickBasis)
      ? (value.basis as SavedPickBasis)
      : "unknown",
    savedAt: readTime(value.savedAt, now),
  };
}

function upgradeV1(
  value: Record<string, unknown>,
  now: number,
): SavedPickV2 | null {
  const { title, category, productId } = value;
  if (typeof title !== "string" || title.length === 0) return null;
  if (
    typeof category !== "string" ||
    !categories.has(category as SavedPickCategory)
  ) {
    return null;
  }

  const claim =
    value.savedAtBasis === "legacy-import" ? "legacy-import" : "device-clock";

  /**
   * v1 저장 버튼은 검수 비교가 성립했을 때만 렌더됐으므로, 클릭으로 생긴
   * v1 행은 검수 쌍이 있었을 때만 존재한다.
   *
   * 다만 `savedAtBasis` 하나만 보면 안 된다 — 구 승격 코드가 인식하지 못한
   * basis를 전부 `"user-action"`으로 기본값 처리했으므로, 손상된 행이
   * attestation으로 승격될 수 있다. legacy 계열 행은 언제나 category가
   * `"other"`이고 productId가 null이므로, 복구 가능한 identity를 함께
   * 요구하면 그 경로가 막힌다.
   */
  const basis: SavedPickBasis =
    claim === "device-clock" &&
    value.comparisonMode !== "legacy-unknown" &&
    category !== "other" &&
    typeof productId === "string"
      ? "verified-pair"
      : "unknown";

  return {
    schemaVersion: SAVED_PICK_SCHEMA_VERSION,
    category: category as SavedPickCategory,
    productId: typeof productId === "string" ? productId : null,
    title,
    basis,
    savedAt: classifySavedAt(value.savedAt, now, claim),
  };
}

function upgradeLegacy(
  value: Record<string, unknown>,
  now: number,
): SavedPickV2 | null {
  const title = value.title;
  if (typeof title !== "string" || title.length === 0) return null;

  return {
    schemaVersion: SAVED_PICK_SCHEMA_VERSION,
    // 구 레코드의 key는 `${category}-${productId}-${tone}` 합성 문자열이라
    // 상품 identity를 되돌릴 수 없다. 추측해서 중복 제거하지 않는다.
    category: "other",
    productId: null,
    title,
    basis: "unknown",
    // 구 savedAt은 `event.timeStamp`(페이지 로드 후 경과 ms)일 수 있으므로
    // epoch로 재해석하지 않는다. 예전의 `?? 0` 대체는 1970-01-01이라는
    // 거짓 시각을 만들었다 — 값이 없으면 없다고 적는다.
    savedAt: classifySavedAt(value.savedAt, now, "legacy-import"),
  };
}

/**
 * 저장소 원문을 `SavedPickV2[]`로 정규화한다.
 *
 * 실패 처리 원칙:
 *   - 원문 전체가 깨지면 격리하고 빈 목록을 돌려준다. 다른 키는 건드리지 않는다.
 *   - 배열 안의 개별 항목이 깨지면 그 항목만 버리고 나머지는 살린다.
 *   - 이해할 수 없는 미래 버전 행은 버리지 않고 건너뛰며, 그 사실을 알린다.
 */
export function normalizeStoredPicks(
  raw: string | null,
  now = Date.now(),
): NormalizeResult {
  const empty = {
    picks: [] as SavedPickV2[],
    quarantined: null,
    droppedItems: 0,
    blockedByNewerSchema: false,
  };
  if (!raw) return empty;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...empty, quarantined: raw };
  }

  if (!Array.isArray(parsed)) {
    return { ...empty, quarantined: raw };
  }

  const picks: SavedPickV2[] = [];
  let droppedItems = 0;
  let blockedByNewerSchema = false;

  for (const item of parsed) {
    if (!isRecord(item)) {
      droppedItems += 1;
      continue;
    }

    const version = item.schemaVersion;
    let upgraded: SavedPickV2 | null;

    if (version === SAVED_PICK_SCHEMA_VERSION) {
      upgraded = readV2(item, now);
    } else if (version === 1) {
      upgraded = upgradeV1(item, now);
    } else if (typeof version === "number" && version > SAVED_PICK_SCHEMA_VERSION) {
      // 이해하지 못하는 미래 행이다. 파괴하지 않고 건너뛴다. 예전에는 이
      // 경우가 legacy 승격으로 흘러 category·productId가 지워졌다.
      blockedByNewerSchema = true;
      continue;
    } else {
      upgraded = upgradeLegacy(item, now);
    }

    if (upgraded) picks.push(upgraded);
    else droppedItems += 1;
  }

  return {
    picks: picks.slice(-MAX_SAVED_PICKS),
    quarantined: null,
    droppedItems,
    blockedByNewerSchema,
  };
}

/**
 * 이미 저장된 선택인지 판정한다.
 *
 * 저장된 필드가 아니라 계산 결과를 비교한다 — 저장본이 계산본과 할 수 있는
 * 일은 어긋나는 것뿐이다. identity를 모르는 항목끼리는 같다고 보지 않는다.
 */
export function findExistingPick(
  picks: readonly SavedPickV2[],
  identityKey: string | null,
): SavedPickV2 | undefined {
  if (identityKey === null) return undefined;
  return picks.find((pick) => buildIdentityKey(pick) === identityKey);
}

/**
 * 저장소에서 막 읽은 목록에 **새 pick 하나**를 더한다.
 *
 * 탭이 여러 개 열려 있으면 각 탭의 화면 상태는 마운트 시점 스냅샷이다.
 * 그대로 덮어쓰면 다른 탭이 그 사이에 저장한 항목이 조용히 사라지므로,
 * 저장 직전에 저장소를 다시 읽어 그 목록에 이 함수로 더한다.
 *
 * 목록 두 개를 받지 않는다. 목록을 받으면 호출부가 이미 저장돼 있는 행을
 * 다시 제출할 수 있고, identity 가 null 인 행(legacy 승격 행은 언제나
 * 그렇다)은 중복 판정을 할 수 없어 저장할 때마다 배로 늘어난다. 실제로
 * 그렇게 만들었다가 여섯 번 저장에 사본 48개가 쌓이고 사용자가 직접
 * 저장한 항목이 상한에 밀려 사라졌다. 인자를 하나로 좁혀 그 오용 자체를
 * 표현할 수 없게 한다.
 */
export function appendPick(
  stored: readonly SavedPickV2[],
  pick: SavedPickV2,
): SavedPickV2[] {
  const identity = buildIdentityKey(pick);
  const already =
    identity !== null &&
    stored.some((existing) => buildIdentityKey(existing) === identity);

  const next = already ? [...stored] : [...stored, pick];
  return next.slice(-MAX_SAVED_PICKS);
}
