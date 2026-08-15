# CherryPicker 감사인 의견서 v3.0에 대한 답변서

문서 상태: 감사인 회신 답변서 v1.0  
대상 문서: `CherryPicker 통합 답변서 v1.1에 대한 감사인 의견서 v3.0`  
선행 문서: `docs/AUDIT_RESPONSE_V1.1_2026-08-01.md`  
감사 기준일·커밋: 2026-08-01 · `99aa303`  
답변 기준일: 2026-08-01  
대상 독자: 감사인, 제품 책임자, 개발 책임자, 데이터·플랫폼·보안·법무 담당자

> 본 답변서는 감사인 의견서 v3.0의 정정과 지적에 대한 최종 입장, 선택한 설계안, v1.2 반영 규칙을 확정한다. 아직 코드로 구현하거나 배포환경에서 입증하지 않은 조치는 완료로 표시하지 않는다. 법률 관련 내용은 출시 위험 관리 기준이며 법률의견을 대체하지 않는다.

## 기술 요약

감사인 의견서 v3.0의 핵심 결론을 수용한다. 통합 답변서 v1.1은 73개 항목의 회계 무결성과 14개 상위 프로그램 배정을 복구했지만, **단계 0과 단계 1의 실행 스트림·의존성·종료 증거가 불완전하므로 아직 착수 승인 문서로 사용할 수 없다.**

최종 입장은 다음과 같다.

- 감사인이 정정한 쿠팡 중립 검색 링크, H-01 인증 header, Cloudflare 타입 패키지 관련 세 항목은 모두 수용한다.
- C-1~C-5는 모두 수용한다. C-1은 `AUTO_CONFIRM_ENABLED`, C-3은 신선도 정책의 단계 1 선행 분리, C-5는 `wrangler.jsonc` 기반 공식 타입 생성 경로로 결정한다.
- H-01 완료 전 관리자 경로를 보호하기 위해 `ADMIN_UI_ENABLED=false`를 추가한다. 이에 따라 단계 0 독립 플래그는 네 개가 아니라 **여섯 개**다.
- v1.2에서는 §8.2 실행 스트림 원장을 단일 진실 원천으로 삼고 §9 단계, §10 종료 조건, §13 모니터링, §17 최종 수용 기준이 원장 행을 참조하도록 재구성한다.
- 원문 73개 항목의 판정과 상위 프로그램 합계는 변경하지 않는다. **수용 42, 통합 수용 16, 부분 수용 12, 추가 검증 3, 합계 73**을 유지한다.
- 현 출시 판단은 계속 **조건부 중단**이다. 본 답변서의 문서 정정이 끝나더라도 코드·CI·배포 증거가 없으면 관련 Gate는 열리지 않는다.

## 1. 감사인 v3.0의 자기정정에 대한 답변

| 감사인 정정 | 최종 입장 | 확정 조치 |
|---|---|---|
| 쿠팡 검색 URL에 제휴 식별자가 없으며 B-3의 기존 처방이 과잉이었다 | **수용** | 현재 URL은 중립 검색 링크로 분류한다. `lptag`, `subId`, `link.coupang.com` 등 수익 귀속 수단이 추가되는 시점부터 링크 요소와 고지를 `MONETIZATION_ENABLED` 뒤로 이동한다. |
| Worker에서 `oai-authenticated-user-email`을 무조건 제거하면 관리자 인증이 중단된다 | **수용** | 대체 검증 없이 header를 삭제하지 않는다. AUTH-01은 서명 assertion 또는 독립 세션으로 전환하고, 그 전까지 관리자 UI·API를 별도 플래그로 닫는다. |
| `@cloudflare/workers-types`만 추가해 27→18로 감소한다는 추정이 성립하지 않는다 | **수용** | 단일 패키지 추가를 완료 조건에서 제거한다. Wrangler 설정, 생성된 `Cloudflare.Env`, 설정 drift 검사와 타입 영역 분리를 하나의 산출물로 묶는다. |

