# CherryPicker 감사인 의견서 v6.0에 대한 회신

> 문서 상태: 감사인 회신 답변서 v4.0
> 대상 문서: `CherryPicker 감사인 회신 답변서 v3.0에 대한 의견서 v6.0`
> 작성일: 2026-08-02
> 목적: 승인 질문 6건의 결론을 수용하고, 남은 설계 불일치와 검증 기준을 코드 구현 가능한 형태로 확정한다.

## 0. 결론

감사인 의견서 v6.0의 정정과 제안을 수용한다. 특히 다음 사항을 최종 기준으로 확정한다.

1. 질문 2·3·6은 승인, 질문 1은 8개 정정 반영 후 승인 대상, 질문 4는 부분 승인, 질문 5는 준비 작업 허용으로 해석한다.
2. 고유 blocker는 **13개**, 운영상 종료 묶음은 **11개**다. Kakao 응답 헤더는 외부 Gate이며 blocker 산식에 포함하지 않는다.
3. 화장품 공개 비교는 `verified` 양쪽 가격과 동일 단위·통화·variant 계약이 모두 성립할 때만 생성한다. `captured` 가격은 공개 헤드라인의 근거가 아니다.
4. Phase 0 저장 모델은 금액을 추정하지 않는 `SavedPickV1`로 제한한다. 새 저장 키는 `cherrypicker-comparison-box-v2`, 내부 스키마 버전은 `1`로 분리한다.
5. 단계 선후관계는 하나의 `phase_events` 순서표에서 시작과 완료를 함께 표현한다. 서로 다른 척도의 rank를 비교하지 않는다.
6. 런타임 플래그는 `cloudflare:workers`의 서버 환경값만 사용하고, 정식 플래그 집합은 6개로 고정한다.
7. 이 답변서를 마지막 설계 전용 회신으로 삼는다. 다음 감사 증빙은 별도 remediation branch의 PR #1 코드·테스트·ledger trace로 제출한다. 다만 해당 PR의 병합, 운영 배포, 플래그 활성화 또는 Stage 0 종료 처리는 별도 승인 전까지 하지 않는다.

현재 릴리스 판단은 계속 **조건부 중단**이며, Phase 0/Stage 0은 종료되지 않았다.

---

## 1. 승인 질문 6건에 대한 최종 답변

| 질문 | 감사인 판단 | 당사 최종 답변 | 종료 조건 |
|---|---|---|---|
| Q1. 비교·저장·플래그 설계 | 정정 후 승인 | 8개 정정을 전부 수용한다. §2~§7을 구현 기준으로 사용한다. | Q1-R01~R08의 코드·테스트 증빙 |
| Q2. typed relation/invariant | 승인, 보강 2건 | I-13의 탐색 범위를 단계 목록·순서 서술까지 넓히고 `related_streams`를 순서 의미의 우회로로 사용하지 않는다. | I01~I16 검증 통과 |
| Q3. rank 모델 | 방향 승인, 수식 정정 | 서로 다른 start/completion rank를 폐기하고 하나의 phase event sequence를 사용한다. | I11·I12·I15 통과 |
| Q4. blocker 산식 | 부분 승인 | 고유 blocker 13개, 운영 종료 묶음 11개로 확정한다. | §8 산식과 ledger 일치 |
| Q5. 지금 가능한 작업 | 준비 허용 확인 | 별도 branch의 구현·측정·테스트 준비는 즉시 가능하다. 병합·배포·플래그 활성화·Stage 0 종료 표시는 금지한다. | 승인 경계 준수 |
| Q6. pending-only 운영 | 승인 | 기본값은 pending-only다. 제품 책임자가 최소 3~6주 pending 기간을 수용하지 않을 때만 DATA-SEED-01a를 연다. | 제품 책임자의 명시적 선택 |

---

## 2. Q1 정정사항 8건의 수용 및 구현 계약

