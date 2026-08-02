# CherryPicker 감사인 의견서 v4.0에 대한 회신

문서 상태: 감사인 회신 답변서 v2.0  
대상 문서: `CherryPicker 감사인 회신 답변서에 대한 의견서 v4.0`  
선행 문서: `docs/AUDIT_REVIEW_REPLY_V3_2026-08-01.md`, `docs/AUDIT_RESPONSE_V1.1_2026-08-01.md`  
감사 기준일·커밋: 2026-08-01 · `99aa303`  
답변 기준일: 2026-08-01  
대상 독자: 감사인, 제품 책임자, 개발 책임자, 데이터·플랫폼·보안·법무 담당자

> 본 회신은 감사인 의견서 v4.0의 수치 정정, 승인 질문 5건, 차단 C-A~C-J와 중요 지적에 대한 최종 입장을 확정한다. 아직 구현·CI·배포환경에서 입증되지 않은 조치를 완료로 표시하지 않는다. 법률 관련 내용은 출시 위험 관리 기준이며 법률의견을 대체하지 않는다.

## 기술 요약

감사인 의견서 v4.0의 핵심 결론을 수용한다. 이전 회신은 73개 항목의 회계 무결성을 유지했지만 **원장 invariant, 단계 0 소유 행, Cloudflare 설정 기준, savedPicks 안전 조건이 불완전하므로 아직 v1.2 채택이나 단계 0 착수를 승인할 수 없다.**

최종 입장은 다음과 같다.

- C-A~C-J 차단 10건은 모두 수용한다.
- 질문 2는 승인으로 종결하고, 질문 1·3은 본 회신의 정정 설계로 다시 제시한다. 질문 4의 네 승인 조건은 모두 채택한다. 질문 5의 착수 승인은 v1.2 원장 검산 전까지 유보한다.
- 최소 D1 설정으로 `wrangler types`를 적용했을 때 **27→18**이라는 감사인 실측은 수용한다. 다만 18건은 `ADMIN_EMAILS` 타입이 빠진 중간 설정의 값이므로 **최종 baseline 숫자로 미리 고정하지 않는다.**
- `KAKAO_SKILL_TOKEN`을 타입 생성을 위해 평문 `vars`에 넣지 않는다. 비밀값 이름은 별도 declaration merging으로 타입만 보강하고 실제 값은 secret binding으로 유지한다.
- 단계 0에서는 pick 저장 자체를 중단하지 않는다. 금액을 검증할 수 없으면 **`amount` 없이 pick을 저장**하고 기존 미검수 금액도 표시·합산하지 않는다.
- `currentComparisonReady`는 현재 검수 가격과 사용자 입력을 함께 허용하므로 금액 저장 자격 조건으로 사용하지 않는다.
- §8.2 실행 원장은 열 목록뿐 아니라 기계적으로 판정 가능한 invariant와 실행 결과를 가져야 한다.
- 현 출시 판단은 계속 **조건부 중단**이다.

## 1. Cloudflare 타입 수치 정정에 대한 답변

### 1.1 27→18 실측은 수용하되 최종 baseline은 아니다

감사인이 스크래치 사본에서 확인한 다음 결과를 수용한다.

| 구분 | 오류 수 | 해석 |
|---|---:|---|
| 현재 저장소 | 27 | Cloudflare module·binding type, ComparableOffer 등 포함 |
| D1만 선언한 `wrangler.jsonc` + 생성 타입 | 18 | 기존 11건 소멸, `ADMIN_EMAILS` TS2339 2건 신규 |

다만 의견서 v4.0은 동시에 “vars를 선언하면 신규 2건도 사라질 수 있다”고 썼다. 그 가정이 맞으면 산술상 최종 오류 수는 18이 아니라 **16일 가능성**이 있다. 해당 구성은 아직 실측되지 않았으므로 16도 완료 수치로 주장하지 않는다.

따라서 v1.2의 규범은 특정 숫자가 아니라 다음 순서다.

