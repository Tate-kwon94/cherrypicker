# CherryPicker 통합 감사 답변서 및 개선계획

문서 상태: 통합 답변서 v1.1  
대상 감사: `CherryPicker 프로젝트 검토 보고서` 및 재검토 의견서 v1.0·v2.0  
대체 문서: `docs/AUDIT_RESPONSE_2026-08-01.md`, `docs/AUDIT_REVIEW_REPLY_2026-08-01.md`  
감사 기준일·커밋: 2026-08-01 · `99aa303`  
통합 기준일: 2026-08-01  
대상 독자: 감사인, 제품 책임자, 개발자, 데이터 운영자, 보안·법무 검토자

> 이 문서는 원 감사, 답변서 v1.0, 감사인 재검토 v1.0, 재답변서 v1.0, 감사인 의견서 v2.0의 유효한 판정과 정정을 하나로 합친 독립 관리문서다. 이전 문서는 판단 이력으로만 보존하며, 실행과 종료 판단에는 본 문서를 우선한다. 아직 구현하지 않은 조치는 완료로 표시하지 않는다. 법률 관련 내용은 출시 위험 관리 기준이며 법률의견을 대체하지 않는다.

## 기술 요약

- 감사의 핵심 방향은 타당하다. 현재 빌드는 통과하지만 잘못된 금액의 자동확정, 상품 마스터 덮어쓰기, 사용자 입력과 검수 가격의 신뢰 문맥 혼합, 구매 불가능한 환산가의 절감액 저장, Kakao token URL 노출, 타입체크 실패와 배포 경로 미증명이 남아 있다.
- 원문 활성 64건의 최종 판정은 **수용 38건, 통합 수용 13건, 부분 수용 11건, 추가 검증 2건, 기각 0건**이다. 추가 발견 9건을 포함한 전체 73건은 **수용 42건, 통합 수용 16건, 부분 수용 12건, 추가 검증 3건**이다.
- M-16은 **P1 활성 보안 결함**, M-21은 **P0 dependency update gate**, L-03은 **P1 feed 가용성 결함**으로 확정한다. M-14는 단계 1의 순수모듈 추출과 단계 3의 화면 구조 분리로 나눈다.
- 73개 항목은 14개 상위 프로그램과 하위 실행 스트림에 한 번씩 배정한다. 상위 프로그램 커버리지는 **73/73**, 미배정과 이중 배정은 0건이다.
- 현재 출시 판단은 **조건부 중단**이다. 공개 절감액 추천, Kakao import, 광고·제휴 수익화, 주류 상거래 링크는 각 P0·Gate가 닫히거나 독립된 서버측 fail-closed 플래그로 비활성화되어야 한다.
- 단계 0은 기능을 켜는 작업이 아니라 안전하게 끄고 검증 기반을 만드는 단계다. 서버/클라이언트 환경 배선, 네 개의 기능 플래그, Next 보안 업데이트, typecheck baseline, D1 테스트 하네스를 먼저 확보한다.

## 1. 통합 범위와 판정 기준

### 1.1 검토 범위

다음 증거를 대조했다.

