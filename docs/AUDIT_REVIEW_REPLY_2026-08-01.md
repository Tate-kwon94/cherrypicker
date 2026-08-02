# CherryPicker 감사 답변서 재검토 의견서에 대한 회신

문서 상태: 재답변서 v1.0  
대상 문서: `CherryPicker 감사 답변서 재검토 의견서 v1.0`  
선행 문서: `docs/AUDIT_RESPONSE_2026-08-01.md`  
감사 기준일·커밋: 2026-08-01 · `99aa303`  
회신 기준일: 2026-08-01  
대상 독자: 감사인, 제품 책임자, 개발자, 데이터 운영자, 보안·법무 검토자

> 본 문서는 재검토 의견서가 제기한 반론을 코드·문서·실행 결과와 다시 대조하여 수용 범위와 수정계획을 확정한다. 아직 구현하지 않은 조치는 완료로 표시하지 않는다. 법률 관련 내용은 출시 위험 관리 기준이며 법률의견을 대체하지 않는다.

## 기술 요약

- 재검토 의견서의 핵심 결론을 수용한다. 선행 답변서 v1.0의 전체 방향은 유효하지만, **M-16 기각, 프로그램 73건 완전 배정 주장, 단계 순서와 일부 종료 조건은 수정해야 한다.**
- M-16은 **P1 활성 보안 결함으로 복원**한다. 랜딩 토큰은 React `useEffect`가 실행되기 전 최초 HTTP 요청, 요청 로그, 주소창과 브라우저 기록에 존재한다. JavaScript가 실행되지 않으면 최대 10분 동안 소비되지 않은 채 남는다.
- `npm audit --omit=dev --json`을 다시 실행해 **high 등급 취약 패키지 노드 3개(`next`, `postcss`, `sharp`)**를 독립 재현했다. `next@16.2.12`가 non-major 수정 후보로 제시됐으므로 M-21은 P0 업데이트 게이트로 상향한다. 다만 실제 설치·빌드·회귀 검증 전에는 “한 줄 수정으로 해결 완료”라고 간주하지 않는다.
- 기존 12개 프로그램은 **73건 중 63건만 배정**했다. 누락 10건을 배정하고 `DEPLOY-01`, `DOCS-01`을 신설하여 14개 상위 프로그램, 73건, 미배정 0건으로 수정한다.
- 재검토 의견서의 13개 요구조치는 **수용 9건, 조건부·부분 수용 4건, 기각 0건**으로 판정한다. 조건은 H-02의 계약 해석, M-21의 수정 완료 증명, A-07의 구현 수단, 문서 커밋 시점에 관한 것이다.
- 출시 판단은 계속 **조건부 중단**이다. 공개 절감액 추천, Kakao import, 광고·제휴 수익화는 각 기능의 P0·Gate가 닫히거나 서버측 킬스위치로 비활성화되어야 한다.

## 1. 재검토 범위와 판정 기준

### 1.1 검토 범위

다음 증거를 다시 대조했다.

- 재검토 의견서 전체 352행
- 선행 답변서 `docs/AUDIT_RESPONSE_2026-08-01.md`
- Kakao 링크 생성·랜딩·소비 코드
- 검수 가격과 사용자 입력 가격의 추천 참여 코드 및 관련 README·가격 데이터 계약
- D1 binding, migration 패키징, 배포·migrate 스크립트
- 12개 통합 프로그램과 단계별 실행 순서
- 현재 dependency graph와 TypeScript 오류

실제 운영 Sites edge의 관리자 헤더 처리와 D1 cold-start는 배포환경에서 재현하지 않았다. 이 두 항목은 Gate로 유지한다.

### 1.2 판정 용어

| 판정 | 의미 |
|---|---|
| 수용 | 회신의 사실·영향·요구 방향을 반영한다. 세부 구현은 본 문서에서 보완할 수 있다. |
| 조건부 수용 | 문제와 개선 필요성은 인정하지만 회신이 제안한 특정 수단이나 완료 주장은 추가 검증이 필요하다. |
| 부분 수용 | 코드상 문제는 인정하지만 회신의 계약 해석 또는 심각도 근거 일부는 확정적이지 않다. |
| 유보 | 운영환경·법률·외부 플랫폼 사실 없이는 결론을 낼 수 없다. |
| 기각 | 코드·문서·실행 결과가 회신의 핵심 주장을 반박한다. |