1. 최종 `wrangler.jsonc`, 비밀값 타입 보강, 경계 모듈을 먼저 적용한다.
2. 고정 명령으로 TypeScript 오류를 다시 측정한다.
3. 그 **실측 결과**를 파일·오류코드 baseline으로 저장한다.
4. 이후 신규 오류 0 Gate를 켠다.
5. 단계 1 종료 시 모든 오류를 0으로 만들고 baseline을 삭제한다.

즉 감사인의 27→18 실측은 정정 이력으로 보존하지만, “vars 포함 후 baseline 18” 권고는 그대로 채택하지 않는다.

### 1.2 비밀값은 `vars`에 넣지 않는다

`NEXT_PUBLIC_SITE_URL`처럼 공개 가능한 값은 `wrangler.jsonc.vars`에 둘 수 있다. 그러나 `KAKAO_SKILL_TOKEN`은 장기 secret이고 `ADMIN_EMAILS`도 운영 접근정보이므로 타입 생성을 목적으로 저장소의 평문 `vars`에 넣지 않는다.

선택한 구조는 다음과 같다.

- `wrangler types worker-configuration.d.ts`는 공개 binding과 runtime type을 생성한다.
- 별도 version 관리 파일 `worker-secret-bindings.d.ts`가 `Cloudflare.Env`를 declaration merging하여 `KAKAO_SKILL_TOKEN`, `ADMIN_EMAILS` 이름과 type만 선언한다.
- 실제 값은 승인된 secret binding·배포 환경에서 주입한다.
- CI는 생성 파일 최신성, 보강 파일 존재, 실제 배포환경의 필수 secret fail-fast를 각각 검사한다.

비밀값 이름의 타입 선언과 비밀값 자체의 저장을 분리해야 C-5 수정이 새로운 secret 노출을 만들지 않는다.

## 2. 승인 질문 5건에 대한 재답변

### 2.1 질문 1 — 자동확정과 savedPicks를 분리한다

감사인의 **정정 후 승인**을 수용하며 기존 설계를 다음처럼 다시 쓴다.

`AUTO_CONFIRM_ENABLED`는 OCR 결과를 사용자 확인 없이 최종 입력 상태로 승격하는 경로만 제어한다. `PRICE-01a0`의 savedPicks 보호는 플래그 해제와 분리된 항상 적용되는 구조 조건으로 둔다.

| 실행 스트림 | 단계 | 동작 |
|---|---:|---|
| `OCR-01a0` | 0 | `AUTO_CONFIRM_ENABLED=false`에서 OCR 값은 draft·확인 필요 상태만 만들고 최종 입력·추천을 자동 확정하지 않음 |
| `PRICE-01a0` | 0 | pick의 key·title·provenance는 저장 가능하나 검증되지 않은 금액은 `amount` field 자체를 기록하지 않음 |
| `TRUST-01a0` | 0 | 검수 가격이 없는 경우 hardcoded sample 또는 사용자 입력으로 공개 headline·판매처 수·절감액을 만들지 않음 |
| `TRUST-01a1` | 1 | 기본 추천과 `내 입력 포함 비교`를 분리하고 savedPicks schemaVersion·mode·offer provenance를 확정 |

단계 0에서는 PRICE-01a의 정식 의미론이 아직 없으므로 **모든 신규 pick의 금액을 생략**한다. 내 비교함 저장 기능은 계속 동작하며 “금액 확인 전” 상태로 표시한다. 단계 1에서 PRICE-01a와 TRUST-01a1이 함께 완료된 뒤에만 검증된 실제 구매 대안의 금액 차이를 기록할 수 있다.

기존 레코드는 단계 0 read path에서 다음처럼 처리한다.

- schemaVersion이 없는 `amount`는 `legacy-unknown`으로 분류하고 표시·합산하지 않는다.
- savedPicks 총액은 검증된 `amount`만 합산한다.
- 금액 없는 pick은 삭제하지 않고 key·title·저장 시각을 유지한다.
- 쓰기뿐 아니라 헤더·내 비교함 요약·상세 표시 경로 모두 같은 금액 자격 판정을 사용한다.

감사인이 제안한 `currentComparisonReady` 조건은 채택하지 않는다. 현재 cosmetics 경로의 `currentComparisonReady`는 `offer.verified || offer.captured`로 만든 `hasTrustedCosmeticsComparison`을 사용하므로 사용자 입력도 true가 될 수 있다. 또한 현재 best offer는 hardcoded fallback을 가질 수 있다. 따라서 이는 “검수된 결제액 차이”의 구조 증거가 아니다.