- 원 감사 활성 64건, 폐기 3건, 추가 발견 9건
- 선행 답변서 v1.0과 재답변서 v1.0
- 감사인 재검토 의견서 v1.0과 v2.0
- `app/`, `worker/`, `db/`, `drizzle/`, `build/`, `tests/`, `docs/`
- `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `.openai/hosting.json`
- `npm test`, `tsc --noEmit --incremental false --pretty false`, `npm audit --omit=dev --json`

실제 OpenAI Sites edge의 관리자 header 처리와 새 D1 프로젝트 cold-start는 배포환경에서 재현하지 않았다. 관련 항목은 Gate로 유지한다.

### 1.2 판정 정의

| 판정 | 의미 |
|---|---|
| 수용 | 사실과 영향이 충분히 입증되어 독립 개선 항목으로 유지 |
| 통합 수용 | 사실은 맞지만 동일 근본 원인의 상위 프로그램에 병합 |
| 부분 수용 | 코드상 사실은 있으나 영향·법률 결론·심각도 또는 특정 처방을 조정 |
| 추가 검증 | 운영환경·플랫폼·법률 외부 사실이 확인되어야 최종 판정 가능 |
| 기각 | 핵심 사실과 활성 영향이 모두 성립하지 않아 개선 범위에서 제외 |

### 1.3 우선순위 정의

| 우선순위 | 기준 |
|---|---|
| P0 | 공개 추천·운영 배포·해당 기능 활성화 전에 반드시 해결하거나 서버측 플래그로 비활성화 |
| P1 | 첫 안정화 라운드에서 해결; 금액 정확성·보안·가용성·운영 신뢰에 직접 영향 |
| P2 | 후속 품질 라운드에서 해결; 접근성·유지보수성·장기 운영 위험 |
| Gate | 외부 플랫폼 증거 또는 법무 승인이 없으면 관련 기능을 활성화하지 않음 |

### 1.4 정량 기준

- `활성 64건`은 H-01~H-11, M-01~M-30, L-01~L-23이다.
- `전체 73건`은 활성 64건에 A-01~A-09를 더한 수다.
- 프로그램 커버리지는 각 원문 ID가 하나의 상위 프로그램에 고유 배정됐는지로 계산한다.
- `npm audit high 3`은 advisory 문장 수가 아니라 npm metadata가 high로 집계한 취약 package node 수다.

## 2. 독립 재검증 결과

| 검증 항목 | 결과 | 최종 해석 |
|---|---:|---|
| `npm test` | build 성공, 30/30 통과 | 기존 정상 사례는 보호되나 실패 corpus와 통합 검증이 부족 |
| `tsc --noEmit --incremental false --pretty false` | 실패, 27개 오류 | BUILD-01과 단계 0 baseline 필요 |
| `npm audit --omit=dev --json` | high 3, critical 0 | M-21 P0; `next@16.2.12`는 수정 후보이며 설치 검증 전 미완료 |
| OCR 할부 사례 | 86,800원 대신 7,233원, 신뢰도 100 | P0 실패-폐쇄 필요 |
| OCR 배송지 사례 | 92,000원 대신 우편번호 12,345, 신뢰도 100 | A-04 재현 |
| 상품 등록 SQL | draft 충돌 시 기존 상품 메타데이터 갱신 | H-03/M-05 P0 무결성 결함 |
| 사용자 입력 추천 | `verified || captured` 동일 trusted pool | H-02/A-03 P0 신뢰 문맥 결함 |
| 주류 절감액 | 실제 결제액과 환산 금액 차이를 원화 절감액으로 저장 가능 | A-01/PRICE-01 P0 |
| 프로그램 배정 | 선행 63/73, 통합 계획 73/73 | 누락 10건을 신규·기존 프로그램에 배정 |

TypeScript 27건의 분포는 `cloudflare:workers` module 4건, `D1Database`·`Fetcher` global type 5건, `ComparableOffer` 경계 매핑 12건, `.ts` import extension 2건, 기타 4건이다. 특정 type package를 추가하면 9건이 모두 사라진다는 주장은 실제 적용 전에는 완료 기준으로 사용하지 않는다.

## 3. 감사인 의견서 v2.0에 대한 최종 조정

| ID | 감사인 요구 | 최종 판정 | 통합 반영 |
|---|---|---|---|
| B-1 | PRICE-01/A-01 최종 기준 복원 | **수용** | 구매 불가능한 환산 금액의 절감액 저장 금지를 최종 Gate에 복원 |
| B-2 | H-04 → 킬스위치 → E2E 순서 | **조건부 수용** | 서버 wrapper와 fail-closed 배선을 먼저 구현. 플래그는 배포형 또는 요청형일 수 있으나 적용 시점과 rollback 시간을 문서화 |
| B-3 | 수익화 렌더 지점 전수 차단 | **부분 수용** | AdSense와 실제 affiliate-tracked URL은 요소 자체를 차단. 현재의 일반 쿠팡 검색 URL은 비수익·중립 링크로 별도 분류. 주류 링크는 독립 Gate 사용 |
| B-4 | Kakao import 비활성화 수단 신설 | **수용** | `KAKAO_IMPORT_ENABLED=false`를 secret과 분리해 skill·landing·import API 모두 fail-closed |
| B-5 | fragment/history 기준 충돌 해소 | **수용** | 서버 URL·로그 무노출과 client/chat 잔여 위험을 분리; history·대화방 token은 짧은 TTL과 1회 소비로 승인 관리 |
| B-6 | M-14a 소유·단계 명확화 | **수용** | UX-01c0 단계 1, UX-01c1 단계 3으로 분리 |
| B-7 | CSP 단일 소유자와 단계 인수인계 | **조건부 수용** | KAKAO-SEC-01이 공통 header를 소유. Worker 공통 response helper를 단일 적용점으로 지정하고 OCR-01b는 CDN allowlist 제거만 담당 |
| B-8 | DEPLOY-01a/b 분할과 D1 하네스 | **수용** | 단계 0~1 repo tooling·CI harness, 단계 2 cold-start 증거로 분할 |
| B-9 | 텔레메트리 개인정보 명세 | **부분 수용** | 사용자 OCR 원문·캡처 전송을 전제하지 않음. 합성·운영자 corpus와 비식별 집계가 기본이며 원격 수집은 별도 Gate |

추가로 다음 정정을 반영한다.

- ComparableOffer 12건은 제품 정책 결정이 아니라 경계 매핑 또는 단일 view type으로 행위를 보존하며 수정할 수 있다.
- 단계 0 typecheck는 red gate가 아니라 고정 명령과 단기 baseline으로 시작하고, 단계 1 종료 시 baseline을 삭제한다.
- currency schema·migration·backfill의 단일 소유자는 PRICE-01이다. POLICY-01은 해당 필드를 소비하되 별도 migration을 만들지 않는다.
- 선행 답변서의 6개 회귀 테스트군은 본 문서에 다시 수록한다.
- H-01의 인증 header를 Worker에서 무조건 삭제하지 않는다. 신뢰된 edge assertion을 대체 검증 없이 제거하면 관리자 인증도 중단되기 때문이다.

## 4. 항목별 최종 답변 — HIGH 11건

| ID | 감사 지적 | 최종 답변 | 우선순위 | 프로그램·단계 |
|---|---|---|---|---|
| H-01 | 원시 `oai-authenticated-user-email` header로 관리자 탈취 | **추가 검증**. 코드가 header를 직접 신뢰하지만 Sites edge의 외부 입력 제거 여부가 미확인이다. 신뢰 header를 무조건 삭제하지 않고 서명 assertion 또는 독립 세션을 도입한다. | Gate/P0 | AUTH-01 · 단계 2 |
| H-02 | 사용자 직접 입력이 검수 가격과 같은 추천 풀에 참여 | **부분 수용**. 현재 비교 참여 자체는 문서상 모호하나 검수 결과처럼 보이는 headline·판매처 수·저장 절감액은 P0 결함이다. 기본 추천과 `내 입력 포함 비교`를 분리한다. | P0 | TRUST-01 · 단계 0~1 |
| H-03 | draft 등록이 기존 `products` 행을 덮어씀 | **수용**. 가격 관측 생성과 상품 편집을 분리하고 기존 영향 행을 복구·재검수한다. | P0 | DATA-01a · 단계 1 |
| H-04 | 클라이언트 `NEXT_PUBLIC_*`가 `{}`로 컴파일 | **수용**. server wrapper→명시 props→fail-closed flag→SSR·수화 E2E 순으로 수정한다. | P0 | ENV-01a · 단계 0 |
| H-05 | OCR이 마지막 할부금액을 결제가로 선택 | **통합 수용**. parser corpus와 확인 전 상태로 실패-폐쇄한다. | P0 | OCR-01a · 단계 1 |
| H-06 | 다상품 장바구니에서 다른 행 가격을 결합 | **통합 수용**. 상품 block·bbox 단위로 그룹화하고 모호하면 선택을 요구한다. | P0 | OCR-01b · 단계 1 |
| H-07 | 기본 용량을 인식 성공으로 표시 | **통합 수용**. `recognized/defaulted/edited/unknown` provenance를 보존한다. | P0 | OCR-01c · 단계 1 |
| H-08 | 주류 콘텐츠 age gate·경고·광고 검토 부재 | **부분 수용**. age gate 의무는 법률검토가 필요하지만 주류 상거래·제휴 링크는 승인 전 독립 플래그로 차단한다. | Gate/P0 | LEGAL-01a · 단계 0/3 |
| H-09 | 개인정보처리방침 필수항목 누락 | **부분 수용**. 일부 항목은 있으나 책임자·권리행사·파기·전체 보유기간·위탁 등이 부족하다. | Gate/P0 | LEGAL-01b · 단계 3 |
| H-10 | CMP 적용 약속과 구현 불일치 | **부분 수용**. 대상 지역 광고는 인증 CMP 또는 명시적 비활성화가 필요하다. | P0/Gate | LEGAL-01a · 단계 0/3 |
| H-11 | 모든 가격이 검수됐다는 표시와 실제 provenance 불일치 | **수용**. 화면의 실제 데이터 집합으로 문구를 계산한다. | P0 | TRUST-01 · 단계 1 |

## 5. 항목별 최종 답변 — MEDIUM 30건

| ID | 감사 지적 | 최종 답변 | 우선순위 | 프로그램·단계 |
|---|---|---|---|---|
| M-01 | `KAKAO_SKILL_TOKEN` query 전달·요청 로그 | **수용**. header 또는 별도 자격증명으로 전환하고 기존 secret을 회전한다. | P0 | KAKAO-SEC-01b · 단계 0~1 |
| M-02 | 비교 전 `ml/g/개` 일치 검증 없음 | **수용**. unit 불일치 비교를 거부한다. | P1 | PRICE-01a · 단계 1 |
| M-03 | 쿠팡 허용오차를 잘못된 용량에 계산 | **수용**. 동일 비교 용량에서 차이와 허용오차를 계산한다. | P1 | PRICE-01a · 단계 1 |
| M-04 | `주문금액/최종`을 all-in으로 간주 | **통합 수용**. 총액 관계가 불명확하면 확인 상태로 둔다. | P0 | OCR-01a · 단계 1 |
| M-05 | offer insert가 상품 category/unit을 덮어씀 | **통합 수용**. H-03의 insert-only offer path로 닫는다. | P0 | DATA-01a · 단계 1 |
| M-06 | headline 동률 임계값 충돌 | **수용**. 단일 verdict 함수와 경계 테스트를 둔다. | P1 | PRICE-01a · 단계 1 |
| M-07 | 신선도 규칙이 세 곳에서 충돌 | **수용**. evidence/category별 단일 정책을 사용한다. | P1 | POLICY-01 · 단계 2 |
| M-08 | localStorage catch에서 재호출 | **수용**. 저장소 재접근 없이 메모리 상태로 종료한다. | P2 | UX-01b1 · 단계 3 |
| M-09 | Escape 종료 후 stale capture 상태 | **수용**. 모든 닫기 경로를 하나의 reset action으로 통합한다. | P1 | UX-01b0 · 단계 1 |
| M-10 | modal focus trap·복원 없음 | **수용**. dialog 접근성 회귀 테스트를 추가한다. | P2 | UX-01a · 단계 3 |
| M-11 | 관리자 날짜 기본값이 모듈 로드 시각에 고정 | **수용**. form open/reset 시각 또는 server 시각을 사용한다. | P1 | UX-01b0 · 단계 1 |
| M-12 | 검색 focus outline 제거 | **수용**. `:focus-visible` 스타일을 제공한다. | P2 | UX-01a · 단계 3 |
| M-13 | OCR이 배송·쿠폰을 덮고 할인을 이중 차감 | **통합 수용**. 상호 배타적 계산 경로와 field provenance를 둔다. | P0 | OCR-01a · 단계 1 |
| M-14 | 2,326행 단일 client component | **부분 수용**. 핵심 순수모듈 추출은 P1, 나머지 화면 분리는 P2다. | P1/P2 | UX-01c0/1 · 단계 1/3 |
| M-15 | 다수량 총액을 단품에 적용 | **통합 수용**. 수량을 파싱하거나 자동확정을 중단한다. | P0 | OCR-01a · 단계 1 |
| M-16 | 랜딩 query 일회용 token 노출 | **수용**. active exploit 증거는 없지만 hydration 전 URL·로그 노출이 실제다. fragment landing+POST body 교환과 별도 기능 플래그를 적용한다. | P1 | KAKAO-SEC-01a · 단계 0~1 |
| M-17 | Kakao secret을 bearer·암호키·pepper로 재사용 | **수용**. 키를 분리하고 버전·회전·기존 데이터 만료 전략을 둔다. | P0 | KAKAO-SEC-01b · 단계 0~1 |
| M-18 | 긴 숫자열 일부를 금액으로 인식 | **통합 수용**. 숫자 경계와 식별자·전화번호 corpus를 추가한다. | P0 | OCR-01a · 단계 1 |
| M-19 | typecheck가 실행되지 않고 오류 존재 | **수용**. 고정 명령·단기 baseline을 거쳐 단계 1에서 0개로 만든다. | P0 | BUILD-01a · 단계 0~1 |
| M-20 | Cloudflare/D1 type 부재 | **수용**. 프로젝트 runtime과 호환되는 공식 type 생성 경로를 선택한다. | P0 | BUILD-01a · 단계 0 |
| M-21 | exact pin과 production 취약 dependency | **부분 수용**. exact pin이 수동 패치를 막지는 않지만 현재 high 3이 재현됐다. Next 수정 후보를 검증해 즉시 갱신한다. | P0 | BUILD-01a · 단계 0 |
| M-22 | CI 없음 | **수용**. baseline 신규 오류 0에서 시작해 단계 1 strict gate로 전환한다. | P0/P1 | BUILD-01a · 단계 0~1 |
| M-23 | D1 placeholder·cold deploy 적용 경로 없음 | **추가 검증**. migration 패키징은 있으나 적용 증거가 없다. repo tooling과 cold-start를 분리한다. | Gate/P0 | DEPLOY-01a/b · 단계 0~2 |
| M-24 | vinext image endpoint binding 실패 가능 | **수용**. unoptimized 정책 또는 binding을 명시하고 실제 요청을 검증한다. | P1 | ENV-01b · 단계 2 |
| M-25 | Node 최소버전과 실제 요구 불일치 | **수용**. 지원 버전을 CI matrix로 고정한다. | P1 | BUILD-01b · 단계 1 |
| M-26 | Tesseract runtime이 제3자 CDN 의존 | **수용**. 자산 자체 호스팅 후 CSP allowlist를 축소한다. | P1 | OCR-01b · 단계 1 |
| M-27 | 주류 신선도 UI와 코드 충돌 | **통합 수용**. M-07 단일 정책으로 닫는다. | P1 | POLICY-01 · 단계 2 |
| M-28 | variant/currency/stock/조건 계약 미구현 | **수용**. currency migration은 PRICE-01, 나머지 필드 계약·backfill은 POLICY-01이 소유한다. | P1 | POLICY-01 · 단계 2 |
| M-29 | 브랜드 사진 사용권 미확인 | **부분 수용**. 침해를 확정할 수 없지만 수익화 전 증빙 또는 교체가 필요하다. | Gate/P0 | LEGAL-01a · 단계 0/3 |
| M-30 | Host header로 canonical URL 생성 | **부분 수용**. canonical origin을 필수 설정하고 허용 host를 검증한다. | P1 | ENV-01b · 단계 2 |

## 6. 항목별 최종 답변 — LOW 23건

| ID | 감사 지적 | 최종 답변 | 우선순위 | 프로그램·단계 |
|---|---|---|---|---|
| L-01 | Admin API 관리자 이메일 oracle | **통합 수용**. H-01 검증 뒤 균일 응답·rate limit·감사 로그를 적용한다. | Gate/P1 | AUTH-01 · 단계 2 |
| L-02 | 통화 모델 없이 USD와 KRW 비교 | **수용**. PRICE-01이 currency schema·migration·backfill과 KRW 기본 정책을 소유한다. | P1 | PRICE-01b · 단계 1 |
| L-03 | 한 malformed row가 feed 전체를 503 | **부분 수용**. 예시가격 위장 영향은 과장이나 core feed 가용성 결함이다. | P1 | DATA-01b · 단계 1 |
| L-04 | 승인 취소 시 승인 이력 삭제 | **수용**. immutable review event 또는 이전 승인자·시각을 보존한다. | P2 | DATA-01b · 단계 1 |
| L-05 | Drizzle schema와 runtime SQL 분리 | **부분 수용**. handwritten SQL 자체가 아니라 drift 검증 부재가 문제다. | P2 | POLICY-01 · 단계 2 |
| L-06 | 만료 Kakao 행이 새 요청 때만 정리 | **수용**. scheduled cleanup 또는 bounded cleanup을 운영한다. | P2 | KAKAO-REL-01 · 단계 1 |
| L-07 | 사용자별 active import cap race | **수용**. 원자적 quota 기록 또는 constraint로 보장한다. | P2 | KAKAO-REL-01 · 단계 1 |
| L-08 | `#my-comparisons` anchor 부재 | **수용**. fragment token과 anchor를 분리하고 항상 존재하는 target 또는 명시적 scroll을 사용한다. | P2 | UX-01a · 단계 3 |
| L-09 | file input accessible name 과다 | **수용**. label과 `aria-describedby`를 분리한다. | P2 | UX-01a · 단계 3 |
| L-10 | role 없는 div의 `aria-label` | **수용**. 적절한 role을 적용하거나 label을 제거한다. | P2 | UX-01a · 단계 3 |
| L-11 | `event.timeStamp`를 epoch 저장시각으로 사용 | **수용**. `Date.now()`와 epoch validator를 사용한다. | P2 | UX-01b1 · 단계 3 |
| L-12 | `persistOffers` no-op·dead parser | **수용**. 현재 세션 전용이면 dead 복원을 제거하고 함수명을 정정한다. | P2 | UX-01b1 · 단계 3 |
| L-13 | product 선택 시 form remount로 입력·focus 유실 | **수용**. key remount를 제거한다. | P2 | UX-01b1 · 단계 3 |
| L-14 | transient fetch 실패에도 import 삭제 | **수용**. 성공 후 삭제 또는 bounded retry 상태를 둔다. | P1 | KAKAO-REL-01 · 단계 1 |
| L-15 | Kakao CDN `http://` 허용 | **수용**. 모든 redirect hop에 HTTPS를 강제한다. | P0 | KAKAO-SEC-01b · 단계 0~1 |
| L-16 | 판매처 탐지가 전체 text 첫 패턴 우선 | **통합 수용**. 상품 block 근접도와 충돌 확인을 적용한다. | P1 | OCR-01b · 단계 1 |
| L-17 | Kakao webhook production origin hardcode | **수용**. 검증된 canonical URL 설정을 사용한다. | P2 | KAKAO-REL-01 · 단계 1 |
| L-18 | 미인식 상품을 기본 화장품에 귀속 | **통합 수용**. `productId=null`을 유지하고 선택 전 제출을 막는다. | P0 | OCR-01c · 단계 1 |
| L-19 | Vite build plugin이 ESLint 제외 | **수용**. build plugin을 lint 대상에 포함한다. | P2 | BUILD-01b · 단계 1 |
| L-20 | server render test가 stale dist 검증 | **수용**. fresh build hash 또는 build 선행을 강제한다. | P2 | BUILD-01b · 단계 1 |
| L-21 | 14일 official-listing branch dead code | **통합 수용**. 단일 신선도 정책으로 제거한다. | P1 | POLICY-01 · 단계 2 |
| L-22 | robots/admin/API·sitemap 날짜 위생 | **부분 수용**. 보안 경계는 아니지만 crawl·날짜 정책을 정리한다. | P2 | DOCS-01 · 단계 3 |
| L-23 | README env·Kakao 목적지 drift | **수용**. 실제 env·flag·import 흐름과 일치시킨다. | P2 | DOCS-01 · 단계 3 |

