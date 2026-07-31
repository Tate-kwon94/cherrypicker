# 가격 데이터 계약

체리피커의 기본 추천에 사용하는 가격은 아래 필드를 모두 가져야 합니다.
사용자 직접 등록 가격은 브라우저 안에서만 사용하는 보조 데이터이며 기본
추천 데이터와 합쳐 저장하지 않습니다.

## 상품 식별

- `productId`: 내부 상품 ID
- `variantId`: 용량, 수량, 에디션을 구분하는 SKU ID
- `brand`, `name`
- `barcode` 또는 판매처 상품 코드
- `unit`: `ml`, `g`, `개`
- `volume`: 실제 비교에 사용하는 용량 또는 수량

상품명만으로 같은 상품이라고 판단하지 않습니다. 본품, 세트, 증정품,
리뉴얼 전후 상품을 별도 변형으로 관리합니다.

## 가격 관측값

- `retailerId`, `sourceUrl`
- `channel`: `duty` 또는 `retail`
- `listPrice`, `shipping`, `instantDiscount`
- `finalPrice`
- `currency`
- `inStock`
- `observedAt`, `expiresAt`
- `collectionMethod`: 승인 API, 제휴 피드, 운영자 검수

특정 카드, 개인 쿠폰, 회원 등급처럼 모든 사용자가 받을 수 없는 할인은
`finalPrice`에 섞지 않고 조건부 가격으로 분리합니다.

## 판매 조건

- 출국장 수령 여부
- 출국일 또는 터미널 제한
- 회원 등급
- 결제수단
- 최소 구매금액
- 픽업 매장
- 수령 방식: 공항 수령, 국내 배송, 주류매장 픽업, 편의점 픽업
- 지점별 재고와 확인 시각
- 성인 인증 필요 여부

## 추천 포함 기준

다음 중 하나라도 충족하지 못하면 기본 추천에서 제외합니다.

1. 상품 변형이 명확하게 매칭되어야 합니다.
2. 원본 URL과 확인 시각이 있어야 합니다.
3. 최종 가격 계산 요소가 모두 숫자로 검증되어야 합니다.
4. `expiresAt`을 지났거나 품절이면 숨겨야 합니다.
5. 가격 수집 방식이 승인된 운영 정책 안에 있어야 합니다.

## 권장 저장 구조

실제 데이터 소스가 확정되면 D1에 다음 구조를 추가합니다.

- `products`
- `product_variants`
- `retailers`
- `price_observations`
- `offer_conditions`
- `product_matches`

현재 `.openai/hosting.json`은 `DB` 논리 바인딩을 사용합니다. 운영자가
등록한 가격은 `draft` 상태로 시작하고, 검수 후 `approved`가 되어야 공개
대상이 됩니다. `expiresAt`을 지난 가격은 이력에는 남지만 공개 API와 소비자
화면에서 자동으로 제외됩니다.