### 2.2 질문 2 — POLICY-01a 단계 1 선행은 승인된 것으로 종결한다

승인을 확인한다. 30일은 query retention으로 분리하고 POLICY-01a를 TRUST-01보다 먼저 완료한다.

v1.2에는 충돌 지점을 다음 7종으로 다시 기록한다.

1. `offer-input.ts`의 90일 절대 상한
2. 범용 validator가 실제 강제하는 official 1일
3. 범용 validator의 licensed pickup 7일
4. 범용 validator의 receipt/store photo 3일
5. 뒤에서 호출되어 official 14일이 사실상 도달 불가능한 주류 전용 분기
6. 출처가 제출한 `expires_at`과 테스트 전용 `isApprovedOfferActive`
7. `price-store.ts`의 1/3/7일 reference 판정, 30일 query retention, UI의 “최대 14일” 표시

마지막 항목은 구현 위치가 여러 개지만 하나의 사용자 정책 충돌군으로 관리한다. POLICY-01a 종료 조건에는 **공식 원본 정본 상한을 1일과 14일 중 어느 값으로 할지 제품·데이터 owner가 명시적으로 결정하고 근거를 기록한다**는 항목을 추가한다. 결정 전에는 14일을 정본으로 간주하지 않는다.

M-07·M-27·L-21의 항목별 표, §8.1 주 단계, §8.2 실행 행을 모두 단계 1로 정정한다.

### 2.3 질문 3 — configPath·경계 모듈·실측 baseline으로 정정한다

감사인의 부분 승인 조건을 수용한다.

Cloudflare 설정은 다음과 같이 단일화한다.

1. Vite plugin을 `configPath: "./wrangler.jsonc"`로 전환한다.
2. 현재 `localBindingConfig` 전체를 삭제한다. 파생값이 꼭 필요한 경우에도 파일 설정을 덮는 객체가 아니라 검증된 최소 customizer만 허용한다.
3. `.openai/hosting.json` ↔ `wrangler.jsonc` ↔ Vite가 생성한 유효 배포 설정을 세 방향으로 비교한다.
4. 불일치는 자동 수정하지 않고 build 전에 실패시킨다. 승인된 설정 변경이 먼저 두 원본을 갱신해야 한다.
5. 현재 hosting binding `d1=DB`, `r2=null`과 `wrangler.jsonc`의 D1·R2 선언이 정확히 일치해야 한다.

타입 영역은 `include`만 나누지 않고 project references와 경계 모듈로 분리한다.

- `PublishedOffer`, `AdminOffer` 등 UI가 소비하는 DTO를 D1 의존 없는 `offer-types.ts`로 추출한다.
- `admin-auth.ts`를 Next session guard와 runtime env adapter로 분리한다.
- Kakao·price store·DB binding 접근은 runtime project의 공개 함수·DTO 경계를 통해 사용한다.
- app project는 runtime 구현 파일을 직접 import하지 않고 선언된 경계만 참조한다.
- `tsc -b`가 app·runtime·worker project references를 순서대로 검사한다.

이 경계 추출은 예외 처리 문구가 아니라 C-5의 **선행 필수 stream**이다. 최종 baseline은 이 작업과 secret type 보강까지 적용한 뒤 측정한다.

### 2.4 질문 4 — CTRL 행은 산술에서만 제외하고 종료에서는 제외하지 않는다

감사인의 네 승인 조건을 모두 채택한다.

- 모든 `CTRL-*` 행은 owner, 시작·완료 단계, Depends on, 보완 대상 ID, 산출물, 검증 증거, 종료 조건을 필수로 가진다.
- `CTRL-*`는 원문 73개 고유 배정 산술에서만 제외한다.
- §17 종료 집계에는 모든 필수 stream과 모든 `CTRL-*`를 포함한다.
- KAKAO-SEC-01c0/c1은 실행 stream으로 확정하고 관련 원문 ID의 **커버리지 중복 집계만** 하지 않는다.