## 2. 재검토 의견서의 총평에 대한 답변

재검토 의견서가 선행 답변서를 “대체로 신뢰 가능”하다고 평가하면서 M-16과 관리계획 완결성을 다시 문제 삼은 것은 타당하다. 선행 감사 원문에 과장 또는 정정 대상이 있었던 사실과, 선행 답변서 자체에도 수정 대상이 있다는 사실은 동시에 성립한다.

따라서 다음 입장을 확정한다.

1. H-09, L-22, L-03 영향 설명, M-21의 exact pin 설명, M-16의 Referrer 설명, M-23의 migration 패키징 사실에 대한 선행 답변서의 정정은 유지한다.
2. 그 정정만으로 해당 항목의 잔여 위험이 사라지는 것은 아니다.
3. 특히 M-16은 “교차 출처 Referer에 전체 query가 전달된다”는 경로가 약하더라도, 최초 요청 로그와 client hydration 전 노출이라는 독립 경로가 있으므로 활성 결함이다.
4. M-23과 A-07은 같은 배포 위험을 공유하지만 서로 다른 증거 질문을 갖는다. 패키징 여부와 적용 경로 여부를 같은 항목으로 간주한 표현을 철회한다.

## 3. 핵심 쟁점별 상세 답변

### 3.1 M-16 — 기각을 철회하고 P1 활성 결함으로 복원

**판정: 수용**

선행 답변서의 “현재 AdSense가 없고 즉시 소비된다”는 근거는 충분하지 않았다.

- `app/api/kakao/skill/route.ts`는 `kakao_import`를 랜딩 query에 넣는다.
- `app/page.tsx`는 client hydration 후 `useEffect`에서 토큰을 읽고 `history.replaceState`로 제거한다.
- 따라서 최초 `GET /?kakao_import=...` 요청은 토큰을 포함하며 edge·origin 요청 로그가 전체 URL을 기록하면 소비 전 토큰이 남는다.
- JavaScript 차단, bundle 오류, hydration 실패 시 제거와 소비가 모두 실행되지 않아 최대 10분의 유효기간이 유지된다.
- 현재 `/api/kakao/import`는 `GET ?token=...`만으로 소비하므로 랜딩 URL만 fragment로 바꾸더라도 API 요청 로그에 토큰이 다시 나타날 수 있다.

다만 현재 증거는 실제 탈취 사고가 발생했다는 뜻은 아니다. 43자 고엔트로피 일회용 토큰, 1회 소비, TTL은 공격 난도를 높인다. 심각도는 P0가 아니라 P1로 유지하되, Kakao import를 계속 공개하려면 단계 0~1에서 해결한다.

#### 수정 조치

1. Kakao 랜딩 링크를 `/#kakao_import=<token>`으로 바꾼다.
2. fragment에서 읽은 토큰을 `/api/kakao/import`의 **POST body**로 전달한다. `GET ?token=`은 제거한다.
3. POST 요청에 대해 `Sec-Fetch-Site`, `Sec-Fetch-Mode`, `Content-Type`을 검증한다. `Origin`은 브라우저별 누락 가능성을 고려해 단독 인증수단으로 사용하지 않는다.
4. rate limit은 IP 단독 기준을 피하고 토큰 실패 횟수, 짧은 시간창, 필요 시 IP 보조 신호를 결합한다.
5. TTL 목표를 우선 120초로 두고 Kakao 인앱 브라우저 실측에서 부족하면 보안 검토 기록과 함께 최대 5분 범위에서 조정한다.
6. 랜딩·교환 API 로그, 오류 추적, 분석 이벤트에서 token과 전체 query를 제거하거나 마스킹한다.
7. `Referrer-Policy: no-referrer`, CSP의 `frame-ancestors`, `X-Frame-Options` 등 페이지 보안 헤더를 명시한다.

#### 완료 기준

