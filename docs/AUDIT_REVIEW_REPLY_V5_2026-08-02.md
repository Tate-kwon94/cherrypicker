# CherryPicker 감사인 의견서 v5.0에 대한 회신

문서 상태: 감사인 회신 답변서 v3.0  
대상 문서: `CherryPicker 감사인 회신 답변서 v2.0에 대한 의견서 v5.0`  
선행 문서: `docs/AUDIT_REVIEW_REPLY_V4_2026-08-01.md`, `docs/AUDIT_RESPONSE_V1.1_2026-08-01.md`  
감사 기준일·커밋: 2026-08-01 · `99aa303`  
답변 기준일: 2026-08-02  
대상 독자: 감사인, 제품 책임자, 개발 책임자, 데이터·플랫폼·보안 담당자

> 본 회신은 감사인 의견서 v5.0의 권고 철회 3건, 승인 질문 4건, 코드 적용 결함, 원장 invariant 사각지대와 제품 결정 사항에 대한 최종 입장을 정리한다. 문서 설계와 코드 구현 완료를 구분하며, 아직 실행되지 않은 변경을 완료로 표시하지 않는다.

## 기술 요약

감사인 의견서 v5.0의 주된 결론을 수용한다. 특히 다음 두 결함은 현재 코드에서 재확인됐다.

- 현재 복원 검증기는 `Number.isFinite(item.amount)`를 요구하므로, 단계 0에서 `amount` 없이 저장한 pick은 새로고침 시 삭제된다.
- 현재 비교 파생값은 `offers[0]`·`offers[1]`이 존재한다고 가정한다. null-safe 전환 없이 `baseOffers`만 제거하면 검수 쌍 0건 또는 한쪽만 있는 상태에서 렌더 전에 예외가 발생한다.

따라서 질문 1의 분리 설계는 유지하되 `PRICE-01a0`과 `TRUST-01a0`의 산출물·검증 범위를 하류 호출자와 복원기까지 확장한다.

최종 입장은 다음과 같다.

- 감사인이 철회한 `currentComparisonReady`, secret의 평문 `vars`, baseline 18 고정 권고는 철회된 것으로 종결한다.
- 질문 1의 **정정 후 승인**과 질문 2의 **승인**을 수용한다.
- 질문 3의 **아니오**를 수용한다. I-01~I-08만으로는 충분하지 않으며 I-09~I-13과 코드 추적 종료 조건을 추가한다.
- 질문 4의 **유보**를 수용한다. v1.2 원장과 검산 결과가 없으면 단계 0을 승인하지 않는다.
- v5.0의 차단 사항은 중복 계산을 피하기 위해 11개 종료 묶음으로 관리한다. Part 4의 config 전환 부작용과 server wrapper 선행조건은 각각 DEPLOY·ENV 묶음의 필수 하위 조건으로 편입한다.
- 제품 책임자가 pending-only 운영과 검증 seed 공급 경로 중 하나를 명시적으로 선택하기 전에는 안전 기본값인 pending-only를 유지한다.
- 현 출시 판단은 계속 **조건부 중단**이다.

## 1. 감사인 권고 철회 3건

### 1.1 `currentComparisonReady` 권고 철회

철회를 확인한다. 현재 cosmetics 경로는 `verified || captured`를 함께 사용하고 best offer가 sample로 폴백할 수 있으므로 공개 가격 비교 자격을 증명하지 못한다.

v1.2의 공개 비교 자격은 다음 구조 조건으로 고정한다.

```text
publicComparisonReady =
  verified duty offer exists
  AND verified retail offer exists
  AND unit/currency/variant comparison contract passes
```

`captured` 오퍼는 별도 `내 입력 포함 비교`에서만 사용할 수 있고 public headline·판매처 수·절감액의 근거가 될 수 없다.

### 1.2 secret의 평문 `vars` 선언 철회

철회를 확인한다. 실제 값과 타입 선언을 분리한다.

