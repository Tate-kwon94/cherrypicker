-- 통화를 값으로 저장한다. 예전에는 스키마에 통화가 없어 코드가 모든
-- 검수 가격을 KRW 로 단정했고, 그래서 비교 계약의 currency-mismatch 검사가
-- 도달할 수 없었다. 면세점은 USD 로 표시하는 경우가 흔하므로, 그 상태에서
-- USD 면세가와 KRW 국내가를 같은 통화처럼 빼면 결론이 크게 틀린다.
--
-- 기존 행은 전부 KRW 로 등록된 값이므로 DEFAULT 'KRW' 가 정확한 backfill 이다.
ALTER TABLE `price_offers` ADD `currency` text DEFAULT 'KRW' NOT NULL;