- 랜딩 요청, API 요청, 분석 이벤트, 오류 로그, 브라우저 history에 원문 토큰이 없다.
- JavaScript 비활성·bundle 오류 상태에서도 query token이 서버에 전달되지 않는다.
- 같은 token의 두 번째 교환은 410으로 실패하고, 만료 token은 복호화·외부 fetch 전에 거부된다.
- same-site가 아닌 자동 교환 요청과 과도한 실패 요청이 차단된다.

### 3.2 H-02 — 계약 위반 단정은 유보하되 제품 결함과 수정안은 수용

**판정: 부분 수용**

재검토 의견서가 지적한 문서 간 긴장은 실제로 존재한다.

- README는 사용자 직접 입력 가격이 “현재 비교에만 반영”된다고 설명한다.
- 같은 README는 승인 API·제휴 피드·운영자 검수 데이터만 “기본 추천”에 사용한다고 설명한다.
- 가격 데이터 계약은 사용자 입력을 보조 데이터로 정의하고 기본 추천 데이터와 합쳐 저장하지 않는다고 설명한다.

이 문구만으로 사용자 입력이 현재 세션의 비교 결과에 참여하는 것까지 명시적으로 금지했다고 단정하기는 어렵다. “기본 추천”과 “사용자가 요청한 현재 비교”를 다른 모드로 해석할 수 있기 때문이다. 따라서 선행 답변서의 “사용 자체를 곧바로 설계 위반으로 단정할 수 없다”는 문장은 유지한다.

그러나 현재 코드는 `verified || captured`를 동일한 `trusted` 풀로 만들고, 결과 제목·판매처 수·저장 절감액까지 같은 신뢰 문맥에서 계산한다. 제품 정책이 모호한 상태에서 직접 입력이 검수 결과처럼 보일 수 있으므로 P0 제품 신뢰 결함이라는 결론은 수용한다.

#### 수정 조치

- 기본 모드는 검수·승인된 가격만 사용한다.
- 사용자가 직접 입력하면 별도 `내 입력 포함 비교` 모드를 명시적으로 활성화한다.
- 비교 함수에 provenance 정책을 입력으로 전달하고, 모드 밖의 `captured` 가격이 대표가격이 되지 못하게 한다.
- 혼합 모드에서는 각 결과와 최종 선택에 `verified`, `captured`, `example` 출처를 보존하고 “모두 검수됨” 같은 전역 문구를 금지한다.
- `savedPicks`에 비교 모드, 선택한 두 offer의 provenance, 실제 결제액·환산가 구분을 저장한다.
- 기존 저장값은 버전 필드가 없으면 `legacy-unknown`으로 마이그레이션하고, 검수 결과로 재표시하지 않는다.
- README와 가격 데이터 계약에서 `기본 추천`, `내 입력 포함 비교`, `저장`의 의미를 각각 정의한다.

#### 완료 기준

- 기본 추천에서 사용자 직접 입력이 선택·판매처 수·절감액에 영향을 주지 않는다.
- 내 입력 포함 모드에서는 입력 포함 사실이 headline, 표, 저장 데이터 모두에 표시된다.
- 기존 `savedPicks`가 새 스키마에서 검수 결과로 오인되지 않는다.

### 3.3 M-21 — high 3건을 재현했으며 P0로 상향

**판정: 조건부 수용**

재검토 환경의 결과를 독립 확인했다.

```text
npm audit --omit=dev --json
high: 3, critical: 0
affected package nodes: next, postcss, sharp
fixAvailable: next@16.2.12, semver-major 아님
```

현재 `next@16.2.6`은 다수의 Next.js advisory 범위와 전이 의존성 취약 범위에 포함된다. 따라서 업데이트를 reachability 분석 뒤로 미루지 않고 P0 릴리스 게이트로 올린다.

다만 다음 두 구분은 유지한다.

1. exact pin은 자동 보안패치를 제공하지 않지만 수동 패치를 기술적으로 막지는 않는다. 감사 원문의 “exact pin이 보안패치를 불가능하게 한다”는 표현은 여전히 과장이다.
2. npm의 `fixAvailable`은 수정 후보이지 이 프로젝트에서의 수정 완료 증명이 아니다. vinext, Vite, React Server Components, image path와 build output을 실제 검증해야 한다.

#### 수정 조치와 완료 기준