- `NEXT_PUBLIC_SITE_URL`처럼 공개 가능한 값만 일반 `vars` 후보로 둔다.
- `KAKAO_SKILL_TOKEN`, `ADMIN_EMAILS`는 version 관리되는 설정에 실제 값을 저장하지 않는다.
- `worker-secret-bindings.d.ts`는 binding의 이름과 타입만 declaration merging한다.
- 실제 값은 secret binding 또는 승인된 배포 환경에서 주입하고 fail-fast 증거를 별도로 남긴다.

### 1.3 baseline 18 고정 철회

철회를 확인한다. 27→18→16은 구성별 실측 이력으로 보존하되 어느 값도 최종 baseline으로 선고정하지 않는다.

최종 규범은 다음 순서다.

1. 배포 설정, generated type, secret type, runtime/app 경계를 확정한다.
2. 동일한 고정 명령으로 최소 구성과 전체 구성을 측정한다.
3. 그 시점의 파일·오류코드 집합을 baseline으로 저장한다.
4. 신규 오류 0 Gate를 적용한다.
5. 단계 1 종료 시 오류를 0으로 만들고 baseline을 삭제한다.

## 2. 승인 질문 4건에 대한 답변

### 2.1 질문 1 — 정정 후 승인을 수용한다

`AUTO_CONFIRM_ENABLED`를 OCR 자동 승격에만 한정하고 savedPicks를 별도 구조 조건으로 보호한다는 방향은 유지한다. 다만 단계 0 schema와 복원 계약을 다음처럼 수정한다.

#### SavedPick 단계 0 정규형

```ts
type SavedPickAmountState = "pending" | "legacy-unknown" | "verified";

type SavedPick = {
  schemaVersion: 1;
  key: string;
  title: string;
  savedAt: number;
  savedAtBasis: "epoch" | "legacy-unknown";
  amount: number | null;
  amountState: SavedPickAmountState;
};
```

이 예시는 단계 0 최소 계약이다. 단계 1의 provenance·mode·구매 가능한 대안 쌍은 별도 schema upgrade로 추가한다.

단계 0 동작은 다음과 같다.

- 모든 신규 pick은 `Date.now()`와 `amount: null`, `amountState: "pending"`으로 저장한다.
- schemaVersion이 없는 기존 레코드는 삭제하지 않고 `amount: null`, `amountState: "legacy-unknown"`으로 정규화한다.
- 기존 `event.timeStamp` 값은 epoch로 재해석하지 않고 `savedAtBasis: "legacy-unknown"`으로 보존한다.
- 복원 검증기는 key·title·저장시각의 구조를 검증하되 `amount === null`을 유효 상태로 허용한다.
- 합계는 `amountState === "verified" && Number.isFinite(amount)`인 레코드만 사용한다.
- pending과 legacy-unknown을 UI와 migration에서 서로 다른 상태로 취급한다.

`PRICE-01a0` 종료 증거에 다음 회귀 사례를 추가한다.

1. amount 없는 신규 pick 저장 후 새로고침해도 남아 있다.
2. schemaVersion 없는 기존 레코드가 `legacy-unknown`으로 남아 있다.
3. pending·legacy-unknown이 표시·합계에 포함되지 않는다.
4. 합계가 `NaN`이 되지 않는다.
5. 단계 0 신규 저장시각은 epoch이고 기존 monotonic 값은 epoch로 위장되지 않는다.

### 2.2 질문 1의 `TRUST-01a0` 적용 순서를 수정한다

`baseOffers` 제거 전에 모든 파생값을 null-safe 구조로 전환한다.

선택한 구조는 다음과 같다.

```text
verifiedDuty + verifiedRetail
  └─ 둘 다 존재하고 비교 계약 통과 → VerifiedComparison
  └─ 그 외 → null

VerifiedComparison
  └─ comparison, quickDecision, dutyDecision, retailDecision 생성
null
  └─ pending 카드만 생성
```

구현 조건은 다음과 같다.