원장의 `원문 ID` 열은 `보완 대상 ID`로 이름을 넓히고 `coverage_role`을 추가한다.

| `coverage_role` | 의미 | 73개 집계 |
|---|---|---|
| `primary` | 원문 ID의 유일한 고유 소유 행 | 포함 |
| `continuation` | 같은 원문 ID의 후속 구현 분할 | 제외, primary 참조 필수 |
| `control` | 여러 원문 ID를 보호하는 공통 통제 | 제외, 보완 대상 ID 필수 |

### 2.5 질문 5 — 원장 검산 전 단계 0 착수 불가를 수용한다

현 상태 승인 불가 판정을 수용한다. v1.2 채택 조건은 문서 작성이 아니라 다음 원장 검산 결과의 첨부다.

## 3. 실행 원장 invariant

v1.2의 원장 검산은 최소 다음 8개 invariant를 참/거짓으로 판정한다.

| ID | 검산 invariant | 실패 시 처리 |
|---|---|---|
| I-01 | `coverage_role=primary`인 원문 ID의 합집합이 H 11 + M 30 + L 23 + A 9 = 73이며 결손 0 | 문서 채택 불가 |
| I-02 | 각 원문 ID의 primary 행은 정확히 1개이며 continuation·control은 primary를 참조 | 문서 채택 불가 |
| I-03 | 모든 `Depends on` Stream ID가 존재하고 dependency graph에 cycle이 없음 | 문서 채택 불가 |
| I-04 | hard dependency마다 `start_phase(row) >= completion_phase(dependency)` | 단계 재배정 전 채택 불가 |
| I-05 | 각 feature flag는 보호가 필요한 최초 단계보다 늦지 않은 단계 0 소유 행과 적용 지점을 가짐 | Gate 실패 |
| I-06 | §9·§10·§13·§17과 항목별 표에 등장하는 모든 Stream ID가 원장에 존재하고 단계가 동일 | 문서 채택 불가 |
| I-07 | 모든 필수 stream과 모든 control 행에 owner·산출물·증거·종료 조건이 존재 | 착수 불가 |
| I-08 | 최종 종료 시 필수 stream과 모든 control 행의 상태가 closed 또는 owner·만료일이 있는 승인된 external Gate | 라운드 종료 불가 |

단계 범위 표기 `0~1`처럼 비교가 불분명한 값을 피하기 위해 원장은 `start_phase`와 `completion_phase`를 별도 정수 열로 가진다. `external Gate`는 별도 boolean·승인자·만료일 열로 관리한다.

검산은 version 관리된 script 또는 동일 결과를 내는 고정 checklist로 실행하고, v1.2에는 실행 시각·commit·결과·결손·중복·참조 오류 수를 첨부한다.

## 4. 차단 C-A~C-J에 대한 최종 판정

| ID | 최종 판정 | 반영 결정 |
|---|---|---|
| C-A | **수용** | savedPicks 기능 전체를 끄지 않고 amount 없는 pick을 저장. AUTO_CONFIRM과 금액 자격을 분리하고 read/display까지 보호 |
| C-B | **수용** | Vite `configPath`로 전환하고 전체 `localBindingConfig` 삭제 또는 검증된 최소 customizer로 축소 |
| C-C | **수용** | project references 전에 DTO·env·Next guard 경계를 추출하는 선행 stream 신설 |
| C-D | **수용** | 설정·생성 타입·secret type 보강을 먼저 수행한 뒤 실측 baseline을 만들고 신규 오류 0 Gate 적용 |
| C-E | **수용** | L-11을 TRUST-01a1 단계 1로 이동해 schemaVersion·provenance·epoch savedAt을 한 번에 migration |
| C-F | **수용** | 여섯 플래그 각각에 단계 0 차단 소유 행 지정 |
| C-G | **수용** | I-01~I-08 invariant와 검산 결과를 v1.2 채택 조건으로 추가 |
| C-H | **수용** | M-07·M-27·L-21과 POLICY-01a의 모든 단계 표기를 1로 통일 |
| C-I | **수용** | TRUST-01a0·KAKAO-SEC-01a0을 단계 0, 의미론·보안 수정 stream을 단계 1로 명시 분리 |
| C-J | **수용** | UX-01b0(M-09·M-11)을 단계 1 목록과 원장에 복원 |