- `next`와 연동 패키지를 16.2.12 이상 호환 패치로 올리고 lockfile을 갱신한다.
- `npm audit --omit=dev`에서 high·critical 0을 확인하거나 잔여 항목별 비도달 근거와 승인자를 기록한다.
- `npm run build`, `npm test`, typecheck, 핵심 API·SSR smoke를 통과한다.
- Next image endpoint를 사용하지 않는다는 가정은 요청 로그 또는 E2E로 확인한다.
- Tesseract worker/core/lang의 자체 호스팅과 CSP는 M-21의 완료 여부와 분리하여 `OCR-01b` 공급망 작업으로 추적한다.

### 3.4 M-23/A-07 — 패키징과 적용을 분리하고 DEPLOY-01 신설

**판정: 조건부 수용**

선행 답변서의 A-07 “중복 주장” 표현을 철회한다. build 결과에 migration이 포함되는 것은 제어면 또는 배포기가 사용할 자산이 있다는 뜻일 뿐, 빈 D1에 schema가 적용됐다는 뜻이 아니다.

현재 저장소에는 다음이 없다.

- 명시적 `migrate` 또는 `deploy` script
- 원격 D1을 직접 지정하는 repo-side 적용 설정
- placeholder database binding과 필수 secret을 배포 전에 검증하는 fail-fast 단계
- cold-start 적용 결과를 남기는 운영 runbook

다만 “저장소 내부의 원격 D1 명령만이 유일한 정답”으로 확정하지는 않는다. OpenAI Sites 제어면이 공식적이고 재현 가능한 migration 적용 주체라면, 버전이 고정된 제어면 절차와 실행 증거도 완료 경로가 될 수 있다. 핵심 종료 조건은 **누가 실행하든 명시적이고 재현 가능하며 감사 가능한 적용 경로**다.

#### DEPLOY-01 완료 기준

- clean project에서 D1 생성·binding·migration 0000~0002 적용·vars·secrets 설정이 한 runbook으로 재현된다.
- placeholder project/database ID 또는 필수 secret이 남으면 배포 전 실패한다.
- 첫 배포에서 public offers API, admin API, Kakao import storage가 예상 schema로 동작한다.
- migration 버전, 적용 시각, 대상 database, 실행 주체, rollback 또는 forward-fix 절차가 증거로 남는다.

### 3.5 L-03, M-14와 우선순위 재조정

**판정: 수용**

- L-03은 잘못된 단일 승인 행이 전체 verified feed를 503으로 만들 수 있으므로 P2에서 **P1**로 올린다. fallback이 예시 추천을 위장하지 않는다는 선행 정정은 유지하지만, 핵심 feed 가용성 영향은 별도다.
- M-14의 2,326행 component 전체 분리는 유지보수 P2일 수 있다. 그러나 금액 선택, OCR parser, provenance 정책을 독립 테스트하기 위한 순수모듈 추출은 단계 1의 선행조건이므로 **M-14a P1**, 나머지 화면 분리는 **M-14b P2**로 나눈다.

## 4. 관리계획 재편성

### 4.1 프로그램 커버리지 정정

선행 답변서의 “73건을 12개 프로그램으로 묶었다”는 표현은 부정확했다. 포함 항목 열을 집합으로 검산하면 63건이며 다음 10건이 미배정이었다.

`M-23`, `A-07`, `M-26`, `L-03`, `L-04`, `L-19`, `L-20`, `L-22`, `L-23`, `A-06`

다음과 같이 수정한다.