## 7. 항목별 최종 답변 — 추가 발견 9건

| ID | 추가 지적 | 최종 답변 | 우선순위 | 프로그램·단계 |
|---|---|---|---|---|
| A-01 | 구매 불가능한 면세 환산가를 절감액으로 표시·저장 | **수용**. 실제 결제액, 단위가, 환산 가치를 분리하고 저장 절감액은 구매 가능한 대안 차이만 허용한다. | P0 | PRICE-01a · 단계 1 |
| A-02 | Kakao 다중 이미지 중 첫 장만 저장 | **수용**. 모두 처리하거나 webhook에서 1장만 명시적으로 허용한다. | P1 | KAKAO-REL-01 · 단계 1 |
| A-03 | 사용자 입력과 검수 가격 client 혼합 | **통합 수용**. H-02의 모드·provenance 정책으로 닫는다. | P0 | TRUST-01 · 단계 1 |
| A-04 | 모든 group이 optional인 `최종` regex | **통합 수용**. 필수 qualifier와 식별자 제외 corpus를 둔다. | P0 | OCR-01a · 단계 1 |
| A-05 | 주류 판매처 패턴과 화장품 고정 capture flow | **통합 수용**. category catalog를 선택하거나 지원하지 않는 입력을 거부한다. | P0 | OCR-01c · 단계 1 |
| A-06 | `tsconfig.tsbuildinfo` ignore 누락 | **수용**. ignore와 clean checkout 기준을 정리한다. | P2 | BUILD-01a · 단계 0 |
| A-07 | Drizzle remote D1 적용 경로 없음 | **추가 검증**. M-23과 위험은 공유하지만 패키징과 실제 적용은 별도 증거다. | Gate/P1 | DEPLOY-01a/b · 단계 0~2 |
| A-08 | `.mjs` 테스트가 TypeScript include 밖 | **수용**. 핵심 fixture는 `checkJs`, JSDoc 또는 type test로 검증한다. | P2 | BUILD-01b · 단계 1 |
| A-09 | 처리위탁·국외이전 고지 누락 | **부분 수용**. 실제 계약상 역할·지역을 inventory로 확정해 필요한 고지를 반영한다. | Gate/P0 | LEGAL-01b · 단계 3 |

