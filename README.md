# 체리피커 · CHERRY PICKER

가격은 비교하고, 좋은 것만 픽하세요. 면세점과 국내 리테일 상품을 최종
결제가와 단위가격 기준으로 비교하는 한국어 가격 가이드입니다. 공개 비교는
운영자가 검수한 가격이 면세·국내 양쪽에 있고 단위·통화·상품 규격 계약을
통과할 때만 만들어집니다. 사용자가 직접 입력한 가격은 현재 비교에만 쓰이며
공개 결론의 근거가 되지 않습니다.

## 현재 제공하는 기능

- 화장품의 상품가, 배송비, 할인, 용량을 반영한 실결제가 비교
- 서로 다른 용량을 `ml`, `g`, `개` 단위로 환산
- 상품 검색과 장바구니 캡처 진입을 합친 첫 화면
- 브라우저 OCR로 상품·판매처·가격·용량을 자동 입력하는 캡처 파일럿
- 카카오 보안이미지를 최대 10분·1회 사용 링크로 내 비교함에 연결
- 운영자 전용 검수 가격 등록·승인과 D1 영구 저장
- 화장품 10개·주류 5개 파일럿 상품과 면세 2곳·국내 2곳 커버리지 현황
- 롯데·신라·신세계·현대 및 국내 판매처 표준화와 다중 판매처 최저가 선택
- 최신 가격은 체리픽에 사용하고 오래된 값은 참고가격으로 구분하는 가격 피드
- 검수 가격이 없으면 결론·절약액을 만들지 않고 준비 중 상태를 유지
- 검수 가격이 양쪽 채널에 있으면 실제 다중 판매처 최저가를 추천에 반영
- 질문 없이 `체리픽`과 대안을 동시에 보여주는 즉시 결론
- 사용자가 명시적으로 저장한 비교 결과만 보관하는 `내 비교함`
- 위스키 취향별 추천 방식 안내
- 화장품·위스키 가격 비교법과 여행 쇼핑 준비 가이드
- 선택적 AdSense 광고 슬롯과 외부 판매처 검색 링크

자동 가격 수집, 일반 사용자 계정, 실제 가격 알림은 아직 제공하지 않습니다.

## 기술 구성

- Next.js 16 / React 19 / TypeScript
- vinext / Vite / Cloudflare Workers
- Tailwind CSS
- 선택적 Cloudflare D1 / Drizzle
- OpenAI Sites 호스팅 설정
- Tesseract.js 브라우저 OCR

Node.js 22.13 이상이 필요합니다.

## 로컬 실행

```bash
npm install
npm run dev
```

검증 명령:

```bash
npm run verify
```

`lint → typecheck → check:types → check:config → test → check:config:post`를
차례로 실행합니다. `npm test`가 빌드를 포함하므로 빌드를 중복 실행하지 않습니다.

## 환경변수

환경변수는 커밋하지 않는 `.env.local` 등에 설정합니다.

```bash
NEXT_PUBLIC_SITE_URL=https://example.com
ADMIN_EMAILS=admin@example.com
KAKAO_SKILL_TOKEN=replace-with-a-long-random-secret
KAKAO_URL_ENCRYPTION_KEY=replace-with-a-different-long-random-secret
KAKAO_USER_HASH_PEPPER=replace-with-a-third-long-random-secret

# 기능 플래그 — 서버에서 요청 시점에 읽습니다. 기본값은 모두 꺼짐입니다.
MONETIZATION_ENABLED=false
KAKAO_IMPORT_ENABLED=false
ALCOHOL_COMMERCE_ENABLED=false
TELEMETRY_ENABLED=false
AUTO_CONFIRM_ENABLED=false
ADMIN_UI_ENABLED=false

ADSENSE_CLIENT=ca-pub-...
ADSENSE_SLOT_HOME_CONTENT=...
```