| 상위 프로그램 | 배정 건수 | 신규·변경 배정 | 비고 |
|---|---:|---|---|
| OCR-01 추출·확인·런타임 | 12 | M-26 추가 | a parser, b spatial/runtime, c provenance UI로 분할 |
| DATA-01 쓰기 무결성·복구 | 4 | L-03, L-04 추가 | 기존 데이터 복구와 feed 격리 포함 |
| PRICE-01 가격 의미 | 5 | 없음 | 기존 유지 |
| TRUST-01 출처 표현 | 3 | 없음 | H-02 수정 기준 강화 |
| BUILD-01 타입·CI | 9 | L-19, L-20, A-06 추가 | 단계 0~1로 이동 |
| ENV-01 환경·수화 | 3 | 없음 | 서버측 수익화 킬스위치 추가 |
| KAKAO-SEC-01 비밀·전송 | 4 | 없음 | M-16 종료 조건 강화 |
| KAKAO-REL-01 import 신뢰성 | 5 | 없음 | 단계표에 명시 배치 |
| POLICY-01 가격계약 | 5 | 없음 | migration/backfill 종료 조건 추가 |
| AUTH-01 관리자 경계 | 2 | 없음 | Gate 유지 |
| LEGAL-01 공개·수익화 | 5 | 없음 | 법정 체크리스트·승인자 추가 |
| UX-01 접근성·상태·분리 | 12 | 없음 | a 접근성, b 상태, c 구조로 분할 |
| DEPLOY-01 D1 적용 경로 | 2 | M-23, A-07 | 신규 |
| DOCS-01 크롤링·문서 정합 | 2 | L-22, L-23 | 신규 |
| **합계** | **73** | **누락 10건 배정** | **미배정 0건** |

### 4.2 프로그램 분할과 종료 조건 강화

#### OCR-01

- **OCR-01a parser:** 할부·우편번호·주문번호·다수량·할인 이중차감 corpus. 잘못된 자동확정은 신뢰도와 무관하게 0건이어야 한다.
- **OCR-01b spatial/runtime:** 상품 block과 금액 block 연계, 다상품 bbox, Tesseract 자산 자체 호스팅, CSP와 CDN 장애 fallback.
- **OCR-01c provenance/confirmation:** `recognized/defaulted/edited/unknown`을 필드별 보존하고 모호한 결과는 명시적 사용자 확인 전 추천·저장하지 않는다.

#### DATA-01

- insert-only offer path와 상품 편집 승인 경계를 구현한다.
- 기존 변조 가능 행 식별 query, 영향 범위, 원복 가능 여부, 재검수 queue를 만든다.
- 이력 부족으로 원본을 확정할 수 없는 행은 자동 복원하지 않고 비공개·재검수 상태로 이동한다.
- migration 전 snapshot, rollback 또는 forward-fix 절차, 데이터 검증 결과를 남긴다.

#### POLICY-01

- schema·validator·API·UI의 단일 계약뿐 아니라 기존 행의 `variant/currency/stock/condition` backfill과 미확정 행 제외 기준을 종료 조건에 포함한다.

#### LEGAL-01

- “활성 기능과 문구 일치”만으로 닫지 않는다.
- 개인정보보호법 필수항목 checklist, 처리자·수탁자·국외이전 inventory, 광고·주류·이미지 권리 검토, 승인자와 승인일을 보관한다.
- 법무 확인 전에는 해당 기능 킬스위치가 실제 서버 구성에서 꺼져 있어야 한다.

#### BUILD-01

- 단순히 type 오류 0개가 아니라 runtime contract를 좁히고 테스트로 보호한다.
- `any`, 광범위한 type assertion, 임의 interface 확장만으로 오류를 없애는 변경은 완료로 인정하지 않는다.
- API payload, `ComparableOffer`, Cloudflare binding은 runtime validator 또는 통합 테스트와 함께 닫는다.

#### UX-01

- **UX-01a 접근성:** focus, dialog, accessible name, search outline.
- **UX-01b 상태 신뢰성:** stale capture, localStorage 예외, remount, 저장시각.
- **UX-01c 구조 분리:** parser·가격선택·상태 reducer·정적 섹션 분리. 단계 1 테스트 가능성을 위해 핵심 순수모듈부터 추출한다.

## 5. 단계별 실행 순서 수정

### 단계 0 — 즉시 보호와 검증 기반 확보

목표 기간: 착수 후 0~3영업일. 개인 담당자는 실행 티켓 생성 시 지정하며, 지정 전에는 제품 책임자가 임시 accountable owner다.