## 8. 73개 항목의 단일 프로그램 배정

### 8.1 상위 프로그램 커버리지

| 상위 프로그램 | 고유 배정 ID | 건수 | 주 담당 역할 | 주 단계 |
|---|---|---:|---|---|
| OCR-01 추출·확인·runtime | H-05,H-06,H-07,M-04,M-13,M-15,M-18,M-26,L-16,L-18,A-04,A-05 | 12 | App/Core | 1 |
| DATA-01 쓰기 무결성·복구 | H-03,M-05,L-03,L-04 | 4 | Data/API | 1 |
| PRICE-01 가격 의미·통화 | A-01,M-02,M-03,M-06,L-02 | 5 | Product/Core/Data | 1 |
| TRUST-01 출처 표현 | H-02,H-11,A-03 | 3 | Product/UI | 0~1 |
| BUILD-01 type·CI·dependency | M-19,M-20,M-21,M-22,M-25,L-19,L-20,A-06,A-08 | 9 | Platform | 0~1 |
| ENV-01 환경·canonical·image | H-04,M-24,M-30 | 3 | Platform/UI | 0~2 |
| KAKAO-SEC-01 비밀·token·header | M-01,M-16,M-17,L-15 | 4 | Security/Platform | 0~1 |
| KAKAO-REL-01 import 신뢰성 | L-06,L-07,L-14,L-17,A-02 | 5 | API/Data | 1 |
| POLICY-01 가격 데이터 계약 | M-07,M-27,M-28,L-05,L-21 | 5 | Product/Data | 2 |
| AUTH-01 관리자 신뢰경계 | H-01,L-01 | 2 | Security/Platform | Gate/2 |
| LEGAL-01 공개·수익화 조건 | H-08,H-09,H-10,M-29,A-09 | 5 | Legal/Operations | 0/3 |
| UX-01 접근성·상태·구조 | M-08,M-09,M-10,M-11,M-12,M-14,L-08,L-09,L-10,L-11,L-12,L-13 | 12 | UI | 1/3 |
| DEPLOY-01 D1 적용 경로 | M-23,A-07 | 2 | Platform/Data | 0~2 |
| DOCS-01 crawl·문서 정합 | L-22,L-23 | 2 | Platform/Docs | 3 |
| **합계** | **H 11 + M 30 + L 23 + A 9** | **73** |  | **미배정 0·이중 배정 0** |

### 8.2 하위 실행 스트림