`NEXT_PUBLIC_SITE_URL`이 없으면 메타데이터, robots, sitemap은 현재 요청의
호스트를 기준으로 URL을 생성합니다. `ADMIN_EMAILS`에는 `/admin` 가격 운영
화면에 접근할 ChatGPT 계정 이메일을 쉼표로 구분해 설정합니다.
카카오 임포트는 **서로 다른 세 개의 비밀값**을 씁니다. 하나라도 없거나 둘이
같은 값이면 기능이 열리지 않습니다 — 인증 토큰 하나가 유출됐을 때 저장된
URL 복호화와 사용자 해시 역산까지 함께 열리는 것을 막기 위해서입니다.
`KAKAO_SKILL_TOKEN`은 `x-cherrypicker-skill-token` **헤더로만** 전달하며
쿼리스트링에 싣지 않습니다. `KAKAO_URL_ENCRYPTION_KEY`를 회전하면 아직 열지
않은 링크는 만료되므로, 회전 후 한 TTL(10분)만 기다리면 영향이 사라집니다.

여섯 개 기능 플래그는 모두 **fail-closed**입니다. 값이 없거나, 오타이거나,
`"true"`가 아니면 꺼진 상태입니다. `NEXT_PUBLIC_*` 접두사는 이 용도로 쓸 수
없습니다 — 빌드 산출물에 값이 고정되고 클라이언트 번들에서는 `{}`로
컴파일돼, 배포 후 기능을 끄는 수단이 되지 못합니다. AdSense 값은
`MONETIZATION_ENABLED`가 정확히 `"true"`일 때만 읽습니다.

## 프로젝트 구조

- `app/page.tsx`: 서버 경계 — 요청 시점에 기능 플래그를 읽어 전달
- `app/page-client.tsx`: 메인 비교 화면과 사용자 가격 등록
- `app/lib/runtime-flags.ts`: fail-closed 기능 플래그 판독
- `app/lib/saved-picks.ts`: 내 비교함 저장 모델(schema v1)
- `app/lib/pricing.ts`: 가격 검증, 단위가격, 동일 용량 비교 로직
- `app/guides/`: 정적 가격 가이드
- `app/components/`: 공통 페이지와 광고 컴포넌트
- `app/admin/`: 운영자 전용 가격 등록·검수 화면
- `app/api/`: 검수 가격 공개·관리 API
- `db/`: D1 상품·가격 관측 데이터 모델
- `tests/`: 가격 로직과 서버 렌더링 검증
- `docs/LIQUOR_PRICE_VERIFICATION.md`: 주류 100ml 단가 비교와 가격 증거 기준
- `docs/PILOT_AND_FULL_CATALOG.md`: 파일럿 운영과 전수 상품 확장 계획
- `.openai/hosting.json`: Sites 프로젝트 및 저장소 바인딩

## 데이터 운영 원칙

실서비스 가격에는 판매처, 원본 URL, 상품 구성, 적용 조건, 확인 시각이
반드시 포함되어야 합니다. 승인된 API·제휴 피드 또는 운영자가 검수한 데이터만
기본 추천에 사용하고, 사용자 직접 입력 가격과 명확하게 구분합니다.

제품 이미지의 현재 출처와 제작 시점은 `IMAGE_SOURCES.md`에 기록되어 있습니다.
상업 운영 전에는 승인된 제휴 API, 판매처 피드 또는 사용 권한이 확인된 미디어로
교체해야 합니다.

## 다음 단계

1. 운영 시드 15개에 대해 4대 온라인 면세점과 국내 판매처의 실제 가격을 최소 60개 확보합니다.
2. 화장품 70개·주류 30개의 공개 파일럿 카탈로그와 골드 상품 30개를 완성합니다.
3. 카카오 채널 관리자에서 보안이미지 플러그인과 체리피커 스킬을 연결합니다.
4. 승인된 제휴 API·가격 피드를 연결해 수동 입력을 보조합니다.
5. 소셜 로그인, 내 비교함 동기화, 의미 있는 가격 알림을 순서대로 활성화합니다.