감사인의 정정은 적절하다. 특히 H-01 처방 철회는 단순한 문구 조정이 아니라 인증 가용성과 보안 경계를 동시에 보존하는 필수 정정이다.

## 2. 차단 C-1~C-5에 대한 최종 답변

### 2.1 C-1 — 자동확정·검수되지 않은 절감액 저장 차단

**전면 수용한다.** v1.1은 단계 0에서 중지한다고 선언했지만 플래그, 소유 스트림, 적용 지점과 종료 증거가 없었다.

v1.2에는 다음을 반영한다.

| 실행 스트림 | 단계 | 원문 ID | 소유 범위 | 완료 증거 |
|---|---:|---|---|---|
| `OCR-01a0` 자동확정 차단 | 0 | H-05, M-13, M-15 | OCR 결과가 사람의 확인 없이 최종 결제값·추천 상태가 되는 경로 차단 | `AUTO_CONFIRM_ENABLED=false`에서 자동확정 DOM·state·저장 0건 |
| `PRICE-01a0` 미검수 절감액 저장 차단 | 0 | A-01 | 구매 불가능한 환산가 또는 검수되지 않은 `quickDecision.amount`의 `savedPicks` 기록 차단 | 해당 입력에서 원화 절감액 저장 0건 |

`AUTO_CONFIRM_ENABLED`는 이름상 OCR에 한정된 것처럼 보일 수 있으므로 의미를 다음처럼 고정한다.

> 자동으로 산출된 미확정 가격·추천 결과를 최종 상태로 승격하거나 영속 저장하는 기능의 통합 Gate

기본값은 `false`다. 적용 지점은 `app/page.tsx:405-434`의 OCR 자동 반영 경로와 `app/page.tsx:999-1014`의 `savedPicks` 쓰기 경로다. 서버 wrapper가 값을 읽어 client에 명시 prop으로 전달하며 값 부재·파싱 실패 시 `false`다.

허용 조건은 `OCR-01a`, `OCR-01c`, `PRICE-01a`, H-04의 SSR·수화 E2E가 모두 완료된 경우다. H-05·M-13·M-15의 단계 표기는 `0~1`로 변경한다. A-01은 PRICE-01a 단계 1에서 해결하되 단계 0에는 `PRICE-01a0` 차단으로 보호한다.

### 2.2 C-2 — KAKAO-SEC-01의 실제 실행 순서

**전면 수용한다.** 단계 1 완료 목록에서 KAKAO-SEC-01이 빠진 것은 실행 불가능한 계획이었다.

단계 1 순서를 다음과 같이 고정한다.

1. `KAKAO-SEC-01b`: 장기 skill secret, URL 암호키, user hash pepper를 분리하고 회전·구버전 만료 전략과 HTTPS-only 검증을 구현한다.
2. `KAKAO-SEC-01a`: query token을 제거하고 fragment landing과 POST body 교환, URL·로그 무노출을 구현한다.
3. `KAKAO-REL-01`: 변경된 키·token 모델 위에서 retry, cleanup, quota, 다중 이미지, canonical origin을 구현한다.
4. `OCR-01b`: Tesseract worker/core/lang 자체 hosting을 완료한다.
5. `KAKAO-SEC-01c`: Worker 공통 response helper를 모든 응답에 적용하고 jsdelivr 없는 CSP를 enforce로 전환한다.

`KAKAO_IMPORT_ENABLED`는 1~3과 Kakao WebView Gate가 완료될 때까지 `false`다. 단계 0에는 `KAKAO-SEC-01c0`으로 공통 helper와 CSP Report-Only를 먼저 넣고, 단계 1의 `KAKAO-SEC-01c1`에서 enforce로 전환한다. 원문 73개 집계에서는 KAKAO-SEC-01c를 신규 감사 항목으로 세지 않고 M-01·M-16·M-17·L-15의 공통 보완통제로 기록한다.