## 5. 단계 0 소유 행과 구조 통제

ENV-01a0이 공통 서버 판독·기본 false·prop/API 배선을 소유하고, 각 기능은 별도의 단계 0 적용 행을 가진다.

| 플래그 | 단계 0 소유 행 | 단계 0 차단 증거 |
|---|---|---|
| `MONETIZATION_ENABLED` | `LEGAL-01a0` | 광고 script·slot·수익 링크·관련 고지 DOM 0 |
| `KAKAO_IMPORT_ENABLED` | `KAKAO-SEC-01a0` | skill link·landing·import API가 동일한 비노출 404/비활성 응답 |
| `ALCOHOL_COMMERCE_ENABLED` | `LEGAL-01a0` | 주류 상거래·예약·구매 CTA DOM 0 |
| `TELEMETRY_ENABLED` | `LEGAL-01b0` | 비필수 원격 요청 0, 수집 명세 없는 event 0 |
| `AUTO_CONFIRM_ENABLED` | `OCR-01a0` | OCR 결과의 무확인 최종 승격 0 |
| `ADMIN_UI_ENABLED` | `AUTH-01a0` | 관리자 page·API가 인증 검사 전에 균일 404 |

ENV-01a0은 위 여섯 적용 행의 선행 dependency다. 플래그가 false여야 하는 최초 시점은 모두 단계 0이므로 각 소유 행의 `start_phase=0`, `completion_phase=0`을 요구한다.

H-02의 단계 0 보호는 플래그가 아니라 `TRUST-01a0`의 항상 적용되는 구조 조건으로 둔다.

- 검수 가격 쌍이 없으면 public quick-decision headline·절감액·판매처 수를 렌더하지 않는다.
- hardcoded `baseOffers`는 개발 fixture 또는 명시적 demo 화면에서만 사용하고 공개 추천 fallback으로 사용하지 않는다.
- 사용자 직접 입력은 단계 1에서 별도 모드가 완성될 때까지 headline·대표가격·판매처 수에 참여하지 않는다.
- 금액 없는 pick 저장은 허용하되 금액 표시·합산은 하지 않는다.

## 6. 정정된 단계 순서

### v1.2 채택 전

1. 전체 원장을 `coverage_role`, start/completion phase와 dependency로 작성한다.
2. I-01~I-08 검산을 실행하고 결과를 첨부한다.
3. 감사 원문·의견서·답변서를 승인된 저장 경로에 version 관리한다.

### 단계 0

1. Vite `configPath` 전환, `wrangler.jsonc`, hosting 3자 검증과 boundary extraction을 완료한다.
2. Wrangler 타입과 secret binding 타입 보강을 생성·검사한다.
3. 위 최종 구성에서 TypeScript 오류를 실측하고 baseline을 만든 뒤 신규 오류 0 Gate를 켠다.
4. ENV-01a0과 여섯 단계 0 적용 행을 완료한다.
5. PRICE-01a0의 amount 없는 pick schema와 legacy read/display 보호를 적용한다.
6. TRUST-01a0에서 sample·사용자 입력의 public recommendation 참여를 차단한다.
7. DEPLOY-01a D1 local/CI harness와 config drift 검사를 완료한다.
8. KAKAO-SEC-01c0 공통 header·CSP Report-Only를 적용한다.

### 단계 1

1. BUILD-01a/b 오류 0과 baseline 삭제를 완료한다.
2. DATA-01a/b, OCR-01a/b/c, PRICE-01a/b를 완료한다.
3. POLICY-01a의 정본 freshness 결정을 완료한 뒤 TRUST-01a1을 닫는다.
4. TRUST-01a1에서 schemaVersion·mode·provenance·epoch savedAt을 한 번에 migration한다.
5. UX-01b0(M-09·M-11)과 UX-01c0을 완료한다.
6. KAKAO-SEC-01b에서 query token fallback 제거·secret 분리·HTTPS-only·회전을 완료한다.
7. KAKAO-SEC-01a → KAKAO-REL-01 순서로 fragment/POST와 신뢰성 작업을 완료한다.
8. OCR-01b 자체 hosting 후 KAKAO-SEC-01c1 CSP enforce를 완료한다.
9. schema·DTO 변경마다 app/runtime/worker typecheck와 통합 테스트를 재실행한다.