| ID | 정정사항 | 확정 구현 계약 | 필수 증빙 |
|---|---|---|---|
| Q1-R01 | `captured`가 공개 헤드라인을 만들 수 있음 | `verifiedOffers`와 `capturedOffers`를 분리한다. 공개 비교 후보는 `verifiedOffers`만 사용한다. `captured` 단독 및 `verified + captured` 혼합 행을 테스트한다. | 공개 문구·절감액이 생성되지 않는 테스트 2건 이상 |
| Q1-R02 | 양쪽 verified가 아닐 때 한쪽 verified가 표에서 사라짐 | 표시용 목록은 항상 `offers = [...verifiedOffers, ...userOffers]`로 구성한다. 공개 비교 성립 여부가 한쪽 verified 행의 표·출처 수를 제거하지 못한다. | duty-only, retail-only 표·출처 수 테스트 |
| Q1-R03 | unit/currency/variant 계약 누락 | `ComparableOffer`에 `unit`, `currency`, `variantKey`를 추가한다. 유효 금액·용량과 세 값의 동일성을 `isComparablePair`가 확인한 뒤에만 비교 함수를 호출한다. 계약 실패와 성공 상태를 분리한다. | 각 불일치와 정상 쌍의 단위 테스트 |
| Q1-R04 | nullable 파생값 목록 불완전 | `bestDuty`, `bestRetail`, 비교 결과, 결정 체인, `savedPick`, `savedPickTotal`을 포함해 공개 비교에서 파생되는 전체 dataflow를 `VerifiedComparison \| null` 및 `DecisionModel \| null`에서 추적한다. | 코드 trace와 strict typecheck |
| Q1-R05 | 정규화 결과가 저장되지 않음 | 복원 후 원본 `stored`가 아니라 `JSON.stringify(normalized)`를 새 키에 기록한다. | 복원→정규화→재시작 회귀 테스트 |
| Q1-R06 | 저장 키 미상향·파싱 실패 시 삭제 | 새 쓰기는 `cherrypicker-comparison-box-v2`만 사용한다. 이전 키는 read-only다. 파싱 실패 원문은 격리 키로 이동하고 전체 저장소를 삭제하지 않는다. | rollback 및 corrupt payload 테스트 |
| Q1-R07 | v1 shape의 미래 호환성 부족 | `schemaVersion`, 안정적 `identityKey`, `category`, `productId`, `comparisonMode`를 저장한다. 가격에 따라 변하는 `decisionTone`은 identity와 분리한다. | identity 안정성·중복 방지 테스트 |
| Q1-R08 | `NEXT_PUBLIC_*`는 request-time 플래그가 아님 | `page.tsx`와 `layout.tsx`의 서버 경계에서 `cloudflare:workers` env를 읽는다. 여섯 플래그 모두 client build-time 환경변수에서 제거한다. | flag on/off SSR 및 hydration DOM 동일성 테스트 |

감사인이 열거한 19개 nullable 파생값은 **최소 관찰 목록**으로 취급한다. 실제 승인 기준은 특정 숫자를 맞추는 것이 아니라, 공개 비교를 루트로 하는 모든 파생값이 코드 trace에 존재하고 null 경로가 타입·테스트로 닫히는 것이다. 구현 중 추가 소비자가 발견되면 목록과 검증 대상을 늘린다.

---

## 3. 공개 비교와 표시 목록의 분리

### 3.1 타입 계약

```ts
type ComparableOffer = {
  channel: "duty-free" | "retail";
  total: number;
  unitPrice: number;
  volume: number;
  unit: "ml" | "g" | "ea";
  currency: string;
  variantKey: string;
  verification: "verified" | "captured" | "user";
};

type VerifiedComparison = {
  duty: ComparableOffer;
  retail: ComparableOffer;
  savingAmount: number;
  savingRate: number;
};
```

`isComparablePair(duty, retail)`은 다음 조건을 모두 만족해야 한다.