### 2.3 C-3 — 신선도 정책과 TRUST-01의 단계 역전

**전면 수용하고 감사인이 제시한 선택지 1을 채택한다.** 신선도 단일 정책 함수를 단계 1 선행 산출물로 올린다.

POLICY-01을 다음처럼 분리한다.

| 실행 스트림 | 단계 | 원문 ID | 종료 조건 |
|---|---:|---|---|
| `POLICY-01a` freshness contract | 1 | M-07, M-27, L-21 | validator·DB query·reference 판정·UI 문구가 하나의 정책 함수와 경계 테스트를 사용 |
| `POLICY-01b` variant/stock/condition | 2 | M-28, L-05 | variant·재고·condition 계약, backfill, 추천 제외 규칙 완료 |

`TRUST-01`의 reference 문구·최신/참고 카운트·대표가격 회귀는 `POLICY-01a` 완료 뒤 실행한다. provenance와 기본 추천/내 입력 분리는 병렬 착수할 수 있지만 최종 종료는 freshness contract에 의존한다.

v1.2의 M-07 범위에는 현재 충돌 지점을 네 종류로 기록한다.

- `offer-input.ts`의 official 14일·licensed pickup 7일·기타 3일 입력 상한
- `price-store.ts`의 1일·3일·7일 `effectiveFreshUntil`
- `price-store.ts:123`의 30일 공개 query cutoff
- `page.tsx`의 “최대 14일” 사용자 문구

30일 값은 freshness로 표시하지 않고 공개 query 보존·조회 상한으로 명명한다. 최종 정책 함수는 `freshUntil`과 `queryRetentionUntil`을 분리해 UI가 두 개념을 혼동하지 않게 한다.

### 2.4 C-4 — 텔레메트리·모니터링 소유권

**전면 수용한다.** 지표 수집 방침만 정하고 실행 owner와 시작 단계를 지정하지 않은 것은 B-9의 부분 미종결이었다.

| 모니터링 대상 | 소유 스트림 | 최초 동작 단계 | 수집·경보 기준 |
|---|---|---:|---|
| verified feed 오류·제외 행 | DATA-01b | 1 | 개인정보 없는 category aggregate, 503 1건 또는 제외 행 증가 시 격리 |
| Kakao 생성·성공·410·외부 fetch 실패 | KAKAO-REL-01 | 1 | token·bot 식별자 없는 counter, 급증 또는 성공률 하회 시 기능 off |
| OCR 잘못된 자동확정 | OCR-01a | 1 | 합성·사용권 있는 운영자 corpus에서 1건이면 Gate 실패 |
| 수익화·주류·자동확정·관리자 DOM | ENV-01a | 0 | CI와 비운영 대상 환경에서 flag별 대상 DOM 0건 확인 |
| 원격 telemetry 승인·보유·위탁 | LEGAL-01b | 3 | 명세·방침·위탁·보유기간 승인 전 `TELEMETRY_ENABLED=false` |
| D1 manifest checksum | DEPLOY-01a/b | 0→2 | 불일치 1건이면 배포 차단 |

단계 3은 경보를 처음 만드는 단계가 아니라 owner·on-call·SLO·보유정책을 운영 인수하는 단계로 정정한다. 단계 0·1 green gate에 필요한 로컬·CI·aggregate 신호는 해당 단계부터 동작해야 한다.

### 2.5 C-5 — Cloudflare 공식 타입 생성 경로

**전면 수용한다.** 현재 저장소에는 Wrangler 설정 파일이 없고 D1/R2 binding이 `vite.config.ts`의 인라인 객체에만 있으므로 `wrangler types --check`가 성립하지 않는다. 현재 TypeScript 27건도 독립 재현했다.

v1.2의 단계 0 산출물을 다음처럼 확정한다.