- `bestDuty`·`bestRetail`의 sample/배열 index 폴백을 제거한다.
- `comparison`, `retailPrice`, `dutyUnit`, `retailUnit`은 검증 쌍이 있을 때만 계산한다.
- `quickDecision`, `dutyDecision`, `retailDecision`도 같은 nullable 결과에서만 생성한다.
- cosmetics 공개 headline은 `verified` 쌍만 사용한다.
- captured 오퍼는 명시된 개인 비교 영역에서만 노출하고 public recommendation readiness에 포함하지 않는다.
- 비교표는 sample을 제외한다. verified와 명시적으로 구분된 captured 행만 허용한다.
- 위 전환과 테스트가 끝난 뒤 `baseOffers`를 공개 fallback에서 제거한다.

`TRUST-01a0` 종료 증거는 최소 다음 상태를 포함한다.

| 상태 | 기대 결과 |
|---|---|
| published 0, captured 0 | 예외 없이 pending 카드 |
| verified duty만 1 | 예외 없이 pending 카드 |
| verified retail만 1 | 예외 없이 pending 카드 |
| captured만 존재 | public headline 없음, 개인 입력으로 명확히 구분 |
| verified duty+retail | 검증 계약 통과 시에만 공개 비교 표시 |
| baseOffers만 존재 | 공개 추천·판매처 수·절감액 0 |

### 2.3 질문 2 — 승인으로 종결한다

declaration merging과 최종 구성 실측 순서를 승인된 것으로 종결한다.

감사인의 추가 지적도 수용한다. 현재 `runtimeBindings()`의 `env as unknown as KakaoBindings`는 binding 타입을 우회하므로 `KAKAO-SEC-01b`에 다음을 추가한다.

- 이중 캐스팅을 제거한다.
- 생성·보강된 `Cloudflare.Env`에서 필요한 binding만 명시적으로 어댑트한다.
- 누락 secret은 import 처리 전에 fail-fast한다.
- 타입 선언이 실제 runtime 검증을 대체하지 않음을 테스트와 종료 조건에 명시한다.

### 2.4 질문 3 — “아니오”를 수용하고 invariant를 확장한다

I-01~I-08이 15개 시험 사례 중 완전 검출 5, 부분 검출 1, 미검출 9라는 결론을 수용한다. 기존 8개를 폐기하지 않고 다음 검산을 추가한다.

기존 invariant는 다음 수정 문언으로 유지한다.

| ID | v1.2 검산 계약 | 실패 시 처리 |
|---|---|---|
| I-01 | `coverage_role=primary`인 원문 ID의 합집합이 H 11 + M 30 + L 23 + A 9 = 73이며 결손 0 | 채택 불가 |
| I-02 | 각 원문 ID의 primary가 정확히 1개이며 continuation은 primary를 참조하고 control은 보완 대상 ID를 가짐 | 채택 불가 |
| I-03 | 모든 `depends_on` ID가 존재하고 dependency graph에 cycle이 없음 | 채택 불가 |
| I-04 | 모든 hard dependency가 단계 및 단계 내 순서에서 소비 행보다 먼저 완료 | 순서 수정 전 채택 불가 |
| I-05 | 각 feature flag가 `start_phase=0`, `completion_phase=0`인 소유 행과 실제 적용 지점을 가짐 | Gate 실패 |
| I-06 | §9·§10·§11·§12·§13·§16·§17, 항목별 표, 원장, 단계 목록의 Stream ID와 단계가 양방향 일치 | 채택 불가 |
| I-07 | 모든 필수 stream과 control에 판정 가능한 owner·산출물·증거·종료 조건이 존재 | 착수 불가 |
| I-08 | 최종 종료 시 모든 필수 stream과 control이 closed이거나 owner·승인자·만료일이 있는 external Gate | 라운드 종료 불가 |

추가 invariant는 다음과 같다.