- 양쪽 모두 `verification === "verified"`
- 채널이 각각 duty-free와 retail
- `total`, `unitPrice`, `volume`이 유한하고 0보다 큼
- `unit`, `currency`, `variantKey`가 동일

조건을 통과한 경우에만 `compareOffers`를 호출한다. 비교 실패는 0원 절감이 아니라 `null` 비교 상태다.

### 3.2 데이터 흐름

```text
verifiedOffers ─┬─> offers = verifiedOffers + userOffers ─> 표·출처 수
                └─> verified duty/retail pair
                         └─ isComparablePair
                              ├─ fail ─> comparison = null
                              └─ pass ─> VerifiedComparison
capturedOffers ───────────────────────────────> 보조 출처·감사 추적만
```

기본 fixture는 운영 공개 데이터에 합쳐지지 않아야 한다. 특히 검증 데이터가 없는 상태에서 base fixture 때문에 공개 헤드라인이나 절감액이 생기는 경로를 차단한다.

### 3.3 nullable 파생값 원칙

`VerifiedComparison | null`에서 파생되는 값은 개별 기본값으로 사실을 만들어내지 않는다.

- `bestDuty`, `bestRetail`: 공개 비교 후보가 없으면 `null`
- `savingAmount`, `savingRate`, 승자·문구: 비교가 없으면 `null`
- `quickDecision`, `decisionTone`: 비교가 없으면 `null`
- `savedPick`: Phase 0에서는 비교 결과가 아니라 pending identity로 생성
- `savedPickTotal`: `amount !== null`인 항목만 합산

배열 fallback으로 `bestDuty` 또는 `bestRetail`을 조작하거나, null을 0으로 바꿔 공개 판단을 생성하지 않는다.

---

## 4. 상태표와 테스트 범위

### 4.1 화장품 핵심 상태 8개

| ID | 입력 상태 | 표/출처 | 공개 비교 | 저장 |
|---|---|---|---|---|
| C1 | 가격 없음 | 빈 상태 | 없음 | pending 저장 가능 |
| C2 | verified duty만 존재 | duty 1행 유지 | 없음 | pending 저장 가능 |
| C3 | verified retail만 존재 | retail 1행 유지 | 없음 | pending 저장 가능 |
| C4 | captured만 존재 | 보조 출처로 구분 | 없음 | pending 저장 가능 |
| C5 | verified duty + captured retail | 두 출처의 등급을 구분 | 없음 | pending 저장 가능 |
| C6 | captured duty + verified retail | 두 출처의 등급을 구분 | 없음 | pending 저장 가능 |
| C7 | verified 양쪽, 단위·통화·variant 계약 실패 | 양쪽 행 유지 | 없음 | pending 저장 가능 |
| C8 | verified 양쪽, 계약 통과 | 양쪽 행 유지 | 생성 | Phase 0에서는 pending 저장 |

base fixture 비노출은 위 상태의 공통 전제이자 별도 회귀 테스트다. 상태 행 수를 늘리는 대신 모든 C1~C8에 적용되는 invariant로 둔다.

### 4.2 주류 별도 경로

| ID | 입력 상태 | 기대 결과 |
|---|---|---|
| L1 | 가격 없음 | 공개 비교 없음, 거래 유도 없음 |
| L2 | verified duty만 존재 | 단일 행만 표시, 비교 없음 |
| L3 | verified retail만 존재 | 단일 행만 표시, 비교 없음 |
| L4 | verified 양쪽이나 계약 실패 | 양쪽 행 표시, 비교 없음 |
| L5 | verified 양쪽이며 계약 통과 | 비교는 가능하되 주류 정책·Gate를 우회하지 않음 |

주류 테스트는 화장품 matrix에 암묵적으로 포함하지 않는다. `ALCOHOL_COMMERCE_ENABLED`가 꺼진 경우 거래 유도 UI가 SSR과 hydration 이후 모두 없어야 한다.

---

## 5. SavedPickV1 및 저장 마이그레이션