1. `wrangler.jsonc`를 Cloudflare Worker main, compatibility flag, D1·R2 binding의 배포 기준 설정으로 신설한다.
2. `wrangler types worker-configuration.d.ts`로 runtime·`Cloudflare.Env` 타입을 생성한다. 현재 Wrangler 4.92.0에서 `--include-runtime`과 `--include-env`의 기본값은 모두 true다.
3. CI에 `wrangler types worker-configuration.d.ts --check`를 추가한다.
4. `vite.config.ts`의 `localBindingConfig`와 `wrangler.jsonc`의 main·compatibility flag·binding 이름을 비교하는 fail-fast drift test를 DEPLOY-01a에 둔다.
5. DOM/Worker lib 충돌 회피는 **두 tsconfig 분리**를 기본 결정으로 한다. `tsconfig.app.json`은 DOM/Next, `tsconfig.worker.json`은 Worker·DB 경계를 검사한다. Cloudflare binding 접근이 양쪽에 걸친 모듈은 억지로 전역 타입을 섞지 않고 typed adapter 경계로 이동한다.
6. `@cloudflare/workers-types`를 루트 전역에 단독 추가하는 방법과 임시 triple-slash는 최종 완료 조건으로 인정하지 않는다.

BUILD-01a는 생성·typecheck를, DEPLOY-01a는 설정 drift·binding 주입·D1 harness를 소유한다. 단계 0 종료에는 두 스트림의 증거가 모두 필요하다.

## 3. 중요 지적에 대한 답변

### 3.1 14개 프로그램 전체의 종료 의무

**수용한다.** §17에 다음 규범을 추가한다.

> §8.2 실행 스트림 원장에 등록된 14개 상위 프로그램의 모든 필수 스트림이 §10의 종료 조건과 증거를 충족해야 한다. P2·단계 3을 포함한 미완료 스트림이 있으면 1차 개선 라운드는 종료되지 않는다. 외부 승인 지연은 관련 기능을 독립 server flag로 비활성화하고 owner·만료일이 있는 잔여 위험 승인으로만 유보할 수 있다.

이 규범은 POLICY-01, KAKAO-REL-01, DATA-01b, ENV-01b, OCR-01b, PRICE-01b, BUILD-01b, UX-01 전 스트림과 DOCS-01을 포함한다.

### 3.2 여섯 기능 플래그의 소유권과 적용 지점

ENV-01a가 서버 판독, 기본 false, prop/API 배선과 on/off E2E를 단일 소유한다. 각 도메인 스트림은 실제 소비 지점과 허용 조건을 소유한다.

| 플래그 | 기본값 | ENV-01a 외 적용 owner | 차단 범위 | 허용 조건 |
|---|---|---|---|---|
| `MONETIZATION_ENABLED` | false | LEGAL-01a | AdSense와 실제 수익 링크·수익 고지 | 광고·권리·표시 승인 및 H-04 |
| `KAKAO_IMPORT_ENABLED` | false | KAKAO-SEC-01/KAKAO-REL-01 | skill link, landing, import API | 보안·신뢰성·WebView Gate |
| `ALCOHOL_COMMERCE_ENABLED` | false | LEGAL-01a | 주류 상거래·예약·구매 CTA | 법무·경고·표시 승인 |
| `TELEMETRY_ENABLED` | false | LEGAL-01b | 비필수 원격 telemetry | 수집명세·방침·위탁·보유 승인 |
| `AUTO_CONFIRM_ENABLED` | false | OCR-01a0/PRICE-01a0 | 미확정 OCR 승격·미검수 절감액 저장 | OCR-01a/c·PRICE-01a·H-04 |
| `ADMIN_UI_ENABLED` | false | AUTH-01 | `/admin` UI와 `/api/admin/*` 전체 | 서명 assertion 또는 독립 세션과 forged-header 회귀 |

단계 0에서는 request-time 서버 판독만 완료로 인정한다. 배포형 플래그는 대상 비운영 배포환경에서 off→on→off 전환, 최대 적용시간, SSR·수화 DOM·API 결과와 rollback 증거가 확보되기 전까지 사용하지 않는다.

