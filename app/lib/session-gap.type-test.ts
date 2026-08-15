/**
 * 타입 수준 회귀 방지. 실행되지 않고 import 되지도 않는다 — `tsc --noEmit`이
 * 읽는 것만으로 목적을 다한다.
 *
 * 여기 있는 `@ts-expect-error`는 **오류가 나야 통과**한다. 누군가 `SessionGap`을
 * 다시 `number`의 서브타입으로 바꾸면 이 파일이 "쓸모없는 ts-expect-error"로
 * 실패한다. 보호가 조용히 사라지지 않게 하는 장치다.
 *
 * 막으려는 것: 사용자가 타이핑한 숫자가 공개 결론을 만드는 함수에 들어가는 일.
 */
import {
  buildPersonalComparison,
  sessionGapAmount,
  verdictFor,
  type OfferView,
  type PersonalComparison,
  type VerifiedComparison,
} from "./pricing.ts";

declare const personal: PersonalComparison;
declare const verified: VerifiedComparison;
declare const offer: OfferView;

// @ts-expect-error 내 입력 금액은 공개 판정 함수에 들어갈 수 없다.
verdictFor(personal.differenceAtRetailVolume, 3000);

// @ts-expect-error 내 입력 금액은 일반 숫자 연산에 섞일 수 없다.
void (personal.retailPaidTotal + 1);

// @ts-expect-error 내 입력 비교는 공개 비교 자리에 대입될 수 없다.
void (personal satisfies VerifiedComparison);

// @ts-expect-error 승패 필드는 존재하지 않는다. 복사·붙여넣기 대상이 되지 않게.
void personal.dutyWins;

// 꺼내려면 명시적으로 불러야 하고, 그 호출이 리뷰에서 보인다.
void sessionGapAmount(personal.differenceAtRetailVolume);

// 공개 비교의 금액은 반대로 그대로 숫자다.
void verdictFor(verified.savingsAtRetailVolume, 3000);

// 양쪽 다 검수면 개인 비교는 만들어지지 않는다(런타임 규칙, 타입은 통과).
void (buildPersonalComparison(offer, offer) satisfies PersonalComparison | null);

export type {};