### 5.1 Phase 0 저장 shape

```ts
type SavedPickV1 = {
  schemaVersion: 1;
  identityKey: string | null;
  category: "cosmetics" | "liquor" | "other";
  productId: string | null;
  title: string;
  comparisonMode: "pending" | "legacy-unknown";
  decisionTone: null;
  amount: null;
  amountState: "pending" | "legacy-unknown";
  savedAt: string;
  savedAtBasis: "user-action" | "legacy-import";
};
```

스키마 버전과 저장 키 버전을 분리한다.

- 쓰기 키: `cherrypicker-comparison-box-v2`
- 현재 내부 스키마: `schemaVersion: 1`
- Phase 0의 신규 항목: `comparisonMode: "pending"`, `amount: null`
- 복구할 수 없는 과거 항목: `comparisonMode: "legacy-unknown"`, `amount: null`
- 검증 금액 저장: Phase 1의 별도 schema v2에서만 도입

`identityKey`는 가격·절감액·`decisionTone`으로 만들지 않는다. 신규 항목은 `category + productId` 등 안정 식별자로 생성한다. 과거 payload에서 안정 식별자를 복구할 수 없으면 `null`을 유지하고, 불확실한 항목을 같은 상품으로 단정하여 중복 제거하지 않는다.

### 5.2 복원·쓰기 규칙

1. v2 키가 있으면 가장 먼저 읽는다.
2. v2가 없을 때만 기존 키를 read-only로 읽는다.
3. 파싱과 shape 검증에 성공하면 `SavedPickV1[]`로 정규화한다.
4. **정규화된 값**을 v2 키에 쓴다.
5. 파싱 실패 payload는 원문·원키·발생시각과 함께 제한된 quarantine 키로 이동한다.
6. 오류가 한 건 발생해도 다른 키나 정상 항목을 삭제하지 않는다.
7. 총액은 `amount !== null`인 항목만 합산한다. Phase 0 신규 항목만 있을 때 기대 총액은 0이다.

### 5.3 필수 회귀 시나리오

- 기존 유효 payload → 정규화 → v2 재저장 → 재시작 후 동일 상태
- 기존 `amount` 유한성 조건을 만족하지 않는 payload → `legacy-unknown`, `amount: null`
- 손상된 JSON → quarantine 보존, 정상 키 비삭제
- 신규 bundle이 v2 기록 → 구 bundle이 기존 키에 기록 → 신규 bundle 복귀 시 v2 데이터 유지
- 같은 안정 identity 신규 저장 → 중복 방지
- identity를 복구할 수 없는 legacy 두 건 → 임의 병합 금지
- `amount: null`만 존재 → 총액 0, TypeScript 오류 없음

Stage 0에서는 pending과 legacy의 **저장·복원·합계 의미**만 구분한다. 두 상태의 UI 시각적 구분은 Phase 1로 이동한다.

---

## 6. request-time 플래그와 서버 경계

### 6.1 정식 플래그 집합

| Flag | 기본값 | 서버 소비자 | 핵심 증빙 |
|---|---|---|---|
| `MONETIZATION_ENABLED` | off | root layout, ad slot props | script/slot SSR 미출력 |
| `KAKAO_IMPORT_ENABLED` | off | page/server action | import UI·action 차단 |
| `ALCOHOL_COMMERCE_ENABLED` | off | page | 주류 거래 유도 미출력 |
| `TELEMETRY_ENABLED` | off | server telemetry adapter | event 전송 없음 |
| `AUTO_CONFIRM_ENABLED` | off | server workflow | 자동 확정 경로 차단 |
| `ADMIN_UI_ENABLED` | off | admin server boundary | admin UI 접근 차단 |

### 6.2 구현 경계