| ID | v1.2 검산 계약 | 실패 시 처리 |
|---|---|---|
| I-09 | 모든 원장 행이 completion phase 목록에 1회 이상 등장하고, start와 completion이 다르면 start phase 목록에도 등장 | 채택 불가 |
| I-10 | 모든 P0/Gate 원문 ID가 단계 0 보호행·승인된 flag 차단 범위·승인자와 만료일이 있는 예외 중 하나에 포함 | 채택 불가 |
| I-11 | 같은 단계의 hard dependency가 선행하도록 단계 내 순서를 기계 판정 | 순서 수정 전 채택 불가 |
| I-12 | 모든 Gate 행이 차단 대상 `gates`를 가지고 대상은 Gate 완료 뒤 시작하며, Gate 문구가 있으나 대상이 비면 실패 | 채택 불가 |
| I-13 | 다른 Stream ID에 대한 관계가 자유 텍스트에만 존재하지 않고 typed relation으로 표현됨 | 관계 보완 전 채택 불가 |

I-11은 다단계 행에서도 모호하지 않도록 단일 `order_rank` 대신 다음 두 값을 사용한다.

- `start_order_rank`: start phase 안에서 행이 활성화되는 순서
- `completion_order_rank`: completion phase 안에서 행이 완료되는 순서

hard dependency `D → R`은 다음을 모두 만족해야 한다.

```text
completion_phase(D) < start_phase(R)
OR
(
  completion_phase(D) == start_phase(R)
  AND completion_order_rank(D) < start_order_rank(R)
)
```

I-13의 목적은 수용하되 “다른 ID가 텍스트에 나오면 모두 Depends on”이라는 원문은 그대로 사용하지 않는다. Gate 대상, 커버리지 대상, 단순 관련 항목을 dependency로 강제하면 반대 방향 edge와 cycle을 만들 수 있기 때문이다.

대신 관계를 다음처럼 분류한다.

- `depends_on`
- `gates`
- `covers`
- `related_streams`

산출물·증거·종료 조건에 다른 Stream ID가 등장하면 위 typed relation 중 하나에 반드시 존재해야 한다. `선행`, `완료 뒤`, `필요` 의미의 참조는 반드시 `depends_on`이어야 한다. 관계가 없는 자유 텍스트 참조는 검산 실패로 처리한다.

또한 다음 보강을 수용한다.

- I-05의 소유 행은 `start_phase=0`, `completion_phase=0`이어야 한다.
- I-06의 대상 절에 §11·§12·§16을 추가하고 양방향으로 검사한다.
- 단계 목록에 있는 ID가 원장에 없는 경우와 원장 필수 ID가 단계 목록에 없는 경우를 모두 실패시킨다.
- `coverage_role=control`도 단계·owner·증거·종료 검산에서 제외하지 않는다.

문서와 코드의 정합성을 보완하기 위해 P0/Gate 행에는 다음 code-trace 필드를 필수로 둔다.

```text
implementation_sites
direct_callers
parsers_or_validators
derived_values
test_ids
tested_commit
```

이 필드의 존재만으로 코드 정확성이 입증되는 것은 아니다. 해당 commit에서 test_ids가 통과한 증거까지 있어야 종료할 수 있다.

### 2.5 질문 4 — 승인 유보를 수용한다

v1.2 병합과 I-01~I-13 검산 결과가 없으므로 단계 0 착수 승인을 요청하지 않는다. 코드 변경 준비와 단계 착수의 경계는 §8에서 별도로 확인 요청한다.

## 3. 회신 자체의 위반 4건 정정

### 3.1 단계 0의 무명 작업에 Stream ID와 owner를 부여한다

v4.0 회신의 단계 0 항목 1~3을 다음 실행 행으로 분해한다.

| Stream ID | 소유 범위 | owner 역할 | 단계 |
|---|---|---|---:|
| `BUILD-01a0` | server/client·DTO·runtime 최소 경계 추출 | Platform | 0 |
| `DEPLOY-01a0` | `configPath`, 원본 설정 일치, 전환 diff | Platform/Deploy | 0 |
| `ENV-01a1` | generated binding type와 secret declaration 보강·fail-fast | Platform/Security | 0 |
| `BUILD-01b0` | 최종 구성 baseline 실측·신규 오류 0 Gate | Platform | 0 |