| 실행 스트림 | 원문 ID | 건수 | 단계 | 종료 초점 |
|---|---|---:|---|---|
| OCR-01a parser | H-05,M-04,M-13,M-15,M-18,A-04 | 6 | 1 | 금액·수량·식별자 parser가 정확하거나 `확인 필요` |
| OCR-01b spatial/runtime | H-06,M-26,L-16 | 3 | 1 | 상품 block 연계, 자체 hosting, CDN 제거 |
| OCR-01c provenance/catalog | H-07,L-18,A-05 | 3 | 1 | field provenance, 미인식 null, category catalog |
| DATA-01a write integrity | H-03,M-05 | 2 | 1 | offer insert와 상품 편집 분리 |
| DATA-01b feed/history | L-03,L-04 | 2 | 1 | 행 단위 격리와 immutable review history |
| PRICE-01a amount semantics | A-01,M-02,M-03,M-06 | 4 | 1 | 실제 결제액·단위가·환산가·절감액 분리 |
| PRICE-01b currency schema | L-02 | 1 | 1 | currency migration·backfill·KRW 기본 정책 |
| TRUST-01 | H-02,H-11,A-03 | 3 | 0~1 | 기본 추천과 내 입력 포함 비교 분리 |
| BUILD-01a baseline/security | M-19,M-20,M-21,M-22,A-06 | 5 | 0~1 | 고정 명령, dependency patch, baseline→0 |
| BUILD-01b coverage/tooling | M-25,L-19,L-20,A-08 | 4 | 1 | Node·lint·fresh build·JS fixture 검증 |
| ENV-01a server/client flags | H-04 | 1 | 0 | server wrapper, fail-closed props, on/off E2E |
| ENV-01b canonical/image | M-24,M-30 | 2 | 2 | 공식 origin과 image request 정책 |
| KAKAO-SEC-01a import token | M-16 | 1 | 0~1 | fragment landing, POST body, 로그 무노출 |
| KAKAO-SEC-01b secret/transport | M-01,M-17,L-15 | 3 | 0~1 | key 분리·회전·HTTPS-only |
| KAKAO-REL-01 | L-06,L-07,L-14,L-17,A-02 | 5 | 1 | retry·cleanup·quota·canonical·다중 이미지 |
| POLICY-01 | M-07,M-27,M-28,L-05,L-21 | 5 | 2 | freshness·variant·stock·condition 계약 |
| AUTH-01 | H-01,L-01 | 2 | Gate/2 | edge 증거·독립 인증·균일 거부 |
| LEGAL-01a feature gates | H-08,H-10,M-29 | 3 | 0/3 | 주류·광고·이미지 권리 Gate |
| LEGAL-01b privacy inventory | H-09,A-09 | 2 | 3 | 법정 항목·처리자·위탁·국외이전 |
| UX-01a accessibility | M-10,M-12,L-08,L-09,L-10 | 5 | 3 | dialog·focus·anchor·accessible name |
| UX-01b0 critical state | M-09,M-11 | 2 | 1 | stale state와 시간 기준 |
| UX-01b1 storage/form | M-08,L-11,L-12,L-13 | 4 | 3 | storage 예외·저장시각·dead flow·remount |
| UX-01c component boundary | M-14 | 1 | 1/3 | c0 순수모듈 추출 후 c1 화면 구조 분리 |
| DEPLOY-01a repo path/harness | M-23,A-07 | 2 | 0~1 | migrate·verify script, fail-fast, D1 CI harness |
| DEPLOY-01b cold-start | M-23,A-07 | — | 2 | clean project 적용·증거; 동일 원문 항목의 후속 단계 |
| DOCS-01 | L-22,L-23 | 2 | 3 | robots/sitemap·env/import 문서 정합 |

`DEPLOY-01a/b`와 `UX-01c0/c1`은 하나의 원문 항목을 단계별로 완료하는 구현 분할이다. 원문 커버리지 집계에서는 각각 한 번만 센다.

## 9. 단계별 실행 순서

### 단계 0 — 안전하게 끄고 검증 기반을 만든다

목표 기간: 착수 후 0~3영업일. 개인 owner가 배정되지 않은 P0 작업은 시작된 것으로 간주하지 않는다.

1. `app/page.tsx`의 route entry와 client 화면을 분리해 server wrapper가 명시적 runtime props를 전달하게 한다.
2. 네 개의 독립된 fail-closed flag를 server에서 읽고 값 부재·파싱 실패 시 `false`로 처리한다.
3. 각 플래그의 SSR DOM과 hydration 후 DOM을 검사한 뒤 H-04를 닫는다.
4. `next`와 연동 패키지를 16.2.12 이상 호환 patch로 올리고 production audit·build·test를 실행한다.
5. `typecheck` 고정 명령과 27건 baseline을 만들고 신규 오류 0을 CI에 적용한다. 공식 Cloudflare type 경로를 적용한 뒤 실제 감소량으로 baseline을 갱신한다.
6. `DEPLOY-01a`의 placeholder·secret fail-fast 검사와 로컬 D1 binding test harness를 시작한다.
7. Kakao import는 기본 off로 배포하고 fragment 보존·POST 교환·Fetch Metadata 호환성이 입증된 환경에서만 켠다.
8. OCR 자동확정과 검수되지 않은 절감액 저장을 임시 중지한다.
9. 보안 header 공통 helper를 Worker response 경계에 추가한다. CSP는 현재 CDN 의존을 반영한 Report-Only로 시작한다.

#### 단계 0 기능 플래그

| 플래그 | 기본값 | 차단 범위 | 허용 조건 |
|---|---|---|---|
| `MONETIZATION_ENABLED` | `false` | AdSense loader·`ins` slot·실제 affiliate-tracked URL·관련 수익 고지 | H-04, H-10, 이미지 권리와 표시정책 Gate 완료 |
| `KAKAO_IMPORT_ENABLED` | `false` | skill의 import link 생성, landing 소비, import API | M-16·M-01·M-17·L-15와 fragment/WebView Gate 완료 |
| `ALCOHOL_COMMERCE_ENABLED` | `false` | 주류 판매처·구매·제휴 목적 외부 링크와 금전 추천 CTA | H-08 법률검토·경고·표시정책 승인 |
| `TELEMETRY_ENABLED` | `false` | 비필수 remote analytics와 사용자 행동 telemetry | 수집명세·방침·위탁·보유기간 승인 |

일반 쿠팡 검색 URL처럼 affiliate 식별자나 수익 귀속이 없는 중립 외부 링크는 `MONETIZATION_ENABLED=false`만으로 자동 삭제하지 않는다. 링크의 실제 수익화 여부를 URL과 계약으로 판정하며, 수익화 링크라면 요소 자체와 고지를 함께 차단한다.

### 단계 1 — 금액·데이터·Kakao 정확성을 green gate로 만든다

목표 기간: 단계 0 종료 후 1~2주.

- `BUILD-01`의 type 오류를 0으로 만들고 baseline 파일을 삭제한다.
- ComparableOffer 12건은 `PublishedOffer`를 명시적 `ComparableOffer` view로 매핑하거나 금액 필드 명명을 통일해 `pricing.ts`의 tiebreak 행위를 보존한다. 이 12건은 runtime validator 대상이 아니다.
- `DEPLOY-01a`의 local/CI D1 harness를 완료한 뒤 DATA migration·snapshot·복구를 수행한다.
- `PRICE-01`, `DATA-01`, `OCR-01a/b/c`, `TRUST-01`, `KAKAO-REL-01`, `UX-01b0`, `UX-01c0`을 완료한다.
- Tesseract worker/core/lang을 자체 hosting으로 옮긴 뒤 CSP에서 jsdelivr를 제거하고 enforce 전환한다.
- Kakao fragment가 `webLinkUrl`, 인앱 브라우저, 링크 wrapping에서 보존되는지 실측한다. 실패하면 기능을 계속 off로 유지하고 별도 교환 landing을 설계한다.

### 단계 2 — 배포·신뢰경계·계약을 운영 증거로 닫는다

목표 기간: 단계 1 종료 후 1~2주.

- `DEPLOY-01b` clean project에서 해당 commit의 **최신 migration 전체**를 적용한다. 번호를 0000~0002로 고정하지 않는다.
- `AUTH-01`의 Sites header 처리 규약 또는 위조 요청 차단 증거를 확보한다. 증거가 없으면 독립 서명 세션을 사용한다.
- `POLICY-01`의 freshness·variant·stock·condition schema와 backfill을 완료한다. currency migration은 PRICE-01 산출물을 재사용한다.
- `ENV-01b` canonical host와 image request 정책을 운영 E2E로 검증한다.
- 단계 3에서 DTO가 바뀐 뒤에도 typecheck와 통합 테스트를 다시 실행하도록 재검증 Gate를 설정한다.

### 단계 3 — 법무·접근성·문서·운영 인수

목표 기간: 단계 2 종료 후 1~2주. 외부 법무·플랫폼 확인 지연은 기능별 Gate로 남긴다.