### 3.3 공통 security header와 CSP

**수용한다.** §8.2에 다음 구현 분할을 추가한다.

| 실행 스트림 | 단계 | 종료 조건 |
|---|---:|---|
| `KAKAO-SEC-01c0` 공통 header helper | 0 | image 응답과 app handler 응답이 동일 helper를 통과하고 CSP Report-Only·Referrer-Policy·frame 방어가 적용 |
| `KAKAO-SEC-01c1` CSP enforce | 1 | Tesseract 자체 hosting 후 jsdelivr allowlist가 없고 CSP가 enforce이며 전체 route 회귀 통과 |

H-01과 관련된 `oai-authenticated-*` header는 이 helper가 임의 삭제하지 않는다. 인증 header의 신뢰성은 AUTH-01에서 별도로 닫는다.

### 3.4 나머지 중요 정정

| 지적 | 답변 및 v1.2 조치 |
|---|---|
| DTO 변경 후 재검증 단계가 잘못됨 | **수용**. POLICY-01a/b와 PRICE migration 등 단계 1·2의 schema/DTO 변경 직후 typecheck·통합 테스트를 재실행한다. “단계 3 DTO” 문구를 삭제한다. |
| KAKAO-REL-01이 ENV-01b보다 앞섬 | **수용**. canonical origin 설정 신설은 ENV-01a의 단계 0~1 산출물로 올리고, ENV-01b는 단계 2 운영 Host 위조·배포 E2E만 담당한다. KAKAO-REL-01은 설정 산출물에 의존한다. |
| `NEXT_PUBLIC_COUPANG_PARTNERS_ACTIVE`가 새 Gate와 분리됨 | **수용**. 현재 URL에 제휴 식별자가 없으므로 `rel=sponsored`와 수수료 고지를 제거하고 기존 public 변수를 폐기한다. 향후 수익 URL 도입 시 서버 `MONETIZATION_ENABLED`만 사용한다. |
| H-01 완료 전 잠정 통제 없음 | **수용**. `ADMIN_UI_ENABLED=false`로 관리자 UI와 쓰기 API를 단계 0부터 차단한다. AUTH-01 완료 전 공개환경에서 활성화하지 않는다. |
| 배포형 킬스위치 실증 기준 없음 | **수용**. 단계 0은 request-time만 허용하며 비운영 대상 배포환경의 off→on→off 증거가 있어야 다른 방식으로 전환할 수 있다. |
| PRICE-01의 `M-14a` 미정의 참조 | **수용**. 모두 `UX-01c0`으로 정정한다. |
| UX-01c0/c1이 §8.2에서 분리되지 않음 | **수용**. c0 단계 1, c1 단계 3을 별도 행으로 만든다. 원문 M-14는 커버리지에서 한 번만 센다. |
| PERF-01이 14개 프로그램에 없음 | **수용**. PERF-01 명칭을 정식 프로그램처럼 사용하지 않는다. 성능·확장성은 원 감사의 폐기 R 항목과 함께 “별도 관찰 backlog”로 복원하고 73개 종료 기준과 분리한다. |
| 감사 문서와 `tsconfig.tsbuildinfo`가 미추적 | **수용**. 현재도 세 답변 문서와 `tsconfig.tsbuildinfo`가 미추적임을 재확인했다. “보존 완료” 표현을 철회하고 version 관리 전 상태로 명시한다. |

## 4. v1.2의 단일 진실 원천 규칙

v1.2에서는 §8.2를 단순 분류표가 아니라 **실행 스트림 원장**으로 바꾼다. 각 행은 다음 열을 반드시 가진다.