개인 owner 이름은 원장 채택 전에 지정한다. 위 역할명만으로 I-07을 통과한 것으로 간주하지 않는다.

### 3.2 L-11 이동 지시를 모든 표에 적용한다

L-11은 `UX-01b1` 단계 3에서 `TRUST-01a1` 단계 1로 이동한다. 다음 위치를 함께 정정한다.

- 73개 항목별 판정표
- 상위 프로그램 집계표
- 실행 원장
- 단계 목록
- 원문 ID별 primary/continuation 관계

이 변경은 L-11만 대상으로 하며 UX-01b1의 M-08·L-12·L-13까지 이동시키지 않는다.

### 3.3 `coverage_role` 정의를 시간 순서와 분리한다

`continuation`을 “후속 구현”으로 정의한 문구를 폐기한다.

| role | 수정 정의 |
|---|---|
| `primary` | 원문 ID의 유일한 회계 소유 행 |
| `continuation` | 같은 원문 ID를 추가로 구현·검증하는 실행 분할. primary보다 먼저 또는 뒤에 올 수 있으며 시간 의미 없음 |
| `control` | 하나 이상의 원문 ID를 횡단 보호하는 공통 통제 |

모든 신규 행은 role과 primary reference 또는 보완 대상 ID를 명시한다. OCR-01a0처럼 primary보다 먼저 실행되는 행도 이 정의로 모순 없이 continuation이 될 수 있다.

### 3.4 savedPicks migration을 단계 0과 단계 1로 분리한다

“단계 1에서 한 번에 migration” 문구를 폐기한다.

- 단계 0: schema v1 도입, pending/legacy-unknown 구분, nullable amount, epoch 신규 저장, 안전 복원·표시·합계
- 단계 1: schema v2 도입, verified amount 의미론, mode·offer provenance·구매 가능한 대안 쌍, v1→v2 migration

각 단계는 독립적인 forward migration·read compatibility·rollback/forward-fix 증거를 가진다.

## 4. 배포 설정과 flag 적용 조건

### 4.1 drift 검사는 빌드 전과 후로 나눈다

감사인의 지적을 수용한다.

| 시점 | 비교 | 실패 조건 |
|---|---|---|
| build 전 | `.openai/hosting.json` ↔ `wrangler.jsonc` | binding·공개 설정 불일치 |
| build 후 | 위 두 원본 ↔ `dist/server/wrangler.json`·deploy redirect | binding·name·date·flag·observability·main·asset 차이 중 미승인 항목 존재 |

빌드 전 검사가 빌드 산출물을 요구하지 않게 한다. 자동 수정은 하지 않는다.

### 4.2 `configPath` 전환 부작용을 DEPLOY 종료 조건에 포함한다

`DEPLOY-01a0`은 전환 전후 `dist/server/wrangler.json`을 구조적으로 비교한다.

검사 대상은 최소 다음과 같다.

- `observability`
- `name`
- `compatibility_date`
- `compatibility_flags`
- D1·R2·vars·secret binding 이름
- `main`, assets directory, deploy redirect
- 빌드 머신 절대경로 또는 사용자 홈 경로의 산출물 유입 여부

허용된 차이는 allowlist와 승인자를 가져야 한다. 절대경로가 산출물에 남으면 재현성·정보노출 관점에서 실패시킨다.

### 4.3 client root를 server wrapper와 client component로 분리한다

현재 `app/page.tsx`가 `"use client"` 루트이므로 server prop을 내려줄 부모가 없다는 지적을 수용한다.

`BUILD-01a0`의 첫 작업은 전체 runtime refactor가 아니라 다음 최소 분리다.

```text
app/page.tsx                 server wrapper
app/components/page-client  client UI
server runtime flag reader  fail-closed parsing
```

`ENV-01a0`은 이 최소 분리에 의존한다. client-visible flag는 server가 boolean으로 정규화해 prop으로 전달한다. 관리자 page/API처럼 server-only 경로는 server adapter에서 직접 읽는다.

종료 증거는 flag 누락·오타·잘못된 문자열에서 false, SSR과 hydration 후 대상 DOM 0, page/API의 비노출 응답을 포함한다.

