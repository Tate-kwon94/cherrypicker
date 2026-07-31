# 체리피커 · CHERRY PICKER

가격은 비교하고, 좋은 것만 고르세요. 면세점과 국내 리테일 상품을 최종
결제가와 단위가격 기준으로 비교하는 한국어 가격 가이드입니다. 현재 기본 상품
가격은 비교 방식을 설명하기 위한 예시이며, 사용자가 직접 입력한 결제 화면
가격은 해당 브라우저에만 저장됩니다.

## 현재 제공하는 기능

- 화장품의 상품가, 배송비, 할인, 용량을 반영한 실결제가 비교
- 서로 다른 용량을 `ml`, `g`, `개` 단위로 환산
- 사용자 확인 가격 등록과 브라우저 로컬 저장
- 위스키 예시 가격 및 취향별 추천 방식 안내
- 화장품·위스키 가격 가이드와 서비스 정책 페이지
- 선택적 AdSense 광고 슬롯과 외부 판매처 검색 링크

자동 가격 수집, 서버 저장, 계정, 실제 가격 알림은 아직 제공하지 않습니다.

## 기술 구성

- Next.js 16 / React 19 / TypeScript
- vinext / Vite / Cloudflare Workers
- Tailwind CSS
- 선택적 Cloudflare D1 / Drizzle
- OpenAI Sites 호스팅 설정

Node.js 22.13 이상이 필요합니다.

## 로컬 실행

```bash
npm install
npm run dev
```

검증 명령:

```bash
npm run lint
npm test
npm run build
```

## 환경변수

환경변수는 커밋하지 않는 `.env.local` 등에 설정합니다.

```bash
NEXT_PUBLIC_SITE_URL=https://example.com
NEXT_PUBLIC_ADSENSE_CLIENT=ca-pub-...
NEXT_PUBLIC_ADSENSE_SLOT_HOME_TOP=...
NEXT_PUBLIC_ADSENSE_SLOT_HOME_CONTENT=...
```

`NEXT_PUBLIC_SITE_URL`이 없으면 메타데이터, robots, sitemap은 현재 요청의
호스트를 기준으로 URL을 생성합니다. AdSense 값이 없으면 광고 영역을
렌더링하지 않습니다.

## 프로젝트 구조

- `app/page.tsx`: 메인 비교 화면과 사용자 가격 등록
- `app/lib/pricing.ts`: 가격 검증, 단위가격, 동일 용량 비교 로직
- `app/guides/`: 정적 가격 가이드
- `app/components/`: 공통 페이지와 광고 컴포넌트
- `db/`: 향후 D1 데이터 모델
- `tests/`: 가격 로직과 서버 렌더링 검증
- `.openai/hosting.json`: Sites 프로젝트 및 저장소 바인딩

## 데이터 운영 원칙

실서비스 가격에는 판매처, 원본 URL, 상품 구성, 적용 조건, 확인 시각이
반드시 포함되어야 합니다. 승인된 API·제휴 피드 또는 운영자가 검수한 데이터만
기본 추천에 사용하고, 사용자 직접 입력 가격과 명확하게 구분합니다.

제품 이미지의 현재 출처와 제작 시점은 `IMAGE_SOURCES.md`에 기록되어 있습니다.
상업 운영 전에는 승인된 제휴 API, 판매처 피드 또는 사용 권한이 확인된 미디어로
교체해야 합니다.

## 다음 단계

1. 초기 운영 상품군과 데이터 갱신 책임을 확정합니다.
2. D1에 상품, 판매처, 가격 관측값과 조건 이력을 저장합니다.
3. 승인된 가격 소스를 연결하고 만료된 가격을 자동으로 숨깁니다.
4. 실제 서버 알림이 준비된 뒤 계정과 가격 알림을 활성화합니다.