1. `MONETIZATION_ENABLED=false`와 같은 **서버측 단일 킬스위치**로 AdSense script, AdSlot, 제휴 링크를 함께 차단한다.
2. 킬스위치 E2E를 만든 뒤 H-04 환경·수화 오류를 수정한다. H-04 버그 자체를 비활성 장치로 사용하지 않는다.
3. Kakao import를 임시 비활성화하거나 M-16 fragment+POST 교환을 배포한다.
4. M-01, M-17, L-15의 장기 secret·키 재사용·HTTP 허용을 단계 0~1로 이동한다.
5. `next@16.2.12` 이상 호환 패치를 적용하고 production audit·build·test를 통과한다.
6. `typecheck` script와 CI skeleton을 먼저 추가한다. 기존 오류는 숨기지 않고 실패 gate로 기록한 뒤 단계 1에서 0개로 만든다.
7. OCR 자동확정과 검수되지 않은 절감액 저장을 임시 중지한다.

### 단계 1 — 금액·데이터 정확성과 green gate

목표 기간: 단계 0 종료 후 1~2주.

- `BUILD-01`, `DATA-01`, `PRICE-01`, `OCR-01a`, `OCR-01c`, `TRUST-01`을 완료한다.
- M-14a 순수모듈 추출과 UX-01b 상태 오류를 먼저 처리해 회귀 테스트 기반을 만든다.
- L-03 행 단위 격리, 오류 계수, feed 가용성 알림을 구현한다.
- 기존 상품·저장 비교함 데이터의 영향 범위를 산출하고 복구 또는 재검수한다.

### 단계 2 — 배포·신뢰경계·공급망

목표 기간: 단계 1 종료 후 1~2주.

- `DEPLOY-01` cold-start와 D1 migration 증거를 확보한다.
- `AUTH-01` Sites header Gate를 검증하고 방어적 인증 계층을 적용한다.
- `KAKAO-REL-01`, `OCR-01b`, `ENV-01`의 나머지 배포·런타임 작업을 완료한다.
- 키 회전 후 과거 URL·요청 로그·오류 추적 저장소의 노출 범위와 삭제 가능성을 평가한다.

### 단계 3 — 정책·법무·접근성·운영 인수

목표 기간: 단계 2 종료 후 1~2주. 법무·플랫폼 외부 확인 지연은 별도 Gate로 기록한다.

- `POLICY-01`, `LEGAL-01`, `UX-01a/c`, `DOCS-01`을 완료한다.
- 운영 모니터링, SLO, rollback runbook, on-call owner를 확정한다.
- 감사인에게 항목별 코드·테스트·운영 증거를 제출하고 재검증을 받는다.

## 6. 재검토 의견서 v1.1 요구조치 13건에 대한 공식 답변

| 번호 | 요구조치 | 답변 | 반영 내용 |
|---:|---|---|---|
| 1 | M-16을 P1 활성 결함으로 복원 | **수용** | fragment뿐 아니라 POST body 교환과 로그 제거까지 요구 |
| 2 | ENV-01을 단계 0으로 이동, 킬스위치 선행 | **수용** | 서버측 단일 킬스위치 → H-04 순서 확정 |
| 3 | BUILD-01을 단계 0~1로 이동 | **수용** | 단계 0 CI skeleton, 단계 1 green gate |
| 4 | 미배정 10건 배정 | **수용** | 14개 프로그램, 73건, 미배정 0건 |
| 5 | OCR·UX 프로그램 분할 | **수용** | 각각 a/b/c 하위 stream으로 분할 |
| 6 | 기존 데이터 복구 stream 추가 | **수용** | 영향 query, snapshot, 복구·재검수, 종료 조건 추가 |
| 7 | M-21 P0 상향·Next 즉시 수정 | **조건부 수용** | high 3 재현, P0 상향. 설치·회귀 전 완료 단정은 유보 |
| 8 | A-07 중복 표기 철회·D1 적용 경로 | **조건부 수용** | 중복 표기 철회. repo script 또는 감사 가능한 제어면 경로 허용 |
| 9 | H-02 기본 정책과 provenance 강화 | **부분 수용** | 명백한 계약 위반 단정은 유보, 제품 분리와 migration은 반영 |
| 10 | Kakao P0를 단계 0~1로 이동 | **수용** | 미완료 시 기능 킬스위치 유지 |
| 11 | 프로그램 종료 조건 강화 | **수용** | OCR·DATA·POLICY·LEGAL·BUILD 기준 강화 |
| 12 | 운영 요소 보완 | **수용** | owner·기한·rollback·SLO·노출평가·감사인 재검증 추가 |
| 13 | 답변서와 의견서 커밋 | **조건부 수용** | 공식 기준 문서 채택 후 commit. 초안 미추적 자체는 내용 결함이 아님 |