- `app/page.tsx`: async server wrapper, `export const dynamic = "force-dynamic"`
- `app/page-client.tsx`: 현재 client UI를 이동하고 서버가 계산한 flag props를 받음
- `app/layout.tsx`: root script의 부모이므로 request-time env를 읽는 dynamic server boundary
- `AdSlot`: `NEXT_PUBLIC_ADSENSE_*`를 직접 읽지 않고 서버가 전달한 `enabled`, `client`, `slot`만 사용
- env source: `cloudflare:workers`의 `env`만 사용

서버 wrapper는 B08에 종속된 부수 작업이 아니라 독립 blocker B13이다. 최소 런타임 증빙은 각 중요 플래그의 on/off SSR HTML과 hydration 이후 DOM이 같은 정책 결과를 보이는 것이다.

`NEXT_PUBLIC_*` 값은 빌드 결과에 고정되므로 위 6개 운영 플래그의 source of truth로 사용하지 않는다.

---

## 7. 단일 phase event sequence와 invariant

### 7.1 순서 모델

모든 시작·완료 사건을 같은 척도에 놓는다.

```text
phase_events(phase, event_rank, stream_id, event_type)
event_type ∈ {start, complete}
UNIQUE(phase, event_rank)
```

각 stream은 정확히 한 개의 start event와 complete event를 가져야 하며, `(phase, event_rank)`를 사전식으로 비교한 전역 event key에서 `start < complete`여야 한다. `precedes`, `requires`, `gates`는 이 동일한 event sequence를 사용해 검증한다. 별도 completion rank와 start rank 사이의 직접 비교는 금지한다.

### 7.2 최종 invariant 목록

| ID | 검증 규칙 |
|---|---|
| I01 | 모든 stream ID는 catalog에 정확히 한 번 존재한다. |
| I02 | phase 목록의 모든 stream은 catalog에 존재하며 phase 값이 일치한다. |
| I03 | 모든 blocker ID는 blocker catalog에 정확히 한 번 존재한다. |
| I04 | stream의 `blocked_by`는 존재하는 blocker 또는 외부 Gate만 참조한다. |
| I05 | `owner`, `output`, `evidence`, `closure` 필드는 비어 있지 않아야 한다. |
| I06 | status·phase·blocker 변경은 ledger뿐 아니라 §8.1 blocker 산식과 §14 종합 결론에도 동일하게 반영된다. |
| I07 | `precedes`, `requires`, `gates` 대상은 존재하는 stream이어야 하며 자기 자신을 참조할 수 없다. |
| I08 | typed relation graph에는 cycle이 없어야 한다. |
| I09 | `requires` 대상은 종속 stream 시작 전에 완료되어야 한다. |
| I10 | Phase 0~1 종료 시점까지 완료되지 않은 P0만 예외·외부 Gate·후속 phase 근거를 가져야 한다. 이미 Phase 0~1에서 완료된 P0에는 예외를 강제하지 않는다. |
| I11 | `precedes`는 하나의 `phase_events` 순서에서 선행 stream의 complete event가 후행 stream의 start event보다 앞서야 한다. |
| I12 | `gates`의 같은 phase 순서도 I11과 동일한 `phase_events` event order를 사용한다. |
| I13 | 순서 의미가 있는 문구를 `output`, `evidence`, `closure`, phase 목록, ordering prose에서 탐지한다. `related_streams`에는 `precedes`·`after`·`requires`·`gates` 의미를 숨길 수 없다. |
| I14 | 플래그 catalog, env type, owner, 소비 코드, 증빙 matrix의 집합이 §6.1의 정확한 6개와 일치해야 한다. |
| I15 | 모든 stream은 정확히 하나의 start/complete event를 가지며 `(phase, event_rank)`가 유일하고, 사전식 전역 event key에서 start가 complete보다 앞서야 한다. |
| I16 | P0 stream과 Gate의 code trace는 필수 필드가 존재하고 `(stream_id, path, symbol, test_id)`가 중복되지 않으며, test ID와 `tested_commit`이 실제 증빙과 연결되어야 한다. |

