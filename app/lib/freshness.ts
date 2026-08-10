import type { OfferCategory, OfferEvidenceType } from "./offer-input.ts";

/** 하루(ms). 아래 정책 창은 모두 이 단위의 배수다. */
export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 가격을 "최신"으로 볼 수 있는 기간 — 일 단위.
 *
 * 등록 상한, 피드 신선도 판정, 사용자 문구 세 곳이 각자 계산하던 값을
 * 하나로 모았다. 흩어져 있는 동안 실제로 어긋나 있었다 — 범용 등록
 * 상한은 공식 원본을 1일로 막는데 주류 전용 분기에는 14일이라고 적혀
 * 있었고(범용 검사가 먼저 던지므로 도달 불가), UI 는 그 14일을 사용자에게
 * 보여줬다.
 *
 * 공식 원본을 1일로 정한 근거: 이 제품이 답하는 질문은 "지금 어디서 사야
 * 하나"다. 하루 지난 면세 가격을 "최신"이라고 부르면 비교 자체의 신뢰가
 * 무너진다. 위험도 비대칭이다 — 창이 너무 짧으면 맞는 가격이 참고가격으로
 * 내려갈 뿐이지만, 너무 길면 틀린 가격을 추천한다.
 */
export const FRESHNESS_WINDOW_DAYS = {
  /** 판매처 공식 페이지. 가장 자주 바뀌므로 가장 짧다. */
  officialListing: 1,
  /** 주류 성인 인증 픽업. 예약가가 픽업까지 유지된다. */
  licensedPickup: 7,
  /** 영수증·매장 가격표. 확인 시점의 실제 결제가라 조금 더 오래 유효하다. */
  captured: 3,
} as const;

/** 사용자에게 "최대 N일"로 안내할 값. 표에서 유도한다. */
export const MAX_FRESHNESS_DAYS = Math.max(
  ...Object.values(FRESHNESS_WINDOW_DAYS),
);

/**
 * 등록 가능한 유효기간의 절대 상한. **신선도가 아니다.**
 *
 * "만료 시각이 확인 시각보다 터무니없이 뒤"인 입력을 막는 위생 검사이고,
 * 신선도 창이 그보다 훨씬 짧게 다시 자른다. 같은 일 단위 시간창이라
 * 신선도와 묶고 싶어지지만, 묶으면 위생 검사가 사라진다.
 */
export const MAX_OFFER_VALIDITY_MS = 90 * DAY_MS;

/**
 * 공개 피드 조회 보존 기간. **이것도 신선도가 아니다.**
 *
 * 신선도가 지난 가격은 사라지는 게 아니라 "참고가격"으로 계속 보여야 한다.
 * 이 창은 그 참고가격을 언제까지 조회할지만 정한다.
 */
export const FEED_QUERY_RETENTION_MS = 30 * DAY_MS;

export type FreshnessSubject = {
  category: OfferCategory;
  evidenceType: OfferEvidenceType;
};

/** 이 증거로 등록한 가격이 최신으로 통하는 기간 — 일. */
export function freshnessWindowDays({
  category,
  evidenceType,
}: FreshnessSubject): number {
  if (category === "liquor" && evidenceType === "licensed_pickup") {
    return FRESHNESS_WINDOW_DAYS.licensedPickup;
  }
  if (evidenceType === "receipt" || evidenceType === "store_photo") {
    return FRESHNESS_WINDOW_DAYS.captured;
  }
  return FRESHNESS_WINDOW_DAYS.officialListing;
}

/** 같은 값의 ms 표현. */
export function freshnessWindowMs(subject: FreshnessSubject): number {
  return freshnessWindowDays(subject) * DAY_MS;
}

/**
 * 이 가격이 최신으로 통하는 마지막 시각.
 *
 * 등록자가 적은 만료 시각과 정책 창 중 **먼저 오는 쪽**을 쓴다. 등록자가
 * 만료를 길게 잡아도 정책을 넘길 수 없고, 짧게 잡으면 그 값을 존중한다.
 */
export function freshUntil(
  subject: FreshnessSubject & { observedAt: number; expiresAt: number },
): number {
  return Math.min(
    subject.expiresAt,
    subject.observedAt + freshnessWindowMs(subject),
  );
}

/** 사용자에게 보여줄 정책 요약. UI 가 숫자를 다시 적지 않게 한다. */
export function describeFreshnessPolicy(): string {
  return [
    `공식 원본 ${FRESHNESS_WINDOW_DAYS.officialListing}일`,
    `성인 인증 픽업 ${FRESHNESS_WINDOW_DAYS.licensedPickup}일`,
    `영수증·매장 가격표 ${FRESHNESS_WINDOW_DAYS.captured}일`,
  ].join(", ");
}