## 5. 단계 0 위험 순서를 다시 배치한다

대형 경계 refactor를 여섯 안전 통제보다 먼저 실행하는 순서를 수정한다.

### v1.2 채택 전

1. 73개 원장과 모든 primary·continuation·control 행을 완성한다.
2. I-01~I-13과 code-trace 완전성 검사를 실행한다.
3. 제품 pending/seed 결정과 외부 Gate owner·만료일을 기록한다.

### 단계 0A — 최소 보호 기반

1. `BUILD-01a0`의 최소 server/client wrapper만 분리한다.
2. `ENV-01a0`의 fail-closed 판독과 여섯 flag owner 행을 적용한다.
3. `PRICE-01a0`의 안전 복원 schema와 `TRUST-01a0`의 null-safe 비교 구조를 적용한다.
4. 플래그 off·pending 렌더·저장 복원 회귀 테스트를 통과시킨다.

### 단계 0B — 배포·타입 경계

1. `DEPLOY-01a0`의 configPath와 build 전 2자 검사를 적용한다.
2. generated binding type과 `ENV-01a1` secret type 보강을 적용한다.
3. DTO·runtime·Next guard의 전체 경계를 추출한다.
4. build 후 3자 검사와 전환 diff를 검토한다.
5. 최종 구성에서 `BUILD-01b0` baseline을 실측하고 신규 오류 0 Gate를 켠다.

안전 기본값이 먼저 적용되고 대형 refactor가 뒤따르도록 순서를 고정한다.

## 6. 제품 책임자 결정과 seed 경로

단계 0~2 동안 검수 가격 쌍이 없다면 사용자는 오류 화면이 아니라 pending 화면을 보게 된다. 그러나 핵심 비교 가치가 제공되지 않는다는 제품 위험은 남는다.

제품 책임자는 다음 중 하나를 선택해야 한다.

| 선택 | 기본 입장 | 추가 조건 |
|---|---|---|
| pending-only | **안전 기본값** | 예상 기간, 사용자 문구, 이탈 모니터링, 종료일 승인 |
| verified seed 공급 | 별도 승인 필요 | `DATA-SEED-01a` 소유 행, 검수 provenance, idempotent import, rollback, 만료·재검수 |

결정이 없으면 pending-only로 fail closed한다. seed를 선택하더라도 hardcoded `baseOffers`를 재사용하지 않는다.

## 7. Kakao query token 제거의 외부 Gate

현재 `verifyKakaoSkillRequest()`는 header와 `?token=`을 모두 허용하고 기존 skill URL이 query token 방식이라는 감사인의 지적을 수용한다.

다음 Gate를 §9와 원장에 추가한다.

- Kakao 오픈빌더가 커스텀 header 또는 승인된 서명 방식의 요청을 실제로 지원하는지 확인
- 운영 skill URL 변경과 secret 회전 절차
- 변경 전후 401/404/410 및 정상 요청 통합 테스트
- URL·edge log·분석 이벤트에 secret 원문 0

지원 방식이 입증되기 전에는 `KAKAO_IMPORT_ENABLED=false`를 유지한다. 보안상 query token fallback을 영구 유지하는 것으로 해결하지 않는다.

## 8. “지금 착수 가능한 코드 작업”의 범위를 확인한다

감사인 의견서 v5.0은 질문 4에서 단계 0 착수를 유보하면서 Part 6에서는 네 코드 작업을 지금 착수 가능하다고 적었다. 두 문구를 다음처럼 구분해 해석한다.

- 허용될 수 있는 것: 별도 remediation branch에서의 준비·실측·테스트 작성
- 아직 허용되지 않는 것: 단계 0 완료 처리, production 반영, flag 활성화, v1.2 검산을 우회한 병합

다만 이는 감사인의 의도를 추론한 것이므로 확인 전에는 코드 변경에 착수하지 않는다.

제안된 네 작업의 처리 원칙은 다음과 같다.