I13은 자연어를 모두 금지하는 규칙이 아니다. 순서 의존성을 자유서술에만 숨겨 typed relation 검증을 우회하는 경우를 실패시킨다.

---

## 8. blocker 산식 확정

### 8.1 고유 blocker 13개

| ID | 요약 | 운영 종료 묶음 |
|---|---|---|
| V5-B01 | 공개 비교의 verified-only 계약 및 상태 분리 | 01 |
| V5-B02 | null-safe 비교·결정·저장 dataflow | 02 |
| V5-B03 | Cloudflare 배포 기준선과 설정 drift | 03 |
| V5-B04 | 단일 ledger source of truth | 04 |
| V5-B05 | typed relation schema | 05 |
| V5-B06 | phase order·dependency 검증 | 06 |
| V5-B07 | invariant 실행기와 실패 증빙 | 07 |
| V5-B08 | 런타임 플래그·owner·증빙 | 08 |
| V5-B09 | Phase 0/1 ownership 및 승인 경계 | 09 |
| V5-B10 | pending-only 제품 결정과 DATA-SEED 조건 | 10 |
| V5-B11 | SavedPick migration·rollback·quarantine | 11 |
| V5-B12 | `configPath` 부작용 및 원본 누락 시 prebuild diff 실패 | 03과 함께 종료 |
| V5-B13 | server wrapper·request-time env 전환 | 08과 함께 종료 |

따라서 산식은 다음과 같다.

```text
고유 blocker 수 = 11 + V5-B12 + V5-B13 = 13
운영 종료 묶음 수 = 11
Kakao 응답 헤더 = 외부 Gate, blocker 산식 제외
Q1-R01~R08 = blocker 추가가 아니라 V5-B01·B02·B08·B11의 하위 승인 기준
```

`configPath` 부작용은 B03과 같은 작업 묶음에서 해소할 수 있지만 독립 실패 원인이므로 B12로 센다. server wrapper 역시 B08과 함께 구현할 수 있으나 독립 런타임 증빙이 필요하므로 B13으로 센다.

### 8.2 blocker 영역별 분포

| 영역 | blocker | 수 |
|---|---|---:|
| 가격 신뢰·저장 | B01, B02, B11 | 3 |
| ledger·invariant | B04, B05, B06, B07 | 4 |
| ownership·phase·server boundary | B08, B09, B10, B13 | 4 |
| 배포 설정 | B03, B12 | 2 |
| **합계** |  | **13** |

---

## 9. 배포 설정과 기준선 보강

현재 저장소에 `wrangler.jsonc`가 없으므로 존재를 전제로 한 검증은 통과 처리할 수 없다. BUILD-01b0에서 실제 배포 입력 파일과 생성·변환 경로를 측정한 뒤 기준선을 고정한다.

prebuild diff는 다음 조건을 만족해야 한다.

- 비교 대상 원본이 없으면 성공이 아니라 실패
- `configPath` 실행 전후의 파일 목록·내용 hash·환경변수 참조를 기록
- 허용 변경 목록 밖의 생성·수정·삭제가 있으면 실패
- 로컬 측정은 지금 가능하지만 기준선 확정은 BUILD-01b0/Stage 0B에서 수행

다음 업그레이드 준비, token 410 회귀 테스트 준비, 문서 정리, `tsconfig.tsbuildinfo` 추적 제외 준비는 가능하다. 다만 현 답변은 저장소 설정을 실제 변경하거나 커밋하지 않는다.

---

## 10. pending-only 운영 기간과 DATA-SEED 조건

기본 경로는 **최소 3~6주 pending-only 운영**이다. 이 기간에는 검증되지 않은 가격으로 절감액·승자·추천을 만들지 않는다.

DATA-SEED-01a는 다음 경우에만 연다.

1. 제품 책임자가 최소 3~6주의 pending-only 상태를 수용할 수 없다고 명시한다.
2. 시드 데이터의 출처·검증일·단위·통화·variant와 갱신 책임자가 확정된다.
3. 시드가 base fixture 또는 예시 데이터를 운영 사실처럼 노출하지 않는다는 테스트가 준비된다.