## 7. 운영 통제와 재검증 절차

### 7.1 담당자와 기한

저장소만으로 개인 담당자 이름을 확정할 수 없으므로 임의로 기재하지 않는다. 대신 각 프로그램은 실행 시작 전에 다음 필드를 갖는 티켓으로 전환한다.

- accountable owner 개인 1명
- reviewer 개인 1명
- 착수일, 목표일, Gate 재검토일
- 변경 범위와 rollback/kill-switch 위치
- 자동 테스트, 운영 증거, 감사인 재검증 링크

개인이 배정되지 않은 P0 티켓은 “진행 중”으로 간주하지 않으며 관련 기능은 비활성 상태를 유지한다.

### 7.2 최소 모니터링

| 대상 | 제안 지표 | 초기 경보 기준 | 대응 |
|---|---|---|---|
| verified feed | 5xx·행 변환 제외 건수 | 15분 내 503 1건 또는 제외 행 증가 | 공개 추천 저하, 원인 행 격리 |
| OCR | 자동확정 후 사용자 수정률·모호 판정률 | 잘못된 자동확정 1건 | 자동확정 중지, corpus 추가 |
| Kakao import | 생성·교환·만료·중복소비·외부 fetch 실패 | 비정상 token 실패 급증 또는 성공률 기준선 하회 | rate limit, 기능 킬스위치, 로그 조사 |
| D1 migration | schema version·적용 실패 | 목표 version 불일치 1건 | 배포 중단, forward-fix 또는 rollback |
| 수익화 | 서버 script·slot·제휴 링크 활성 상태 | Gate 미완료 환경에서 활성 1건 | 전역 킬스위치 off |

성공률과 수정률의 수치 기준은 초기 1주간 baseline을 수집한 뒤 확정한다. 반면 잘못된 금액 자동확정, Gate 미완료 수익화, schema version 불일치는 1건도 허용하지 않는다.

### 7.3 비밀·로그 사후 평가

- M-01 장기 secret이 과거 URL·Kakao 설정·운영 로그에 남았는지 조사하고 즉시 회전한다.
- M-16 일회용 token은 회전 대상 장기 secret과 구분하되, 로그 보유기간과 접근자를 확인하고 가능한 범위에서 삭제·마스킹한다.
- 동일 secret을 암호키·pepper로 재사용한 데이터는 버전 필드를 도입하고 만료 또는 재암호화 전략을 기록한다.
- 조사 범위, 발견 여부, 삭제·보존 근거, 담당자와 완료일을 보안 증거로 남긴다.

### 7.4 감사인 재검증

내부 self-certification만으로 1차 개선 라운드를 닫지 않는다.

1. 73개 원문 항목과 프로그램·티켓·코드·테스트·운영 증거의 추적표를 제공한다.
2. 감사인은 P0, Gate, severity 변경 항목과 표본 P1/P2를 재검증한다.
3. 재검증에서 재현 실패 또는 증거 부족이면 해당 항목을 reopen한다.
4. 잔여 위험은 제품 책임자·보안·법무 승인자를 명시하고 만료일을 둔다.

## 8. 독립 재검증 결과 정정

| 검증 항목 | 재답변 결과 | 조치 |
|---|---:|---|
| `npm test` | build 성공, 30/30 통과 | 기존 결과 유지 |
| `tsc --noEmit --incremental false` | **27개 오류** | 선행 답변서의 30개를 정정 |
| `npm audit --omit=dev --json` | **high 3, critical 0** | M-21 P0 상향 |
| 프로그램 배정 | **63/73 → 73/73 계획** | 누락 10건 배정 |

현재 TypeScript 27개 오류의 분포는 다음과 같다.

- `cloudflare:workers` module 부재 4건
- `D1Database`·`Fetcher` global type 부재 5건
- `ComparableOffer`와 published offer 구조 불일치 12건
- `.ts` import extension 설정 2건
- `Uint8Array` BufferSource, implicit `any` 2건, optional token narrowing 1건 등 기타 4건