- `LEGAL-01`, `UX-01a`, `UX-01b1`, `UX-01c1`, `DOCS-01`을 완료한다.
- 개인정보 법정 checklist, 처리자·수탁자·국외이전 inventory, 이미지 권리대장, 주류·광고 승인 기록을 보관한다.
- 운영 owner, rollback, kill switch, SLO, 경보와 on-call 절차를 확정한다.
- 감사인에게 73개 항목의 코드·테스트·운영 증거를 제출해 재검증을 받는다.

## 10. 프로그램별 산출물과 종료 조건

### OCR-01 — 잘못된 자동확정 0건

- parser는 할부금·우편번호·주문번호·전화번호·다상품·다수량·기본 용량·할인 이중차감 corpus에서 정확하거나 `확인 필요`를 반환한다.
- 신뢰도 수치와 무관하게 잘못된 자동확정은 0건이어야 한다.
- corpus는 합성 데이터와 사용권이 있는 운영자 캡처만 사용한다. 사용자 캡처와 인식 원문을 수집하지 않는다.
- 각 field에 `recognized/defaulted/edited/unknown`을 기록하고 미인식 product는 null로 유지한다.
- Tesseract 자산은 자체 hosting하며 CDN 차단 상태에서도 수동입력이 작동한다.

### DATA-01 — draft가 승인 상품을 바꾸지 않고 기존 영향을 복구

- offer insert는 기존 product를 수정하지 않는다. 상품 편집은 별도 승인 API와 event history를 사용한다.
- migration 전 D1 snapshot을 확보하고 변조 가능 행 식별 query, 영향 범위, 원복 가능 여부, 재검수 queue를 만든다.
- 이력이 없어 원본을 확정할 수 없는 행은 자동 복원하지 않고 비공개·재검수 상태로 이동한다.
- malformed 공개 행은 행 단위로 격리하며 feed 전체를 503으로 만들지 않는다.

### PRICE-01 — 구매 불가능한 금액을 절감액으로 저장하지 않음

- `실제 결제액`, `단위가`, `동일 용량 환산 가치`, `저장 가능한 절감액`을 별도 field와 type으로 정의한다.
- 저장 절감액은 사용자가 실제 구매 가능한 두 대안의 결제액 차이만 허용한다.
- 서로 다른 unit과 currency 비교를 기본 거부한다. 기본 추천은 KRW만 허용한다.
- currency column 추가, 기존 행 backfill, 미확정 행 제외 migration의 단일 소유자는 PRICE-01이다.
- M-14a로 추출한 순수 함수 단위 테스트에서 주류 환산가가 `SavedPick.amount`로 유입되지 않아야 한다.

### TRUST-01 — 추천 모드를 계산·표시·저장까지 분리

- 기본 추천은 승인·검수 데이터만 사용한다.
- 사용자 입력이 생기면 `내 입력 포함 비교`를 명시적으로 선택하게 하고 결과마다 provenance를 보존한다.
- `savedPicks`에 schema version, 비교 모드, 선택 offer provenance, 결제액·환산가 구분을 저장한다.
- 기존 저장값은 `legacy-unknown`으로 migration하고 검수 결과로 재표시하지 않는다.

### BUILD-01 — 재현 가능한 type·dependency·CI Gate

- typecheck 명령은 `tsc --noEmit --incremental false --pretty false`로 고정한다. 존재하지 않는 generated type include는 생성 pre-step을 두거나 설정에서 제거한다.
- 단계 0에는 파일·오류코드 baseline을 사용해 신규 오류 0을 막고, 단계 1 종료 시 오류 0과 baseline 삭제를 요구한다.
- API payload와 Cloudflare binding은 runtime validator 또는 통합 테스트로 보호한다. ComparableOffer 내부 view 매핑에는 불필요한 runtime validator를 강제하지 않는다.
- CI는 build를 중복 실행하지 않는다. `lint → typecheck → test`를 기본으로 하고 `test`의 build 포함 여부를 script 구조에서 하나로 정한다.
- production audit high·critical은 0이거나 잔여 항목마다 도달 가능성, 보완통제, 승인자, 만료일이 있어야 한다.

### ENV-01 — 기능 flag와 실제 DOM이 일치

- server wrapper가 runtime 설정을 명시 props로 전달하며 client module이 직접 env를 읽지 않는다.
- flag off이면 SSR과 hydration 후 DOM 모두에서 대상 script·slot·수익화 링크가 없다.
- flag 적용이 deploy-time이면 최대 적용시간과 rollback 명령을, request-time이면 cache·isolate 영향을 운영 runbook에 기록한다.
- canonical URL은 요청 Host가 아니라 검증된 origin을 사용한다.

### KAKAO-SEC-01 — 서버 URL과 로그에 token·장기 secret 없음

- 장기 skill secret, URL 암호키, user hash pepper를 분리·회전한다.
- landing은 fragment를 사용하고 교환 API는 POST body로 token을 받는다. `GET ?token=`은 제거한다.
- `Sec-Fetch-*`와 Origin은 호환성을 실측한 보조 방어로 사용하며 token 자체의 entropy·1회성·TTL을 대체하지 않는다.
- 서버 요청 URL·edge/origin log·오류 추적·분석 이벤트에 원문 token이 없다.
- fragment가 browser history와 Kakao 대화방에 TTL 동안 남을 수 있음을 잔여 위험으로 기록하고 승인자를 지정한다.
- 현재 코드가 이미 만족하는 2회 소비 410은 신규 완료가 아니라 회귀 방어다. 만료 token이 복호화·외부 fetch 전 410인 테스트를 추가한다.
- 공통 security header의 단일 소유자는 KAKAO-SEC-01이다. Worker의 image 분기와 app handler 응답 모두 같은 helper를 통과한다.

### KAKAO-REL-01 — 실패·다중 이미지·quota를 예측 가능하게 처리

- transient 외부 fetch 실패는 bounded retry 또는 성공 후 소비 원칙으로 처리한다.
- 여러 이미지는 모두 처리하거나 첫 장만 지원함을 skill 단계에서 명시적으로 거부·안내한다.
- cleanup과 quota는 동시 요청에서도 상한을 지킨다.
- 운영 origin은 canonical 설정을 사용한다.

### POLICY-01 — validator·DB·API·UI가 같은 계약 사용

- freshness, variant, stock, condition 규칙을 단일 schema와 정책 함수로 관리한다.
- 기존 행 backfill과 미확정 행 추천 제외 기준을 포함한다.
- PRICE-01이 만든 currency migration을 소비하며 별도 currency migration을 중복 생성하지 않는다.
- migration·schema·runtime SQL의 drift test를 둔다.

### AUTH-01 — 신뢰된 assertion만 관리자 권한 부여

- 공식 Sites 규약 또는 실제 위조 차단 증거를 확보한다.
- 증거가 없으면 서명된 edge assertion 또는 독립 인증 세션으로 전환한다.
- 신뢰 header를 대체 수단 없이 Worker에서 무조건 삭제하지 않는다.
- 권한 없는 요청은 이메일 존재 여부와 관계없이 균일하게 거부한다.

### LEGAL-01 — 활성 기능과 승인 증거가 일치

- 개인정보보호법 필수항목 checklist, 책임자·권리행사·파기·보유기간을 보완한다.
- Cloudflare, OpenAI Sites, Kakao, Google의 처리자 역할·항목·지역·보유기간을 inventory로 만든다.
- 주류 상거래·제휴 링크, CMP 대상 광고, 브랜드 이미지는 법무·권리 확인 전 기능별 flag로 비활성화한다.
- 각 Gate에 승인자, 승인일, 재검토일, 근거 문서를 남긴다.