제품 책임자의 선택이 없으면 DATA-SEED-01a를 기본 일정에 넣지 않는다.

---

## 11. 다음 증빙: remediation PR #1

감사인의 제안대로 문서 회신 반복을 중단하고 별도 remediation branch에서 다음을 수행한다.

1. 공개 비교에서 파생되는 unguarded 값을 전수 열거한다.
2. `savedPicks` 소비자 6개와 `offers` 소비자를 실제 코드 기준으로 다시 계수하고 trace를 만든다.
3. 화장품 C1~C8, 주류 L1~L5, base fixture 비노출 테스트를 추가한다.
4. null-safe 비교와 Phase 0 `SavedPickV1` 저장·복원·rollback을 구현한다.
5. ledger의 `code_trace`, `test_id`, `tested_commit`을 실제 실행 결과로 채운다.
6. six-flag server boundary와 SSR/hydration 동등성 테스트를 준비한다.

허용 범위:

- 별도 branch 생성
- 구현, 테스트, 측정, 문서·ledger 갱신
- 리뷰 가능한 PR 생성

금지 범위:

- v1.2 검증을 우회한 병합
- 운영 배포
- 운영 플래그 활성화
- Stage 0 또는 blocker의 완료 표시

PR #1은 문서의 주장 자체가 아니라 코드·테스트 증빙을 제출하는 수단이다. `tested_commit`은 테스트를 실제 실행한 commit SHA와 일치해야 한다.

---

## 12. 감사 한계 및 외부 확인사항

현 저장소 정적 검토만으로 다음을 확정하지 않는다.

- H01 운영 환경의 실제 응답 헤더
- Kakao 운영 브라우저·인증·CORS 동작
- 의존성 설치가 완료된 환경의 Next.js 전체 build/test
- D1 cold-start 및 운영 성능
- 광고·주류·개인정보 관련 법률 판단
- 운영 부하에서의 성능·비용 수치

위 항목은 외부 Gate 또는 별도 운영·법률 검증으로 유지한다.

---

## 13. 감사인에게 요청하는 최종 확인

다음 네 항목의 확인을 요청한다.

1. Q1-R01~R08을 반영한 §2~§6의 공개 비교, 상태표, 저장 migration, 서버 플래그 설계를 구현 기준으로 승인하는가?
2. 단일 `phase_events` 순서와 I01~I16을 ledger 검증 기준으로 승인하는가?
3. 고유 blocker **13개**, 운영 종료 묶음 **11개**, Kakao 응답 헤더 외부 Gate라는 산식을 승인하는가?
4. 다음 감사 제출물을 추가 설계 답변서가 아니라 remediation PR #1의 코드·테스트·ledger evidence로 전환하는 데 동의하는가?

이 네 항목이 승인되더라도 blocker가 자동 종료되거나 릴리스가 승인되는 것은 아니다. 실제 종료는 해당 PR의 구현·테스트·운영 Gate 증빙을 검토한 뒤 별도로 판정한다.

---

## 14. 종합 판단

v6.0으로 핵심 의미와 산식은 충분히 수렴했다. 남은 불확실성은 문장 표현이 아니라 구현과 실행 증빙에 있다.

- 승인: Q2, Q3, Q6
- 정정 반영 후 구현 검증 대상: Q1
- 산식 확정: Q4 — 고유 13, 종료 묶음 11
- 즉시 허용: Q5 — 별도 branch의 준비·구현·측정·테스트
- 계속 금지: 병합, 운영 배포, 플래그 활성화, Stage 0 종료 표시
- 다음 산출물: remediation PR #1
- 현재 릴리스 판단: **조건부 중단 유지**

본 답변서를 설계 전용 회신의 종료점으로 삼고, 다음 검토부터는 실행 가능한 코드와 재현 가능한 테스트를 기준으로 판단한다.