| 필수 열 | 의미 |
|---|---|
| Stream ID | 문서 전체에서 유일한 실행 단위 |
| 원문 ID | 73개 감사 항목과의 고유 연결; 구현 분할은 중복 집계하지 않음 |
| 우선순위·단계 | 착수·완료 순서와 Gate |
| Accountable owner 역할 | 개인 배정 전에는 착수로 간주하지 않음 |
| Depends on | 선행 stream 또는 외부 Gate |
| Feature flag | 미완료 시 기능을 닫는 독립 통제 |
| 산출물 | 코드·schema·문서·runbook 결과물 |
| 검증 증거 | 자동 테스트·CI·배포 proof·승인 문서 |
| 종료 조건 | 참/거짓으로 판정 가능한 기준 |
| 참조 지표·경보 | §13에서 사용할 신호와 시작 단계 |

§9는 원장의 단계·의존성 순서만 보여주고, §10은 같은 Stream ID의 산출물·종료 조건을 확장한다. §13은 같은 Stream ID에 모니터링 owner를 연결하며, §17은 원장의 모든 필수 행이 닫혔는지를 집계한다. 다른 절에서 새 stream이나 Gate를 단독 선언하지 않는다.

원문 ID가 없는 공통 통제는 `CTRL-*` 보조 행으로 등록한다. `CTRL-*`는 73개 커버리지 분모·분자에 포함하지 않으며 관련 원문 항목의 보완통제로 연결한다.

## 5. 수정된 단계 의존성

### 단계 0 — 기능을 실제로 닫고 검증 기반을 만든다

1. ENV-01a server wrapper와 여섯 request-time 플래그를 구현한다.
2. `OCR-01a0`, `PRICE-01a0`, `ADMIN_UI_ENABLED`의 실제 차단 지점을 연결한다.
3. flag off SSR·수화 DOM·API, 비운영 환경 off→on→off 증거를 만든다.
4. BUILD-01a의 Next 보안 patch, 고정 typecheck, 27건 baseline과 신규 오류 0 Gate를 적용한다.
5. `wrangler.jsonc`, 생성 타입, 두 tsconfig, 설정 drift 검사를 만든다.
6. DEPLOY-01a의 placeholder·secret fail-fast와 D1 local/CI harness를 시작한다.
7. KAKAO import와 관리자 경로는 기본 off로 유지한다.
8. KAKAO-SEC-01c0 공통 header helper와 CSP Report-Only를 적용한다.

### 단계 1 — 타입·가격·데이터·Kakao를 green gate로 만든다

1. BUILD-01a/b 오류 0과 baseline 삭제, clean CI를 완료한다.
2. DEPLOY-01a harness 완료 후 DATA-01a/b migration·복구·feed 격리를 수행한다.
3. PRICE-01a/b, OCR-01a/b/c, UX-01c0을 완료한다.
4. POLICY-01a freshness contract를 완료한 뒤 TRUST-01의 문구·카운트·추천 회귀를 닫는다.
5. KAKAO-SEC-01b → KAKAO-SEC-01a → KAKAO-REL-01 순서로 수행한다.
6. OCR-01b 자체 hosting 후 KAKAO-SEC-01c1 CSP enforce를 완료한다.
7. 단계 1에서 변경된 모든 DTO·schema에 typecheck·통합 재검증 Gate를 실행한다.

### 단계 2 — 운영 배포·인증·나머지 데이터 계약을 닫는다

1. DEPLOY-01b가 clean project에 최신 migration manifest 전체를 적용하고 proof bundle을 만든다.
2. AUTH-01을 서명 assertion 또는 독립 세션으로 닫은 뒤에만 관리자 기능을 활성화한다.
3. POLICY-01b variant·stock·condition 계약과 backfill을 완료한다.
4. ENV-01b가 canonical origin과 image request를 운영 E2E로 검증한다.
5. 단계 2의 schema·DTO 변경 직후 typecheck·통합 테스트를 다시 실행한다.

### 단계 3 — 법무·접근성·문서·운영 인수