### 단계 2~3

단계 2는 AUTH-01, DEPLOY-01b, POLICY-01b, ENV-01b를 닫는다. 단계 3은 LEGAL-01, UX-01a·b1·c1, DOCS-01과 운영 인수를 닫는다. 모든 프로그램과 control 행의 실질 종료 기준은 §17에서 원장 행 단위로 확인한다.

## 7. 중요 지적에 대한 추가 답변

### 7.1 관리자 비활성 응답

`ADMIN_UI_ENABLED=false` 검사는 `requireAdminUser()`와 `getAuthorizedAdmin()`보다 먼저 실행한다. page와 API는 모두 404 status를 사용하고 이메일·로그인·권한·플래그 상태를 설명하는 body나 redirect를 반환하지 않는다. cache 정책과 응답 시간도 허용 범위 내에서 균일하게 검증한다.

### 7.2 관리자 기능 off가 sample 추천을 열지 않게 한다

`ADMIN_UI_ENABLED=false`로 검수 가격이 없을 때 `baseOffers`를 public 추천으로 사용하는 경로를 제거한다. 승인된 seed offer는 별도 migration/CLI로 공급할 수 있지만, 검수 쌍이 0이면 public headline은 pending 상태를 유지한다.

### 7.3 M-01 query secret fallback

KAKAO-SEC-01b의 명시적 종료 조건에 `verifyKakaoSkillRequest`의 `requestUrl.searchParams.get("token")` 제거를 추가한다. skill 인증은 승인된 header 또는 별도 서명 방식만 허용하며 기존 secret을 회전한다.

### 7.4 쿠팡 고지·계약 사실

현재 URL에 제휴 식별자가 없다는 코드 사실과 실제 제휴 계약·수익 귀속 여부를 분리한다. LEGAL-01a0가 계약 사실을 확인하기 전에는 수익 고지 제거를 완료로 판정하지 않는다. 계약상 제휴 관계가 없다면 `rel=sponsored`와 수수료 고지를 제거하고, 있다면 링크·고지를 `MONETIZATION_ENABLED` 뒤에서 함께 제어한다.

### 7.5 구현 분할의 커버리지

OCR-01a0·PRICE-01a0의 H-05·M-13·M-15·A-01은 각각 기존 primary stream을 참조하는 `continuation`으로 등록한다. 73개 합계에는 primary만 포함하므로 77로 증가하지 않는다.

### 7.6 종료 기준과 문서 Gate

UX-01, DOCS-01, POLICY-01b를 포함한 14개 프로그램의 모든 필수 stream에 실질 종료 기준을 둔다. 문서 version 관리와 외부 승인도 원장 밖 bullet로만 선언하지 않고 `CTRL-DOC-GOV`, 관련 LEGAL/AUTH control 행으로 등록한다.

### 7.7 모니터링 신호 복원

C-4 표에 OCR field별 `edited: true/false` 로컬 신호를 복원한다. 원문·인식값은 수집하지 않으며 기본은 기기 memory, 원격 전송은 `TELEMETRY_ENABLED`와 법무 승인 뒤 비식별 aggregate만 허용한다.

## 8. 최종 수용 기준 보강

v1.2의 라운드 종료에는 다음을 모두 요구한다.