### UX-01 — 단계 1 테스트 경계와 단계 3 품질 개선을 분리

- UX-01c0은 가격 선택·OCR state·verdict 계산을 순수모듈로 추출한다.
- UX-01c1은 정적 섹션과 대형 component를 나누되 단계 1 함수를 다시 합치지 않는다.
- modal focus, search outline, accessible name, anchor를 키보드로 검증한다.
- stale state, storage 예외, 저장시각, remount 회귀 테스트를 둔다.

### DEPLOY-01 — repo 경로와 실제 cold-start를 모두 증명

- 단계 0~1에 migrate/verify script, placeholder database ID·필수 secret fail-fast, 로컬·CI D1 binding harness를 만든다.
- 단계 2에 clean project를 만들고 해당 commit의 migration manifest 전체를 적용한다.
- migration version, checksum, 대상 DB, 적용 시각, 실행 주체, rollback 또는 forward-fix 결과를 보관한다.
- Sites 제어면이 적용 주체여도 같은 수준의 재현 가능한 절차와 증거를 요구한다.

### DOCS-01 — crawl·env·import 설명을 실제와 일치

- robots는 보안 경계와 분리하고 비공개·admin 경로의 crawl 정책과 sitemap 수정일을 정리한다.
- README와 `.env.example`에는 실제 사용 중인 flag·slot·Kakao 흐름만 남긴다.
- 사용하지 않는 `NEXT_PUBLIC_ADSENSE_SLOT_HOME_TOP`은 제거하거나 실제 배선과 테스트를 추가한다.

## 11. Kakao token 보안 설계와 잔여 위험

### 11.1 목표 흐름

1. skill route는 import가 활성화된 경우에만 `/#kakao_import=<token>` 링크를 반환한다.
2. client는 fragment를 읽어 즉시 현재 history entry에서 제거한다.
3. token은 `POST /api/kakao/import` JSON body로 전송한다.
4. API는 token 형식·TTL·1회성, content type, Fetch Metadata를 검증한다.
5. client는 fragment anchor에 의존하지 않고 import modal을 열거나 `#my-comparisons`로 명시적으로 scroll한다.
6. 사용 성공·만료·오류 후 원문 token을 telemetry와 오류 메시지에 포함하지 않는다.

### 11.2 완료 기준과 잔여 위험 분리

| 영역 | 완료 기준 | 잔여 위험·통제 |
|---|---|---|
| 서버 요청 | landing query·API query·access log에 token 없음 | POST body logging을 비활성·마스킹 |
| 브라우저 | 정상 JavaScript 경로에서 fragment 즉시 제거 | JS 실패 시 history에 TTL 동안 남음; 120초 목표, 최대 5분 예외 승인 |
| Kakao 대화방 | 서버가 대화방 원문을 제거할 수 없음 | 고엔트로피·1회 token·짧은 TTL로 제한 |
| 인앱 브라우저 | fragment 보존과 `Sec-Fetch-*` 지원 실측 | 미지원이면 기능 off 또는 별도 교환 landing |
| 재사용 | 두 번째 소비 410 | 기존 동작을 회귀 테스트로 유지 |
| 만료 | 복호화·외부 fetch 전 410 | 만료 경로 test 추가 |

## 12. 수익화·주류 링크 Gate

`MONETIZATION_ENABLED`는 수익 발생 여부를, `ALCOHOL_COMMERCE_ENABLED`는 주류 상거래·광고 위험을 제어한다. 두 플래그는 합치지 않는다.

### 12.1 수익화 off 검증 지점

- `app/layout.tsx`의 AdSense loader script
- `AdSlot`의 `ins.adsbygoogle`과 `adsbygoogle.push`
- page의 모든 AdSlot render point
- 실제 affiliate tracking URL과 `rel=sponsored`
- affiliate disclosure
- `.env.example`의 사용 중인 slot 목록

현재 단순 쿠팡 검색 URL은 affiliate tracking 여부를 계약·URL로 먼저 판정한다. 비수익 링크로 유지하면 sponsored·수익 고지를 붙이지 않으며, 수익 링크로 전환하는 순간 요소 자체가 flag 뒤로 이동해야 한다.

### 12.2 주류 Gate

- 가격 evidence를 위한 중립 출처 표시는 법무가 허용한 범위에서 유지할 수 있다.
- 구매·예약·제휴 목적 CTA와 retailer 이동 링크는 승인 전 렌더하지 않는다.
- 교육 콘텐츠와 상거래 CTA를 DOM·문구·분석에서 구분한다.

## 13. 개인정보 친화적 검증·모니터링

### 13.1 수집 명세

| 지표 | 수집값 | 저장 위치 | 원격 전송 | 보유기간 | 선행조건 |
|---|---|---|---|---|---|
| verified feed 오류 | status·제외 행 수·오류 category | server aggregate | 예 | 30일 | 개인정보 없는 category log |
| OCR 수정 여부 | field별 `edited: true/false`, 원문·값 없음 | 기본은 기기 memory | 기본 아니오 | session | 합성·운영자 corpus만 회귀 저장 |
| OCR 품질 원격 집계 | 비식별 count만 | telemetry store | flag on일 때만 | 30일 | H-09/A-09 검토·방침 반영 |
| Kakao import | 생성·성공·410·외부 fetch 실패 aggregate | server counter | 예 | 30일 | token hash·bot hash를 counter에 보존하지 않음 |
| D1 migration | version·checksum·deployment ID·결과 | 운영 증거 | 예 | 1년 | 운영 접근통제 |
| 수익화·주류 flag | E2E의 script·slot·외부 CTA count | CI artifact | 아니오 | 90일 | 배포 전 Gate |

`잘못된 자동확정 1건`은 production 사용자 원문 수집으로 판정하지 않는다. 합성·운영자 corpus의 expected value와 비교하고, production에서는 값 없는 field별 수정 boolean을 보조 신호로만 사용한다. 중복 소비와 만료를 식별 가능한 token tombstone 없이 구분할 수 없다면 둘을 합친 410 aggregate로 모니터링한다.

### 13.2 초기 경보

| 대상 | 초기 경보 | 대응 |
|---|---|---|
| verified feed | 15분 내 503 1건 또는 제외 행 증가 | 문제 행 격리·추천 저하 |
| OCR corpus | 잘못된 자동확정 1건 | 자동확정 중지·corpus 추가 |
| Kakao import | 410·외부 fetch 실패 급증 또는 성공률 기준선 하회 | 기능 off·rate limit·외부 의존 조사 |
| D1 migration | 목표 manifest checksum 불일치 1건 | 배포 중단·forward-fix/rollback |
| 수익화·주류 | Gate 미완료 환경에서 대상 DOM 1개 | 관련 flag off·배포 차단 |

성공률의 수치 임계값은 첫 1주 baseline 뒤 확정한다. 금액 오확정, migration 불일치, Gate 우회는 1건도 허용하지 않는다.

## 14. 자동·통합·운영 검증 계획

선행 답변서의 회귀군은 전부 승계하며 다음과 같이 확정한다.

### 14.1 OCR 회귀군

- 할부금, 우편번호, 주문번호, **전화번호**, 다상품, 다수량, 기본 용량 대체, 할인 이중차감
- 미인식 product null, 주류 catalog 분리, 판매처 block 충돌
- corpus 경로를 `tests/fixtures/ocr/` 또는 동등한 고정 경로로 두고 expected 결과를 version 관리

### 14.2 가격·출처 회귀군