오류 수는 실행시점의 코드·TypeScript 설정에 따라 달라질 수 있으므로 향후 답변서는 단순 건수뿐 아니라 실행 명령, commit, 오류 category를 함께 기록한다.

## 9. 수정된 최종 수용 기준

다음 조건을 모두 만족해야 1차 개선 라운드를 종료한다.

- 73건 전부가 하나의 상위 프로그램과 실행 티켓에 배정되고 미배정 항목이 없다.
- P0·Gate는 완료되거나 관련 기능이 서버측 킬스위치로 비활성화되어 있다.
- `typecheck → lint → test → build`가 clean checkout CI에서 통과하며 type assertion만으로 runtime 문제를 숨기지 않는다.
- production `npm audit`의 high·critical이 0이거나 각 잔여 항목에 도달 가능성, 보완통제, 승인자와 재검토일이 있다.
- Kakao landing·교환 API·로그·history에 원문 token이나 장기 secret이 남지 않는다.
- OCR 재현 corpus에서 잘못된 자동확정은 신뢰도와 무관하게 0건이며 모호한 입력은 사용자 확인으로 실패-폐쇄된다.
- draft 생성 전후 승인 상품 DTO가 불변이고, 기존 영향 데이터의 복구·재검수 결과가 보관된다.
- 기본 추천과 내 입력 포함 비교가 UI·계산·저장 schema·문서에서 일치한다.
- D1 cold-start와 migration 경로가 clean project에서 재현되고 적용 증거가 남는다.
- 법무·개인정보·이미지 권리 checklist와 실제 활성 기능이 일치한다.
- 운영 owner, 기한, rollback, kill switch, 모니터링과 경보 경로가 지정되어 있다.
- 감사인이 P0·Gate·재분류 항목을 재검증하고 잔여 위험을 명시적으로 승인한다.

## 10. 제한사항과 남은 확인사항

1. OpenAI Sites가 외부 `oai-authenticated-*` 헤더를 제거하는지는 여전히 공식 증거 또는 운영 검증이 필요하다.
2. `next@16.2.12`는 npm이 제시한 수정 후보이며 아직 이 작업본에 설치하지 않았다.
3. D1 cold-start와 Sites 제어면 migration 적용은 실제 새 프로젝트 배포 전에는 완료로 판정할 수 없다.
4. Kakao 인앱 브라우저에서 120초 TTL이 충분한지 실측이 필요하다.
5. H-02의 최종 정책은 제품 책임자의 명시적 승인과 문서 일치가 필요하다.
6. 개인정보·광고·주류·이미지 관련 항목은 법률의견이 아니다.
7. 성능·확장성은 R-02·R-03의 실측 프로그램과 owner를 별도로 지정해야 한다.

## 11. 문서 상태와 후속 산출물

본 재답변서는 선행 답변서 v1.0을 즉시 덮어쓰지 않는다. 다음 순서로 공식화한다.

1. 감사인과 제품 책임자가 본 재답변서의 판정표를 확인한다.
2. 선행 답변서를 v1.1로 개정해 M-16, M-21, L-03, 프로그램·단계·종료 기준을 반영한다.
3. 73개 추적표와 실행 티켓을 생성하고 개인 owner·기한을 배정한다.
4. 채택된 선행 답변서 v1.1, 재검토 의견서, 본 재답변서를 함께 버전관리한다.

## 참고 근거

- `docs/AUDIT_RESPONSE_2026-08-01.md`
- 재검토 의견서 v1.0, 2026-08-01
- `app/page.tsx`
- `app/api/kakao/skill/route.ts`
- `app/api/kakao/import/route.ts`
- `app/lib/kakao-import.ts`
- `app/layout.tsx`
- `app/components/ad-slot.tsx`
- `README.md`
- `docs/PRICE_DATA_CONTRACT.md`
- `package.json`, `package-lock.json`, `tsconfig.json`
- `npm audit --omit=dev --json`, 2026-08-01 실행 결과
- `npx tsc --noEmit --incremental false --pretty false`, 2026-08-01 실행 결과