| 작업 | 회신 입장 |
|---|---|
| Next·eslint-config-next 갱신 | 후보 버전 설치 후 build·test·production audit를 모두 통과해야 채택 |
| Wrangler type·secret declaration·typecheck | 승인된 설계를 사용하되 최종 baseline은 경계 추출 뒤 재실측 |
| 만료 Kakao token 410 테스트 | 착수 가능 후보. decrypt/fetch 미호출을 spy로 검증 |
| 문서 version 관리·`*.tsbuildinfo` ignore | 원장 채택 전 문서 경로·생성물 정책과 함께 처리 |

## 9. v5.0 차단 11건의 정규화

v5.0 요약의 `3 + 4 + 4 = 11`을 다음 종료 묶음으로 사용한다.

| ID | 종료 묶음 | 반영 Stream/검산 |
|---|---|---|
| V5-B01 | amount 없는 pick이 복원에서 탈락 | PRICE-01a0 |
| V5-B02 | baseOffers 제거 전 파생값 null-safety 부재 | TRUST-01a0 |
| V5-B03 | build 전 3자 drift 검사 불가능 | DEPLOY-01a0 |
| V5-B04 | 단계 목록 역방향 누락 검출 부재 | I-09·I-06 보강 |
| V5-B05 | 구조 조건형 P0/Gate 보호행 검출 부재 | I-10 |
| V5-B06 | 같은 단계 내부 hard ordering 검출 부재 | I-11 |
| V5-B07 | gate·dependency 완전성 검출 부재 | I-12·I-13 |
| V5-B08 | 단계 0 경계·타입·baseline 작업의 ID/owner 부재 | BUILD/DEPLOY/ENV 신규 행 |
| V5-B09 | L-11의 표·원장 이동 지시 누락 | TRUST-01a1 |
| V5-B10 | 신규 행 role 미정과 continuation 정의 모순 | coverage_role 정의·전수 배정 |
| V5-B11 | 단계 0 schema와 단계 1 일괄 migration 모순 | savedPicks v1→v2 분리 |

Part 4의 다음 항목은 별도 산술을 늘리지 않고 기존 묶음의 필수 종료 조건으로 둔다.

- configPath 전환 diff와 절대경로 검사는 V5-B03/DEPLOY-01a0에 포함한다.
- server wrapper 선행조건은 V5-B08/BUILD-01a0·ENV-01a0에 포함한다.
- Kakao header 지원은 V5-B07과 별도의 external Gate에 포함한다.

감사인이 Part 4의 세 항목을 11건 외 추가 차단으로 의도했다면 고유 차단 수는 13건 이상이 되므로, 최종 산술은 감사인의 확인을 요청한다.

## 10. 그 밖의 중요 지적에 대한 답변

### 10.1 객관적 종료 기준이 부족한 프로그램

14개 프로그램 전체를 다시 검사한다. 특정 4개만 문구를 보강하는 방식 대신, 모든 필수 stream에 다음 필드를 요구한다.

- 입력 상태와 대상 commit
- 실행 명령 또는 검증 절차
- 기대 결과와 실패 판정
- 실제 결과 링크
- owner와 reviewer
- rollback/forward-fix

I-07은 필드 존재뿐 아니라 판정 가능한 값인지 검사한다.

### 10.2 POLICY 단계 이동 범위

POLICY-01 전체를 단계 1로 옮기지 않는다.

- `POLICY-01a`: freshness 정본 결정, 단계 1
- `POLICY-01b`: variant·stock·condition·schema drift, 단계 2

M-07·M-27·L-21만 POLICY-01a로 이동한다. M-28·L-05는 POLICY-01b 단계 2에 남긴다.

### 10.3 ENV 행 분할

- `ENV-01a0`: server wrapper, flag parsing, 기본 false, props/API 배선
- `ENV-01a1`: generated/public binding type, secret declaration merging, runtime fail-fast

배포형 flag 증거의 소유 행이 사라지지 않게 둘 다 원장에 등록한다.

### 10.4 H-01과 외부 검증