LEGAL-01, UX-01a·b1·c1, DOCS-01과 telemetry 방침을 완료한다. 이 단계는 단계 0·1 경보의 신설 시점이 아니라 owner·SLO·on-call·보유기간을 운영 인수하는 시점이다.

## 6. 최종 수용 기준 추가·정정

v1.1 §17의 조건에 다음을 추가한다.

- §8.2 실행 스트림 원장의 14개 상위 프로그램과 모든 필수 stream이 종료됐다.
- 단계 0 종료 시 `AUTO_CONFIRM_ENABLED=false`에서 자동확정과 검수되지 않은 절감액 저장이 서버 구성에 의해 비활성화된다.
- 단계 0 종료 시 `ADMIN_UI_ENABLED=false`에서 관리자 UI와 모든 관리자 API가 비활성화된다.
- 여섯 flag의 부재·오타·파싱 실패가 모두 false로 수렴하며 SSR·수화 DOM·API 결과가 일치한다.
- 대상 비운영 배포환경에서 여섯 flag의 off→on→off 전환과 최대 적용시간·rollback 증거가 보관됐다.
- KAKAO-SEC-01a/b/c와 KAKAO-REL-01이 정해진 선후 관계로 완료됐다.
- 모든 Worker 응답이 공통 security header helper를 통과하고 CSP가 enforce이며 jsdelivr allowlist가 없다.
- POLICY-01a의 단일 freshness 함수가 validator·DB·UI에 적용되고 30일 query retention과 freshness가 분리됐다.
- DATA-01b·OCR-01a·KAKAO-REL-01·ENV-01a·DEPLOY-01의 단계별 지표와 경보가 실제 Gate 신호로 동작한다.
- `wrangler types --check`, 설정 drift 검사, app/worker typecheck가 clean checkout CI에서 통과한다.
- 중립 쿠팡 검색 URL에는 `rel=sponsored`와 수수료 고지가 없고, 수익 링크가 존재하면 요소·고지가 함께 서버 flag 뒤에 있다.
- `UX-01c0` 식별자가 PRICE-01 테스트 경계를 포함해 문서 전체에서 일관되며 정의되지 않은 `M-14a` 참조가 없다.
- 감사 원문·의견서·답변서와 실행 증거가 저장소 또는 승인된 문서 시스템에서 version 관리된다.

## 7. 지금 착수 가능한 작업에 대한 답변

감사인이 제시한 네 작업은 다음처럼 판정한다.

| 작업 | 답변 |
|---|---|
| Next 보안 업데이트·production audit 재확인 | **수용**. 현재 16.2.6이며, 현 audit가 지시하는 수정 버전 이상으로 `eslint-config-next`와 함께 갱신하고 build·test·audit로 확정한다. |
| 고정 `typecheck`와 27건 baseline | **수용**. baseline은 파일·오류코드 단위이며 단계 1 종료 시 삭제한다. |
| 만료 Kakao token pre-decrypt/pre-fetch 410 테스트 | **수용**. 기존 재사용 410과 별개의 신규 회귀다. |
| 감사 문서 version 관리·`*.tsbuildinfo` ignore | **수용**. 단, 원 감사와 의견서 원본을 실제로 저장한 뒤에만 “보존 완료”로 표시한다. |

이 네 작업은 착수 가능하지만 C-1~C-5가 문서에 반영됐다는 이유만으로 단계 0 전체가 종료되지는 않는다.

## 8. 문서 거버넌스 정정

현재 `docs/AUDIT_RESPONSE_2026-08-01.md`, `docs/AUDIT_REVIEW_REPLY_2026-08-01.md`, `docs/AUDIT_RESPONSE_V1.1_2026-08-01.md`와 `tsconfig.tsbuildinfo`는 git 미추적 상태다. 따라서 v1.1의 “근거 이력으로 보존” 표현은 현재 사실이 아니다.

v1.2 채택 전 다음을 요구한다.