- I-01~I-08 검산이 대상 commit에서 통과하고 결과가 첨부됐다.
- 모든 primary·continuation·control 행이 종료됐거나 승인자·만료일이 있는 external Gate다.
- 여섯 플래그의 단계 0 소유 행과 실제 적용 지점이 존재하며 부재·오타·파싱 실패 시 false다.
- 검수되지 않은 amount는 신규 저장·기존 표시·합산에 사용되지 않고 amount 없는 pick은 정상 저장된다.
- 검수 가격이 없을 때 sample·사용자 입력으로 public 추천·절감액을 만들지 않는다.
- savedPicks schemaVersion·provenance·mode·epoch savedAt migration이 한 번에 완료됐다.
- `configPath`가 `wrangler.jsonc`를 가리키고 hosting·Wrangler·유효 배포 설정 drift가 0이다.
- secret 값은 저장소 `vars`에 없고 Env type·배포 binding·fail-fast 증거가 일치한다.
- 최종 구성에서 생성한 type baseline이 단계 1에 0이 되고 파일이 삭제됐다.
- M-01 query secret fallback이 제거되고 기존 secret이 회전됐다.
- UX-01b0, POLICY-01a, TRUST-01a0/a1, KAKAO-SEC-01a0/a/b/c의 단계가 원장과 모든 절에서 일치한다.
- 모든 감사 문서와 회신이 승인된 경로에서 version 관리된다.

## 9. 남은 외부 Gate와 한계

본 회신으로 다음 외부 사실은 종결되지 않는다.

- OpenAI Sites edge의 인증 header 처리 규약과 forged-header 차단 증거
- Kakao 인앱 브라우저의 fragment 보존과 `Sec-Fetch-*` 지원
- 실제 D1 clean-project cold-start와 Sites 배포 제어면 증거
- Next 보안 업데이트 후 회귀·production audit
- 주류·광고·제휴·개인정보·이미지 권리의 실제 법무 승인
- 성능·확장성 실측

또한 본 회신은 문서 설계이며 코드 구현 완료 보고서가 아니다. 현재 답변 문서와 `tsconfig.tsbuildinfo`는 여전히 git 미추적 상태다.

## 10. 감사인 확인 요청

1. 질문 1에 대해 `AUTO_CONFIRM_ENABLED`는 OCR 자동 승격만 제어하고, savedPicks는 amount 없는 저장을 허용하는 독립 구조 조건으로 분리한 설계를 승인할 수 있는지 확인해 주기 바란다.
2. 질문 3에 대해 secret 값을 `vars`에 넣지 않고 declaration merging으로 Env type만 보강하며, 최종 구성의 실측값을 baseline으로 삼는 기준을 승인할 수 있는지 확인해 주기 바란다.
3. I-01~I-08과 `coverage_role` 규칙이 라운드 1~4의 결손·중복·단계 역전·무소유 통제를 모두 검출하는지 확인해 주기 바란다.
4. 위 정정이 v1.2 원장에 병합되고 검산 결과가 첨부된 뒤 단계 0 착수 여부를 재판정해 주기 바란다.

## 최종 입장

감사인 의견서 v4.0의 차단 10건과 중요 지적을 모두 수용한다. 다만 안전성 또는 비밀관리 측면에서 불완전한 두 제안은 그대로 채택하지 않고 다음처럼 강화했다.

- `currentComparisonReady` 대신 amount 없는 pick 저장과 verified-only 단계 1 의미론을 사용한다.
- `KAKAO_SKILL_TOKEN`을 평문 vars에 넣지 않고 타입 선언과 실제 secret binding을 분리한다.

v1.2의 가장 중요한 채택 조건은 I-01~I-08 원장 검산이다. 검산 결과가 없으면 문서가 완성돼도 단계 0 착수를 승인하지 않는다.

## 참고 근거

- 감사인 의견서 v4.0, 2026-08-01
- `docs/AUDIT_REVIEW_REPLY_V3_2026-08-01.md`
- `docs/AUDIT_RESPONSE_V1.1_2026-08-01.md`
- `app/page.tsx`, `app/lib/pricing.ts`, `app/lib/offer-input.ts`, `app/lib/price-store.ts`
- `app/lib/kakao-import.ts`, `app/api/kakao/skill/route.ts`, `app/api/kakao/import/route.ts`
- `app/chatgpt-auth.ts`, `app/lib/admin-auth.ts`, `app/admin/page.tsx`, `app/api/admin/offers/route.ts`
- `vite.config.ts`, `.openai/hosting.json`, `dist/server/wrangler.json`, `.wrangler/deploy/config.json`
- `node_modules/@cloudflare/vite-plugin/dist/index.d.mts`, `index.mjs`
- `tsc --noEmit --incremental false --pretty false`, 현재 저장소 27건