- mixed unit, mixed currency, 동률 경계, 쿠팡 허용오차, freshness 경계
- 실제 결제액과 환산가 분리, 구매 불가능한 절감액 저장 거부
- 기본 추천과 내 입력 포함 비교의 대표가격·판매처 수·headline·savedPicks provenance

### 14.3 데이터·D1 회귀군

- draft 생성 전후 기존 product·approved offer DTO 불변
- malformed row 격리와 review history 보존
- local D1 migration, schema version, binding 주입, 기존 영향 데이터 복구·재검수

### 14.4 환경·렌더 회귀군

- 네 flag의 on/off SSR DOM과 hydration DOM 일치
- AdSense script·slot·실제 affiliate URL·고지의 동시 제어
- canonical host 위조, image optimizer 요청, 주류 상거래 CTA Gate

### 14.5 Kakao 회귀군

- fragment 보존, POST body, GET query 제거, HTTPS-only, key 분리
- transient retry, 다중 이미지, cleanup, quota concurrency
- 정상 소비·두 번째 410·만료 pre-decrypt 410·flag off의 skill/landing/API 응답

### 14.6 관리자·배포 회귀군

- forged admin header와 미인증 요청의 균일 거부
- clean project D1 cold-start와 해당 commit 최신 migration 적용
- placeholder·필수 secret fail-fast, 운영 proof bundle 생성

### 14.7 CI 명령 구조

```text
npm run lint
npm run typecheck
npm test
```

`npm test`가 build를 포함하면 별도 `npm run build`를 다시 실행하지 않는다. unit test와 build를 분리할 경우 CI에서 각각 한 번만 실행한다. 단계 0에는 `typecheck:baseline`, 단계 1 이후에는 strict `typecheck`를 사용한다.

## 15. 기존 데이터 복구

1. 운영 DB snapshot과 migration manifest를 확보한다.
2. approved product의 name/category/unit/active 상태를 승인 source 또는 seed와 비교한다.
3. draft 충돌 이후 변경된 가능성이 있는 행과 연관 offer를 식별한다.
4. 신뢰할 원본이 있으면 복구 migration을 적용하고, 없으면 product와 offer를 비공개·재검수 queue로 이동한다.
5. 기존 savedPicks는 schema version이 없으면 `legacy-unknown`으로 변환하고 검수·절감액 표시를 제거한다.
6. 영향 행 수, 복구 수, 재검수 수, 폐기 수와 승인자를 증거로 남긴다.

## 16. 운영 소유권·rollback·감사인 재검증

저장소만으로 개인 이름을 확정할 수 없으므로 임의로 기재하지 않는다. 각 실행 티켓은 시작 전에 다음을 가져야 한다.

- accountable owner 개인 1명과 reviewer 개인 1명
- 원문 ID, 상위 프로그램, 하위 stream, 우선순위, 단계
- 착수일·목표일·Gate 재검토일
- 변경 범위, feature flag, rollback/forward-fix 명령과 최대 적용시간
- 자동 테스트·운영 증거·감사인 재검증 링크

감사인은 P0, Gate, severity 변경 항목과 표본 P1/P2를 재검증한다. 재현 실패 또는 증거 부족이면 항목을 reopen한다. 잔여 위험 승인에는 제품 책임자와 관련 보안·법무 승인자, 승인 만료일이 필요하다.

## 17. 최종 수용 기준

다음 조건을 모두 만족해야 1차 개선 라운드를 종료한다.

- 73개 원문 항목이 하나의 상위 프로그램, 하나의 하위 실행 stream, 실행 티켓과 연결되어 있다.
- P0·Gate가 완료되거나 해당 기능이 독립 server flag로 비활성화되어 있다.
- typecheck·lint·test·build가 clean checkout CI에서 중복 없이 통과하고 baseline 파일이 없다.
- production audit high·critical이 0이거나 잔여 항목에 도달 가능성, 보완통제, 승인자, 만료일이 있다.
- OCR corpus에서 잘못된 자동확정이 0건이고 모호한 입력은 확인 단계로 실패-폐쇄된다.
- draft 생성 전후 승인 상품 DTO가 불변이며 기존 영향 데이터가 복구 또는 재검수됐다.
- **실제 결제액, 단위가, 동일 용량 환산 가치, 저장 가능한 절감액이 UI·저장 schema·문서에서 일치하고, 구매 불가능한 환산 금액이 원화 절감액으로 저장되지 않는다.**
- 기본 추천과 내 입력 포함 비교가 계산·headline·표·판매처 수·savedPicks provenance에서 일치한다.
- Kakao landing·교환 API·서버 로그에 원문 token이나 장기 secret이 없고 client/chat 잔여 위험이 승인됐다.
- D1 cold-start가 해당 commit의 최신 migration manifest 전체로 재현되고 proof bundle이 보관된다.
- 법무·개인정보·이미지 권리 checklist와 실제 활성 기능이 일치한다.
- 운영 owner·기한·rollback·kill switch·모니터링·경보 경로가 지정됐다.
- 감사인이 P0·Gate·재분류 항목을 재검증하고 잔여 위험을 명시적으로 승인했다.

## 18. 제한사항과 남은 확인사항

1. OpenAI Sites가 외부 `oai-authenticated-*` header를 제거하는지 공식 증거가 없다.
2. `next@16.2.12`는 npm 수정 후보이며 이 작업본에 아직 설치하지 않았다.
3. Kakao `webLinkUrl`·인앱 브라우저·링크 wrapping의 fragment 보존과 `Sec-Fetch-*` 지원을 실측하지 않았다.
4. 120초 TTL이 Kakao 사용자 흐름에 충분한지 측정하지 않았다. 최대 5분 예외는 보안 승인 대상이다.
5. D1 cold-start와 Sites 제어면 migration 적용은 새 프로젝트 배포 전에는 완료로 판정할 수 없다.
6. H-02의 최종 제품 정책과 mixed mode ranking은 제품 책임자의 명시적 승인이 필요하다.
7. 개인정보·광고·주류·이미지 판단은 법률의견이 아니다.
8. 성능·확장성 R-02·R-03은 실측 데이터와 owner가 없으며 별도 PERF-01 관찰 티켓이 필요하다.

## 19. 문서 거버넌스

- 본 문서는 선행 답변서 v1.0과 재답변서 v1.0을 실행 기준에서 대체한다.
- 원 감사와 재검토 의견서는 변경하지 않고 근거 이력으로 보존한다.
- 본 문서가 제품 책임자·감사인에게 채택된 뒤 세 문서를 함께 version 관리한다.
- 구현 중 판정·우선순위·프로그램 소유권이 바뀌면 본 문서 version을 올리고 변경 사유와 승인자를 기록한다.

## 참고 근거

- `docs/AUDIT_RESPONSE_2026-08-01.md`
- `docs/AUDIT_REVIEW_REPLY_2026-08-01.md`
- 감사인 재검토 의견서 v1.0·v2.0
- `app/page.tsx`, `app/layout.tsx`, `app/components/ad-slot.tsx`
- `app/api/kakao/skill/route.ts`, `app/api/kakao/import/route.ts`, `app/lib/kakao-import.ts`
- `app/lib/pricing.ts`, `app/lib/offer-input.ts`, `app/lib/price-store.ts`
- `worker/index.ts`, `db/`, `drizzle/`, `tests/`
- `README.md`, `docs/PRICE_DATA_CONTRACT.md`, `app/privacy/page.tsx`
- `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `.env.example`, `.openai/hosting.json`
- `npm audit --omit=dev --json`, 2026-08-01 독립 실행
- `tsc --noEmit --incremental false --pretty false`, 2026-08-01 독립 실행