1. 원 감사, 감사인 의견서 v1.0·v2.0·v3.0, 답변서 v1.0·재답변서·v1.1·본 답변서를 승인된 경로에 저장한다.
2. 각 문서에 기준 commit, 문서 version, 작성·검토·승인 상태를 기록한다.
3. `*.tsbuildinfo`를 `.gitignore`에 추가하고 이미 생성된 파일은 추적하지 않는다.
4. v1.2가 채택된 뒤 실행 기준 문서는 v1.2 하나로 하고 이전 문서는 변경 불가 이력으로 보존한다.
5. 문서에 없는 stream·flag·Gate는 실행 티켓에서 새로 만들지 않고 먼저 문서 version을 올린다.

## 9. 남은 외부 Gate와 한계

다음 사항은 본 답변서로 종결되지 않는다.

- OpenAI Sites edge의 인증 header 처리 규약과 forged-header 차단 증거
- Kakao 인앱 브라우저의 fragment 보존과 `Sec-Fetch-*` 지원 실측
- 실제 D1 clean-project cold-start와 Sites 배포 제어면 증거
- Next 업데이트 후 전체 회귀와 production audit 결과
- 주류·광고·제휴·개인정보·이미지 권리에 대한 실제 법무 승인
- 성능·확장성의 실측 데이터와 별도 관찰 기준

따라서 본 답변서는 **문서 구조 차단을 해소하는 확정 설계**이며 구현 완료 보고서가 아니다.

## 10. 감사인 확인 요청

1. C-1에 대해 `AUTO_CONFIRM_ENABLED` 하나가 자동 승격과 미검수 절감액 영속화를 함께 차단하고, `OCR-01a0`·`PRICE-01a0`이 적용 지점을 분담하는 설계를 승인할 수 있는지 확인해 주기 바란다.
2. C-3에 대해 `POLICY-01a`를 단계 1 선행으로 올리고 30일 값을 query retention으로 분리하는 결정이 TRUST-01 단계 역전을 해소하는지 확인해 주기 바란다.
3. C-5에 대해 `wrangler.jsonc` + 생성 타입 + 두 tsconfig + drift test를 단계 0 완료 기준으로 인정할 수 있는지 확인해 주기 바란다.
4. 원문 ID가 없는 공통 통제를 `CTRL-*` 보조 행으로 두되 73개 커버리지에는 포함하지 않는 원장 규칙을 승인할 수 있는지 확인해 주기 바란다.
5. 본 답변서의 정정이 v1.2에 병합되고 실행 스트림 원장 검산이 통과한 뒤 단계 0 착수가 가능한지 재확인해 주기 바란다.

## 최종 입장

감사인 의견서 v3.0의 **차단 5건과 중요 지적을 모두 수용**한다. v1.1의 장점인 73/73 회계 무결성, 심각도 상향 근거, 14개 상위 프로그램 구조는 유지하되, 실행 가능성을 막은 누락을 위 결정으로 보완한다.

다만 문서 정정과 구현 완료를 혼동하지 않는다. v1.2가 작성·검산·version 관리되기 전에는 단계 0 착수를 승인하지 않으며, 단계 0 이후에도 각 기능은 해당 코드·테스트·배포·외부 Gate가 실제로 닫힐 때까지 기본 비활성 상태를 유지한다.

## 참고 근거

- 감사인 의견서 v3.0, 2026-08-01
- `docs/AUDIT_RESPONSE_V1.1_2026-08-01.md`
- `app/page.tsx`, `app/api/kakao/skill/route.ts`, `app/lib/kakao-import.ts`
- `app/lib/offer-input.ts`, `app/lib/price-store.ts`
- `app/chatgpt-auth.ts`, `app/lib/admin-auth.ts`, `worker/index.ts`
- `package.json`, `tsconfig.json`, `vite.config.ts`, `README.md`, `.env.example`
- `tsc --noEmit --incremental false --pretty false`, 2026-08-01 독립 재실행: 27건
- `wrangler types --help`, Wrangler 4.92.0 로컬 확인