OpenAI Sites edge 규약, Kakao 인앱 브라우저·custom header, 실제 D1 cold-start, 법무 승인, 성능·확장성은 이 회신으로 종결하지 않는다. owner·만료일·재검토 조건이 있는 external Gate로 유지한다.

## 11. v1.2 채택 전 필수 증거

v1.2는 다음 증거가 모두 있어야 채택할 수 있다.

- 73개 primary 결손·중복 0
- 모든 continuation·control의 typed reference 완전성
- I-01~I-13 전부 통과
- 단계 목록과 원장의 양방향 일치
- 같은 단계 hard ordering과 gate target 검산 통과
- V5-B01~B11의 owner·산출물·검증·종료 조건 존재
- PRICE-01a0 저장·복원·합계 테스트 통과
- TRUST-01a0 zero/one/pair offer 렌더 테스트 통과
- configPath 전환 전후 diff와 build 전·후 drift 검사 통과
- P0/Gate code-trace와 대상 commit 테스트 증거
- 제품 pending/seed 결정과 Kakao 인증 방식 Gate 기록
- 모든 문서가 승인된 저장 경로에서 version 관리됨

## 12. 감사인 확인 요청

1. 질문 1의 정정 조건으로 savedPicks v1 pending/legacy 구분, nullable amount, 복원·합계 테스트와 TRUST null-safe 리팩터를 승인할 수 있는지 확인해 주기 바란다.
2. I-09~I-12를 제안대로 수용하고, I-13은 `depends_on/gates/covers/related_streams` typed relation 검사로 정정하는 안을 승인할 수 있는지 확인해 주기 바란다.
3. `order_rank`를 다단계 행에 안전한 `start_order_rank`·`completion_order_rank` 두 열로 구현하는 안을 승인할 수 있는지 확인해 주기 바란다.
4. v5.0의 11건 산술에서 Part 4의 config 부작용·server wrapper 조건은 기존 묶음의 하위 조건인지, 별도 추가 차단인지 확인해 주기 바란다.
5. “지금 착수 가능한 코드 작업”이 별도 remediation branch의 준비 작업은 허용하되 단계 0 완료·production 반영은 허용하지 않는다는 의미인지 확인해 주기 바란다.
6. 제품 책임자의 별도 결정이 없을 때 pending-only를 안전 기본값으로 유지하고, seed는 `DATA-SEED-01a`가 있는 경우에만 허용하는 안을 승인할 수 있는지 확인해 주기 바란다.

## 최종 입장

감사인 의견서 v5.0은 이전 라운드의 회계 논쟁을 실질적으로 닫고, 설계와 실제 코드 사이의 결함을 정확히 드러냈다. 권고 철회 3건과 질문 1·2의 판정을 확인하고 질문 3·4의 부정·유보 판단을 수용한다.

다음 원칙은 바꾸지 않는다.

- sample이나 사용자 입력으로 public 추천을 만들지 않는다.
- 검증되지 않은 금액을 저장·표시·합산하지 않는다.
- amount 없는 pick 자체는 안전하게 보존한다.
- secret 실제 값을 version 관리되는 `vars`에 넣지 않는다.
- 최종 구성에서 실측한 값만 baseline으로 사용한다.
- 문서 invariant 통과와 코드 회귀 증거가 모두 있어야 단계 종료를 승인한다.

현재는 v1.2 채택 전이며 출시 판단은 **조건부 중단**이다. 감사인의 §12 확인과 v1.2 원장 검산이 완료되기 전에는 단계 0 착수·완료 또는 출시 승인을 주장하지 않는다.

## 참고 근거

- 감사인 의견서 v5.0, 2026-08-01
- `docs/AUDIT_REVIEW_REPLY_V4_2026-08-01.md`
- `docs/AUDIT_RESPONSE_V1.1_2026-08-01.md`
- `app/page.tsx`
- `app/lib/pricing.ts`
- `app/lib/kakao-import.ts`
- `vite.config.ts`
- `.openai/hosting.json`
- `dist/server/wrangler.json`
- `.wrangler/deploy/config.json`
- `package.json`
