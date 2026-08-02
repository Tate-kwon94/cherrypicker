# PR #1 — code_trace

> 대상 commit: 99aa303 · 생성일: 2026-08-02
> 목적: V5-B01(공개 비교 verified-only)·V5-B02(null-safe dataflow)·V5-B11(SavedPick migration)의 적용 지점을 문서가 아닌 코드 실측으로 고정한다.

---

## 공개 비교 파생값 (53건)

| 이름 | 위치 | 종류 | 의존 | 가드 | null 영향 |
|---|---|---|---|---|---|
| `offers` | `app/page.tsx:580` | derived-value | publishedOffers, capturedOffers, product (baseOffers 하드코딩 폴백 포함) | **unguarded** | 체인의 최상단. baseOffers를 제거하면 hasVerifiedComparison이 false이고 사용자 캡처도 없을 때 offers가 빈 배열([])이 되어, 아래 offers[0]/offers[1] 폴백이 모두 undefined가 된다. 현재는 baseOffers 덕분에 항상 길이 2 이상이 보장되고 있다. |
| `trustedCosmeticOffers` | `app/page.tsx:677` | derived-value | offers | **unguarded** | 빈 배열이 될 뿐 예외는 없다. 다만 이 배열이 비면 trustedBestDuty/trustedBestRetail이 undefined가 되어 아래의 offers[0]/offers[1] 폴백 경로가 활성화된다. |
| `trustedBestDuty` | `app/page.tsx:680` | derived-value | trustedCosmeticOffers (selectBestUnitOffer) | **unguarded** | selectBestUnitOffer는 T \| undefined를 반환하므로 그 자체는 안전(undefined). 크래시는 이 값을 소비하는 688행 bestDuty에서 발생한다. |
| `trustedBestRetail` | `app/page.tsx:681` | derived-value | trustedCosmeticOffers (selectDomesticRepresentative) | **unguarded** | selectDomesticRepresentative도 T \| undefined를 반환하므로 자체는 안전. 690행 bestRetail이 이를 offers[1]로 폴백시키면서 문제가 시작된다. |
| `hasTrustedCosmeticsComparison` | `app/page.tsx:685` | derived-value | trustedBestDuty, trustedBestRetail | **unguarded** | Boolean(...)이므로 안전하게 false가 된다. 이것이 화장품 비교 렌더 게이트(1346행)의 실제 조건이다. 문제는 이 게이트가 false여도 688~874행의 파생값들이 이미 계산된 뒤라는 점이다. |
| `bestDuty` | `app/page.tsx:688` | derived-value | trustedBestDuty ?? selectBestUnitOffer(offers,"duty") ?? offers[0] | **unguarded** | 핵심 위험 지점. baseOffers 제거 시 offers가 비면 offers[0]이 undefined → bestDuty가 undefined가 되고, 704행 compareEquivalentVolumes에서 duty.unitPrice 접근으로 TypeError(Cannot read properties of undefined)가 발생해 페이지 전체가 렌더에 실패한다. 또한 offers가 비어 있지 않더라도 offers[0] 폴백은 채널 검사를 하지 않으므로 사용자가 캡처한 retail 오퍼가 '면세 최저가' 자리에 들어가 조용히 잘못된 비교 결과를 만든다. |
| `bestRetail` | `app/page.tsx:690` | derived-value | trustedBestRetail ?? selectDomesticRepresentative(offers) ?? offers[1] | **unguarded** | bestDuty와 동일한 위험. offers.length < 2이면 offers[1]이 undefined가 되어 704행 compareEquivalentVolumes(retail.volume) 및 705행 bestRetail.total에서 TypeError. 또 offers[1] 폴백은 채널·판매처 검증이 없어 duty 오퍼가 '국내 대표가'로 들어갈 수 있다(조용한 오류). |
| `verifiedDutySourceCount` | `app/page.tsx:694` | derived-value | offers (verified && channel==="duty") | **unguarded** | Set 크기이므로 크래시 없이 0이 된다. 다만 1434행·1597행에서 '면세 N곳 비교 최저' 문구를 만드는데, bestDuty가 폴백값일 때 0곳으로 표시되어 근거 문구와 실제 표시 가격의 출처가 어긋난다. |
| `verifiedRetailSourceCount` | `app/page.tsx:699` | derived-value | offers (verified && channel==="retail") | **unguarded** | 크래시 없이 0. 단 1459행에서 normalizeRetailerName(bestRetail.source)와 함께 쓰이므로, bestRetail이 null이면 그 JSX 라인 자체가 TypeError를 낸다(해당 라인은 hasTrustedCosmeticsComparison 게이트 안이라 실제로는 도달하지 않음). |
| `comparison` | `app/page.tsx:704` | derived-value | bestDuty, bestRetail (compareEquivalentVolumes) | **unguarded** | 최초 크래시 지점. compareEquivalentVolumes는 인자 널 체크 없이 duty.unitPrice, retail.volume, retail.unitPrice에 바로 접근한다(app/lib/pricing.ts:121-122). bestDuty 또는 bestRetail이 undefined면 즉시 TypeError가 던져지고, 렌더 게이트(1158행 currentComparisonReady, 1346행 hasTrustedCosmeticsComparison)에 도달하기 전이므로 게이트가 전혀 보호해주지 못한다. 이것이 감사에서 지적한 '베이스 폴백 제거 시 페이지 크래시'의 실체다. |
| `retailPrice` | `app/page.tsx:705` | derived-value | bestRetail.total | **unguarded** | bestRetail이 null이면 프로퍼티 접근에서 TypeError(704행이 먼저 던지지 않는다면). 704행을 널 세이프로 고치면서 여기를 놓치면 이 줄이 새로운 크래시 지점이 된다. |
| `dutyUnit` | `app/page.tsx:706` | derived-value | bestDuty.unitPrice | **unguarded** | bestDuty가 null이면 TypeError. 1450행 `{formatWon(dutyUnit)}/{bestDuty.unit}` 표시에 쓰이며, undefined가 흘러가면 formatWon이 NaN 문자열을 출력한다. |
| `retailUnit` | `app/page.tsx:707` | derived-value | bestRetail.unitPrice | **unguarded** | bestRetail이 null이면 TypeError. 널 세이프로 바꿔 undefined를 허용하면 1474행에서 'NaN원/undefined'가 렌더된다. |
| `dutyEquivalent` | `app/page.tsx:708` | derived-value | comparison.dutyEquivalent | **unguarded** | comparison이 null이 되면 프로퍼티 접근 TypeError. comparison을 옵셔널 체이닝으로만 고치면 undefined가 되어 848행 dutyDecision.price와 1486/1492행 폭 계산에 NaN이 전파된다. |
| `equivalentSavings` | `app/page.tsx:709` | derived-value | comparison.savings | **unguarded** | comparison이 null이면 TypeError. undefined로 흘러가면 778행 decisionDifference가 undefined → 786행 Math.abs(undefined)=NaN → 785행 priceGapIsSmall이 false(NaN<=3000은 false) → 잘못된 승자 판정으로 이어지는 조용한 오류 경로가 생긴다. |
| `dutyWins` | `app/page.tsx:710` | derived-value | comparison.dutyWins | **unguarded** | comparison이 null이면 TypeError. undefined면 1386행에서 항상 '이번에는 배송 리테일 구매' 쪽 문구가 나오는 조용한 오판이 된다. |
| `savingRate` | `app/page.tsx:711` | derived-value | comparison.savingRate | **unguarded** | comparison이 null이면 TypeError. undefined면 1399행이 'undefined% 차이'로 렌더된다. |
| `liquor` | `app/page.tsx:712` | derived-value | liquors[taste] (하드코딩 카탈로그) | **unguarded** | 공개 비교 데이터에 의존하지 않는 하드코딩 상수라 널이 되지 않는다. 그러나 주류 경로의 모든 폴백(729~749행, 770/777행)이 이 하드코딩 값을 참조하므로, 검수 데이터가 없을 때 화장품과 달리 '크래시 대신 하드코딩 가격이 조용히 노출'되는 비대칭이 존재한다. |
| `verifiedLiquorOffers` | `app/page.tsx:713` | derived-value | publishedOffers, liquor.catalogId | **unguarded** | 필터 결과이므로 빈 배열이 될 뿐 크래시 없음. 비면 아래 두 best 값이 undefined가 되고 hasVerifiedLiquorComparison이 false로 떨어진다. |
| `bestVerifiedLiquorDuty` | `app/page.tsx:718` | derived-value | verifiedLiquorOffers (selectBestUnitOffer) | **unguarded** | undefined 가능. 729/735/741/766행에서 non-null 단언(!)으로 소비되지만 모두 hasVerifiedLiquorComparison 삼항 안이라 런타임에는 안전하다. 다만 853행에서는 `bestVerifiedLiquorDuty?.sourceName ?? "면세 가격 확인 중"`으로 옵셔널 체이닝을 쓰고 있어 같은 값에 대해 방어 방식이 일관되지 않다. |
| `bestVerifiedLiquorRetail` | `app/page.tsx:722` | derived-value | verifiedLiquorOffers (selectBestUnitOffer) | **unguarded** | undefined 가능. 733/739/745/768행의 `!` 단언은 hasVerifiedLiquorComparison 가드 안이라 안전하지만, 이 플래그와 단언의 연결이 타입 시스템으로 보장되지 않으므로 리팩터링 중 가드를 떼면 즉시 TypeError가 된다. |
| `hasVerifiedLiquorComparison` | `app/page.tsx:726` | derived-value | bestVerifiedLiquorDuty, bestVerifiedLiquorRetail | **unguarded** | Boolean이라 안전하게 false. 주류 경로의 유일한 널 가드이며, 아래 12개 파생값 전부가 이 하나의 플래그에 의존한다. |
| `liquorDutyPrice` | `app/page.tsx:729` | derived-value | hasVerifiedLiquorComparison, bestVerifiedLiquorDuty!.finalPrice, liquor.dutyPrice | **guarded** | 널이 되면 크래시가 아니라 하드코딩 카탈로그 가격(liquor.dutyPrice)으로 조용히 대체된다. 1710행에서 검수 가격과 구별 없이 그대로 렌더되므로, 화장품 쪽 baseOffers와 정확히 같은 성격의 '가짜 가격 노출' 문제다. |
| `liquorRetailPrice` | `app/page.tsx:732` | derived-value | hasVerifiedLiquorComparison, bestVerifiedLiquorRetail!.finalPrice, liquor.retailPrice | **guarded** | 널이면 하드코딩 liquor.retailPrice로 폴백. 869행 retailDecision.price에도 그대로 들어가므로 검수 데이터가 없을 때도 결정 카드에 숫자가 표시된다. |
| `liquorDutyVolume` | `app/page.tsx:735` | derived-value | hasVerifiedLiquorComparison, bestVerifiedLiquorDuty!.volume, liquor.volume | **guarded** | 널이면 하드코딩 liquor.volume으로 폴백. 1708행 표기 용량이 실제 검수 오퍼 용량과 달라질 수 있다. |
| `liquorRetailVolume` | `app/page.tsx:738` | derived-value | hasVerifiedLiquorComparison, bestVerifiedLiquorRetail!.volume, liquor.volume | **guarded** | 널이면 하드코딩 값. 748행 liquorSaving과 857행 dutyDecision.price의 환산 기준 용량이므로, 폴백되면 절약액 계산 기준 자체가 하드코딩 값이 된다. |
| `liquorDutyUnitPrice` | `app/page.tsx:741` | derived-value | hasVerifiedLiquorComparison, bestVerifiedLiquorDuty!.unitPrice, liquor.dutyPrice/liquor.volume | **guarded** | 널이면 하드코딩 나눗셈으로 폴백. liquor.volume이 0이면 Infinity가 되지만 카탈로그 상수라 현재는 발생하지 않는다. 857행에서 liquorRetailVolume과 곱해져 결정 카드 가격이 된다. |
| `liquorRetailUnitPrice` | `app/page.tsx:744` | derived-value | hasVerifiedLiquorComparison, bestVerifiedLiquorRetail!.unitPrice, liquor.retailPrice/liquor.volume | **guarded** | 널이면 하드코딩 폴백. 1729행 100ml 단가 표시에만 쓰이며 크래시 위험은 없다. |
| `liquorSaving` | `app/page.tsx:747` | derived-value | hasVerifiedLiquorComparison, liquorRetailPrice, liquorDutyUnitPrice, liquorRetailVolume, liquor.retailPrice/dutyPrice | **guarded** | 널이면 하드코딩 (liquor.retailPrice - liquor.dutyPrice)로 폴백해 항상 숫자가 나온다. 그 결과 779행 decisionDifference가 절대 undefined가 되지 않아 주류 경로는 크래시하지 않지만, 검수 근거가 없는 절약액이 1158행 게이트를 통과해 사용자에게 '체리픽'으로 제시될 수 있다. |
| `liquorDutySourceCount` | `app/page.tsx:750` | derived-value | verifiedLiquorOffers (channel==="duty") | **unguarded** | Set 크기라 0이 될 뿐 크래시 없음. 1716행 '면세 N곳 비교 최저' 문구용. |
| `liquorRetailSourceCount` | `app/page.tsx:755` | derived-value | verifiedLiquorOffers (channel==="retail") | **unguarded** | 0이 될 뿐 크래시 없음. 1733행·1754행에서 사용. |
| `currentComparisonReady` | `app/page.tsx:760` | derived-value | category, hasTrustedCosmeticsComparison, hasVerifiedLiquorComparison | **unguarded** | 불리언 조합이라 안전. 1158행 quick-decision 렌더 게이트의 조건이지만, 이 값이 계산되는 시점(760행)은 이미 704행에서 크래시가 난 뒤이므로 게이트로서 아무것도 막지 못한다. 이것이 '게이트 밖에서 계산된다'는 감사 지적의 구조적 원인이다. |
| `liquorVerdict` | `app/page.tsx:764` | derived-value | hasVerifiedLiquorComparison, liquorSaving, bestVerifiedLiquorDuty!/bestVerifiedLiquorRetail!.sourceName, liquor.verdict | **guarded** | 766/768행에서 `!` 단언으로 sourceName에 접근하지만 hasVerifiedLiquorComparison 삼항 안이라 런타임 안전. 널이면 하드코딩 liquor.verdict 문구가 그대로 노출된다(검수 근거 없는 판정 문구). |
| `liquorReason` | `app/page.tsx:771` | derived-value | hasVerifiedLiquorComparison, liquorSaving, liquor.reason | **guarded** | 널이면 하드코딩 liquor.reason으로 폴백. 크래시 없음. 1746행에서 렌더. |
| `decisionDifference` | `app/page.tsx:778` | derived-value | category, equivalentSavings, liquorSaving | **unguarded** | 화장품 경로에서 equivalentSavings가 undefined가 되면 이 값도 undefined가 되고, 이후 Math.abs(undefined)=NaN이 결정 체인 전체(priceGapIsSmall→decisionWinner→decisionTone→expectedSavings→quickDecision)로 전파된다. 크래시 대신 '가격 차이 NaN원' 문구와 잘못된 승자 판정이 나오는 조용한 오류가 된다. |
| `decisionThreshold` | `app/page.tsx:780` | derived-value | category (비교 데이터 비의존) | **unguarded** | 비교 데이터에 의존하지 않는 상수 분기라 널 영향 없음. 다만 786행에서 NaN과 비교될 때 항상 false를 반환해 priceGapIsSmall 판정을 조용히 왜곡시키는 통로가 된다. |
| `selectedDecisionTitle` | `app/page.tsx:781` | derived-value | category, product.brand/name, liquor.name | **unguarded** | product와 liquor 모두 하드코딩 카탈로그에서 오므로 널 영향 없음. 1165행(게이트 안)과 1212행(pending 분기)에서 모두 쓰이므로 비교가 없을 때도 안전하게 렌더된다 — 이 파일에서 유일하게 제대로 널 세이프한 결정 계열 값이다. |
| `priceGapIsSmall` | `app/page.tsx:785` | derived-value | decisionDifference, decisionThreshold | **unguarded** | decisionDifference가 undefined면 Math.abs가 NaN을 내고 `NaN <= 3000`이 false가 되어 '가격 차이가 작지 않다'로 잘못 판정된다. 그 결과 787행에서 실제 비교가 없는데도 duty/retail 중 하나를 승자로 지목한다. |
| `decisionWinner` | `app/page.tsx:787` | derived-value | priceGapIsSmall, decisionDifference | **unguarded** | decisionDifference가 NaN이면 `NaN > 0`이 false라 항상 "retail"로 확정된다. 즉 데이터가 없을 때 '국내몰 승리'라는 근거 없는 결론이 조용히 만들어진다. |
| `decisionTone` | `app/page.tsx:793` | derived-value | priceGapIsSmall, decisionWinner | **unguarded** | 크래시는 없고 항상 문자열. 803행 quickDecision.key와 1160행 CSS 클래스에 들어가므로, 잘못된 tone이 저장 키에 섞이면 내 비교함 항목의 동일성 판정까지 오염된다. |
| `expectedSavings` | `app/page.tsx:796` | derived-value | decisionWinner, decisionDifference | **unguarded** | decisionDifference가 NaN이면 두 조건 모두 false가 되어 0으로 떨어진다. 크래시는 없지만 quickDecision.amount가 0이 되고, 저장 시 817행 savedPickTotal 합계에 0이 누적되어 '절약액 0원' 항목이 쌓인다. |
| `quickDecision` | `app/page.tsx:802` | derived-value | category, product.id/taste, decisionTone, priceGapIsSmall, decisionWinner, decisionDifference, expectedSavings | **unguarded** | 객체 리터럴이라 그 자체는 크래시하지 않지만, heading/reason 템플릿 문자열이 formatWon(Math.abs(undefined))를 호출해 'NaN원' 또는 '₩NaN'이 그대로 사용자 문구에 박힌다. 1166~1167행에서 렌더되며 게이트 안이라 결과적으로 currentComparisonReady가 true인 경우에만 노출된다. |
| `savedPick` | `app/page.tsx:816` | derived-value | savedPicks, quickDecision.key | **unguarded** | quickDecision이 항상 객체이므로 크래시 없음. 다만 key가 잘못된 decisionTone을 포함하면 이미 저장된 항목을 못 찾아 중복 저장이 가능해진다. 1197~1198행 버튼 disabled 상태의 근거값. |
| `savedPickTotal` | `app/page.tsx:817` | derived-value | savedPicks (항목의 amount는 과거 quickDecision.amount에서 유래) | **unguarded** | 현재 비교 상태에 직접 의존하지 않으므로 bestDuty/bestRetail이 널이 되어도 크래시하지 않는다. 그러나 localStorage에 이미 저장된 amount가 과거의 하드코딩 폴백 기반 값일 수 있어, 1203행 '예상 N원 절약' 합계가 검수 근거 없는 숫자를 이어서 표시한다. |
| `verifiedCosmeticChecks` | `app/page.tsx:818` | derived-value | publishedOffers (offers/bestDuty 비의존, 자체적으로 duty/retail 재선정) | **guarded** | 832행 `if (!duty \|\| !retail) return []`로 내부에서 제대로 널 가드되어 있어 안전하다. 이 파일에서 유일하게 올바른 널 세이프 패턴이며, 688~874행 리팩터링의 참고 모델로 삼을 수 있다. |
| `dutyDecision` | `app/page.tsx:848` | derived-value | category, bestDuty.source, dutyEquivalent, bestRetail.volume/unit, bestVerifiedLiquorDuty?.sourceName, liquorDutyUnitPrice, liquorRetailVolume | **unguarded** | 852행 bestDuty.source와 860행 bestRetail.volume/unit을 옵셔널 체이닝 없이 접근한다. category가 "cosmetics"일 때 bestDuty/bestRetail이 널이면 TypeError. 반면 같은 객체 안 853행 주류 경로는 `?.` + `??`로 방어하고 있어, 한 객체 리터럴 안에서 화장품 경로만 무방비인 비대칭이 명확히 드러난다. 1170행에서 배열로 렌더되지만 계산 자체는 게이트 밖이다. |
| `retailDecision` | `app/page.tsx:863` | derived-value | category, bestRetail.source/volume/unit, retailPrice, bestVerifiedLiquorRetail?.sourceName, liquorRetailPrice, liquorRetailVolume | **unguarded** | 867행 bestRetail.source와 872행 bestRetail.volume/unit이 무방비 접근이다. bestRetail이 널이면 TypeError. 868행 주류 경로만 `?.`로 방어된 동일한 비대칭이 반복된다. |
| `saveQuickDecision` | `app/page.tsx:999` | consumer | savedPick, quickDecision.key/amount, selectedDecisionTitle | **guarded** | onClick 콜백이라 렌더 중 실행되지 않고, 버튼 자체가 1158행 currentComparisonReady 게이트 안에만 존재하므로 비교가 없으면 호출 불가. 다만 quickDecision.amount가 NaN 경로를 탄 값이면 그대로 localStorage(pickStorageKey)에 영구 저장되어 이후 세션까지 오염된다. |
| `quick-decision 렌더 게이트` | `app/page.tsx:1158` | render-site | currentComparisonReady → decisionTone, quickDecision, priceGapIsSmall, dutyDecision, retailDecision, savedPick, savedPickTotal | **guarded** | 렌더는 올바르게 게이트되어 있으나, 게이트가 소비하는 값들은 전부 704~874행에서 이미 계산된 뒤다. 즉 이 게이트는 '표시'만 막고 '계산'은 막지 못한다 — 이것이 감사 결론의 핵심이며, 개선 PR은 게이트가 아니라 계산 지점을 널 세이프로 바꿔야 한다. |
| `selected (decision-options map 내부)` | `app/page.tsx:1172` | render-site | priceGapIsSmall, decisionWinner | **guarded** | 1158행 게이트 안 콜백이라 비교 없이는 실행되지 않는다. 값이 NaN 경로를 탔다면 항상 retail 카드만 '체리픽'으로 강조되는 조용한 오표시가 된다. |
| `화장품 비교 섹션 게이트` | `app/page.tsx:1346` | render-site | hasTrustedCosmeticsComparison → bestDuty, bestRetail, comparison, dutyWins, equivalentSavings, savingRate, dutyUnit, retailUnit, retailPrice, dutyEquivalent, verifiedDuty/RetailSourceCount | **guarded** | 이 게이트가 false면 1373~1597행의 bestDuty.volume, bestRetail.source 등 무방비 접근은 렌더되지 않는다. 따라서 JSX 자체는 안전하고, 실제 크래시는 704행에서 이 지점에 도달하기 전에 발생한다. |
| `환산 막대 폭 계산` | `app/page.tsx:1492` | render-site | dutyEquivalent, retailPrice | **guarded** | `(dutyEquivalent / retailPrice) * 100`은 널 체크가 없다. 두 값을 옵셔널 체이닝으로만 널 세이프화하면 undefined/undefined = NaN이 되고 style.width가 'NaN%'가 되어 막대가 사라진다(예외는 없음). 704행을 고칠 때 이 나눗셈도 함께 기본값 처리해야 한다. |
| `주류 가격 카드 게이트` | `app/page.tsx:1701` | render-site | hasVerifiedLiquorComparison → bestVerifiedLiquorDuty!/Retail!, liquorDuty/RetailPrice, liquorDuty/RetailVolume, liquorDuty/RetailUnitPrice, liquorSaving, liquorVerdict, liquorReason | **guarded** | 1706행·1723행의 `!` 단언이 이 게이트 덕분에 안전하다. 단 게이트가 이미 참인 상태에서 1705행이 다시 hasVerifiedLiquorComparison을 검사하는 중복 조건이 있어, 리팩터링 시 바깥 게이트만 제거되면 `!` 단언이 그대로 TypeError가 된다. |

**비고**

전체 스팬(580~874행)에서 공개 비교에 의존하는 const는 47개이며, 그중 게이트 밖에서 계산되는 것이 38개다.

크래시 순서(baseOffers 제거 시, 검수 비교도 캡처 오퍼도 없는 상태):
1. 580행 offers → [] (빈 배열)
2. 689행 bestDuty → offers[0] → undefined
3. 693행 bestRetail → offers[1] → undefined
4. **704행 compareEquivalentVolumes(bestDuty, bestRetail) → TypeError, 여기서 렌더 중단**
app/lib/pricing.ts:121-122에서 duty.unitPrice / retail.volume / retail.unitPrice를 널 체크 없이 바로 읽는다. 705~711행, 848행, 863행도 각각 독립적인 두 번째~네 번째 크래시 지점이므로 704행만 고치면 안 되고 전부 같이 고쳐야 한다.

구조적 비대칭 두 가지:
- 화장품 경로는 offers[0]/offers[1] 배열 인덱스 폴백에 의존해 널을 회피하고 있고(688, 690행), 이 폴백은 채널 검증이 없어 캡처된 retail 오퍼가 '면세 최저가' 자리에 들어가는 조용한 오류도 동시에 가지고 있다. 주류 경로는 hasVerifiedLiquorComparison 단일 플래그 + `!` 단언으로 방어한다 — 크래시는 없지만 하드코딩 카탈로그 값으로 조용히 폴백한다.
- 848행 dutyDecision / 863행 retailDecision은 한 객체 리터럴 안에서 주류 필드만 `?.` + `??`로 방어하고 화장품 필드는 무방비로 접근한다. 개선 PR에서 가장 놓치기 쉬운 지점이다.

게이트가 보호하지 못한다는 점이 핵심이다. 1158행(currentComparisonReady)과 1346행(hasTrustedCosmeticsComparison) 게이트는 JSX 렌더만 막는데, 이들이 소비하는 값은 이미 704~874행에서 계산이 끝난 상태다. 따라서 게이트를 강화하는 방식으로는 해결되지 않으며, 계산 지점 자체를 널 세이프로 바꾸거나 비교 로직 전체를 하나의 널 반환 useMemo(예: `comparisonResult: ComparisonResult | null`)로 묶고 소비처를 그 아래에 두는 리팩터링이 필요하다.

참고 모델: 818행 verifiedCosmeticChecks가 832행 `if (!duty || !retail) return []`로 유일하게 올바른 널 가드 패턴을 쓰고 있다.

부수 위험: 1492행 `(dutyEquivalent / retailPrice) * 100`은 옵셔널 체이닝만 적용하면 NaN%가 되고, 999행 saveQuickDecision은 NaN/0 절약액을 localStorage(pickStorageKey)에 영구 저장해 이후 세션의 savedPickTotal까지 오염시킨다.

읽기 전용 작업으로 진행했으며 파일은 수정하지 않았고 상태를 바꾸는 git 명령도 실행하지 않았다.

---

## savedPicks · offers 소비자 (57건)

| 이름 | 위치 | 종류 | 의존 | 가드 | null 영향 |
|---|---|---|---|---|---|
| `type SavedPick` | `app/page.tsx:38` | state | 없음 (타입 선언: key, title, amount, savedAt 4개 필드) | **n/a** | 타입 자체는 offers와 무관해 영향 없음. 단, key 필드가 quickDecision.key(802행)에서 생성되므로 offers가 비면 key 생성 단계에서 이미 크래시가 나 이 타입의 값이 만들어지지 못함. |
| `pickStorageKey` | `app/page.tsx:107` | state | 없음 (상수 "cherrypicker-comparison-box-v1") | **n/a** | 영향 없음. 복원 effect(509행)와 저장 핸들러(1014행)에서만 사용되는 localStorage 키 상수. |
| `legacyPickStorageKey` | `app/page.tsx:108` | state | 없음 (상수 "cherrypicker-smart-picks-v1") | **n/a** | 영향 없음. 복원 effect의 폴백 읽기(510행)·삭제(529, 533행)에만 사용. |
| `savedPicks / setSavedPicks (useState)` | `app/page.tsx:373` | state | 없음 (초기값 빈 배열). 쓰기 주체는 복원 effect(527행)와 saveQuickDecision(1013행) | **n/a** | offers가 비어도 상태 자체는 안전(빈 배열). 다만 저장 핸들러가 quickDecision에 의존하므로 신규 저장 경로가 막힘. |
| `savedPicks 복원 effect (localStorage → setSavedPicks)` | `app/page.tsx:506` | effect | window.localStorage[pickStorageKey] ?? [legacyPickStorageKey] (509-510행). 검증 필드: key:string, title:string, amount:유한수, savedAt:유한수 (516-523행). slice(-50) 후 setTimeout으로 setSavedPicks (527행), 원본 재기록 setItem(528행), 레거시 키 삭제(529행), 파싱 실패 시 두 키 모두 삭제(532-533행) | **n/a** | offers와 완전히 독립적이라 offers가 null/빈 배열이 되어도 이 effect는 정상 동작. 단, 이 effect가 채운 savedPicks를 읽는 816·817행이 offers 크래시 이후 렌더에 도달하지 못함. |
| `savedPick (중복 저장 여부 판정)` | `app/page.tsx:816` | consumer | savedPicks(.some, item.key 필드만 읽음) × quickDecision.key(802-803행) ← decisionTone ← decisionDifference ← equivalentSavings ← comparison(704행) ← bestDuty/bestRetail | **unguarded** | offers가 비면 704행 comparison 계산에서 이미 TypeError가 나므로 이 줄에 도달하지 못하고 컴포넌트 전체가 크래시. null-safe로 고치면 quickDecision.key가 달라질 수 있어 기존 저장 항목과 키가 불일치해 중복 판정이 잘못될 위험이 있음. |
| `savedPickTotal (누적 절약액 합계)` | `app/page.tsx:817` | consumer | savedPicks(.reduce, item.amount 필드만 읽음) | **unguarded** | 이 계산 자체는 offers와 무관해 안전하지만, 바로 위 704행 크래시로 도달 불가. 렌더 게이트 뒤(1203행)에서만 표시되므로 계산을 게이트 안으로 옮겨도 안전. |
| `saveQuickDecision (저장 핸들러)` | `app/page.tsx:999` | consumer | savedPick(1000행 중복 체크), savedPicks 스프레드(1005행), 기록 필드 key←quickDecision.key(1007), title←selectedDecisionTitle(1008), amount←quickDecision.amount(1009), savedAt←Math.round(event.timeStamp)(1010), slice(-50)(1012), setSavedPicks(1013), localStorage.setItem(1014), 메시지에 quickDecision.amount(1016-1017) | **unguarded** | offers가 비면 quickDecision 자체가 만들어지지 않아 핸들러 정의 시점 이전에 렌더가 실패. 또한 quickDecision.amount는 expectedSavings(796행)←decisionDifference에 의존하므로 offers null-safe화 시 amount 기본값(0) 정책을 반드시 정해야 저장 금액이 NaN으로 기록되지 않음. |
| `savedPicks 삭제/제거 핸들러 (부재)` | `app/page.tsx:1020` | consumer | 해당 없음 — 저장소 전체를 통틀어 savedPicks 개별 항목을 지우는 핸들러는 존재하지 않음. 삭제 경로는 복원 effect의 catch 블록(532-533행) 전체 삭제뿐. removeCapturedOffer(993행)는 capturedOffers 전용이며 savedPicks와 무관 | **n/a** | 영향 없음. 다만 잘못된 key로 저장된 항목을 사용자가 제거할 수단이 없어, offers null-safe화로 key 규칙이 바뀌면 낡은 항목이 영구히 남는다는 점을 remediation PR에서 고려해야 함. |
| `내 비교함 카운트 (상단 네비 링크)` | `app/page.tsx:1087` | render-site | savedPicks.length | **unguarded** | offers와 무관해 값 자체는 안전하지만, 같은 렌더 트리 안에 있어 704행 크래시 시 함께 사라짐. offers null-safe화 후에는 그대로 정상 렌더. |
| `이 선택 저장 버튼 (disabled/라벨)` | `app/page.tsx:1197` | render-site | savedPick(disabled), savedPick(라벨 1198행), onClick=saveQuickDecision | **guarded** | currentComparisonReady(760행) 게이트 안이라 offers가 비면 애초에 렌더되지 않음. 즉 이 렌더 사이트는 안전하고, 문제는 게이트 밖에서 계산되는 816행 savedPick 쪽. |
| `내 비교함 요약 문구 (개수 · 예상 절약)` | `app/page.tsx:1200` | render-site | savedPicks.length(1200, 1202행), savedPickTotal(1203행) | **guarded** | 게이트 안이라 렌더는 안전. savedPickTotal이 과거 저장분 합계라 offers가 비어도 값이 남아 있어, 게이트가 닫혀 결론을 못 보여주는 상태와 절약액 표시가 어긋날 수 있음. |
| `offers (useMemo 정의)` | `app/page.tsx:580` | state | [capturedOffers, product, publishedOffers](675행). 반환값 = (hasVerifiedComparison ? verifiedOffers : baseOffers) + userOffers (671-674행) | **n/a** | baseOffers를 제거하면 검수 가격이 양채널로 모이지 않고 사용자가 캡처도 등록하지 않은 초기 상태에서 offers가 길이 0이 됨. 이 빈 배열이 아래 모든 소비자의 크래시 원인. |
| `trustedCosmeticOffers` | `app/page.tsx:677` | consumer | offers.filter(offer.verified \|\| offer.captured) | **unguarded** | 빈 배열에서도 .filter는 안전해 []를 반환. 크래시 없음. |
| `trustedBestDuty` | `app/page.tsx:680` | consumer | selectBestUnitOffer(trustedCosmeticOffers, "duty") | **unguarded** | 안전. 빈 배열이면 undefined 반환(pricing.ts 103-115행). 이후 689행의 ?? 폴백 체인을 타면서 문제가 시작됨. |
| `trustedBestRetail` | `app/page.tsx:681` | consumer | selectDomesticRepresentative(trustedCosmeticOffers, offer => offer.source) | **unguarded** | 안전. 빈 배열이면 lowest가 undefined라 조기 return undefined(300-301행). |
| `hasTrustedCosmeticsComparison (렌더 게이트)` | `app/page.tsx:685` | consumer | trustedBestDuty && trustedBestRetail | **unguarded** | 안전하게 false가 됨. 이 게이트는 1346행 화장품 비교 섹션만 막을 뿐, 688-711행 파생값 계산은 게이트 밖에서 무조건 실행되므로 크래시를 막지 못함 — 이번 감사의 핵심 지점. |
| `bestDuty (offers[0] 폴백)` | `app/page.tsx:688` | consumer | trustedBestDuty ?? selectBestUnitOffer(offers, "duty") ?? offers[0] | **unguarded** | offers가 비면 세 항 모두 undefined → bestDuty === undefined. 타입상 OfferView지만 런타임은 undefined라 이후 .source/.unitPrice/.volume 접근이 전부 TypeError. null-safe 변환의 1순위 대상. |
| `bestRetail (offers[1] 폴백)` | `app/page.tsx:690` | consumer | trustedBestRetail ?? selectDomesticRepresentative(offers, offer => offer.source) ?? offers[1] | **unguarded** | offers가 비면 undefined. 더 위험한 것은 offers 길이가 1일 때(면세 캡처 1건만 등록 등) offers[1]이 undefined가 되어 빈 배열이 아니어도 같은 크래시가 난다는 점. |
| `verifiedDutySourceCount` | `app/page.tsx:694` | consumer | offers.filter(verified && channel==="duty").map(normalizeRetailerName(offer.source)) → Set.size | **unguarded** | 안전. 빈 배열이면 0. 다만 0일 때 1434-1436행 배지 문구가 "면세 최저 단위가"로 조용히 바뀌는 무음 변화가 있음. |
| `verifiedRetailSourceCount` | `app/page.tsx:699` | consumer | offers.filter(verified && channel==="retail").map(normalizeRetailerName(offer.source)) → Set.size | **unguarded** | 안전(0). 1458-1460행 배지가 "국내 대표 가격"으로 무음 전환되고 1597행 요약 문구 분기도 바뀜. |
| `comparison (compareEquivalentVolumes)` | `app/page.tsx:704` | consumer | bestDuty, bestRetail (duty.unitPrice, retail.volume, retail.unitPrice 읽음 — pricing.ts 121-122행) | **unguarded** | 실제 크래시 지점. bestDuty가 undefined면 duty.unitPrice 접근에서 즉시 TypeError가 던져져 Home 컴포넌트 렌더가 실패하고 페이지 전체가 흰 화면이 됨. baseOffers 제거 시 가장 먼저 터지는 줄. |
| `retailPrice` | `app/page.tsx:705` | consumer | bestRetail.total | **unguarded** | bestRetail이 undefined면 TypeError. 704행이 먼저 터지지만 704행만 고치면 여기서 다시 터짐 — 개별적으로 null-safe화 필요. 0으로 폴백하면 1492행 (dutyEquivalent / retailPrice)가 Infinity/NaN이 되어 style.width가 깨짐. |
| `dutyUnit` | `app/page.tsx:706` | consumer | bestDuty.unitPrice | **unguarded** | bestDuty가 undefined면 TypeError. 1450행 단위가 표시에만 쓰이므로 게이트 안으로 옮기거나 옵셔널 체이닝 후 formatWon 입력 NaN 방어가 필요. |
| `retailUnit` | `app/page.tsx:707` | consumer | bestRetail.unitPrice | **unguarded** | bestRetail이 undefined면 TypeError. 1474행에서만 소비. |
| `dutyEquivalent` | `app/page.tsx:708` | consumer | comparison.dutyEquivalent | **unguarded** | comparison이 null-safe하게 바뀌면 undefined/0이 되어 1486·1492행 환산 카드와 848-862행 dutyDecision.price가 0원으로 조용히 표시될 수 있음 — 크래시 대신 오정보가 되는 무음 열화. |
| `equivalentSavings` | `app/page.tsx:709` | consumer | comparison.savings | **unguarded** | decisionDifference(778행) → quickDecision.heading/reason/amount → savedPick.key까지 전파되는 최상위 오염원. 0으로 폴백하면 priceGapIsSmall이 항상 true가 되어 결론이 무조건 "국내 픽업 편의"로 고정됨. |
| `dutyWins` | `app/page.tsx:710` | consumer | comparison.dutyWins | **unguarded** | 1386·1393행 결론 문구 분기에만 사용. 폴백 false면 항상 "이번에는 배송 리테일 구매"로 표시됨. |
| `savingRate` | `app/page.tsx:711` | consumer | comparison.savingRate | **unguarded** | 1399행 "N% 차이" 표시. 폴백 0이면 0% 차이로 표시되어 사실과 다른 확신을 줄 수 있음. |
| `decisionDifference` | `app/page.tsx:778` | consumer | category==='cosmetics' ? equivalentSavings : liquorSaving | **unguarded** | 주류 탭에서도 equivalentSavings 계산은 이미 704행에서 실행된 뒤이므로, 화장품 offers가 비면 주류 화면조차 렌더되지 않음. 카테고리 무관 전면 크래시의 경로. |
| `quickDecision (heading/reason/amount/key)` | `app/page.tsx:802` | consumer | decisionDifference, decisionTone, decisionWinner, expectedSavings, priceGapIsSmall, product.id/taste/category | **unguarded** | comparison 오염이 그대로 문구와 저장 key로 전파. key가 바뀌면 savedPicks 중복 판정(816행)이 깨져 같은 선택이 중복 저장됨. |
| `dutyDecision.source / detail` | `app/page.tsx:848` | consumer | bestDuty.source(852행), dutyEquivalent(857행), bestRetail.volume·bestRetail.unit(860행) | **unguarded** | 객체 리터럴이라 게이트와 무관하게 매 렌더 평가됨. bestDuty/bestRetail이 undefined면 852·860행에서 TypeError. 704행을 고쳐도 여기가 두 번째 크래시 지점. |
| `retailDecision.source / price / detail` | `app/page.tsx:863` | consumer | bestRetail.source(867행), retailPrice(869행), bestRetail.volume·unit(872행) | **unguarded** | 위와 동일하게 매 렌더 평가되어 bestRetail undefined 시 TypeError. 세 번째 크래시 지점. |
| `면세/리테일 용량 메타 표시` | `app/page.tsx:1373` | render-site | bestDuty.volume, bestDuty.unit(1373행), bestRetail.volume, bestRetail.unit(1374행) | **guarded** | hasTrustedCosmeticsComparison(1346행) 뒤라 offers가 비면 렌더되지 않음. 렌더 사이트 자체는 안전. |
| `직접 등록 가격 반영 배지` | `app/page.tsx:1375` | render-site | offers.some(offer => offer.captured) | **guarded** | 빈 배열에서 .some은 false라 안전. 배지가 사라질 뿐. |
| `결론 문구 (comparison.comparisonVolume)` | `app/page.tsx:1391` | render-site | comparison.comparisonVolume, bestRetail.unit(1392행), dutyWins(1393행), equivalentSavings(1394행) | **guarded** | 게이트 뒤라 안전. 단 comparison을 null 허용형으로 바꾸면 이 JSX가 옵셔널 접근을 요구하게 되므로 타입 변경 파급이 큼. |
| `면세 최저 오퍼 카드` | `app/page.tsx:1431` | render-site | verifiedDutySourceCount(1434행), bestDuty.source(1438행), bestDuty.volume·unit·condition(1440행), bestDuty.total(1446행), dutyUnit·bestDuty.unit(1450행) | **guarded** | 게이트 뒤라 안전. bestDuty를 null 허용으로 바꾸면 이 블록 전체에 non-null 단언 또는 조기 분기가 필요. |
| `국내 대표 오퍼 카드` | `app/page.tsx:1455` | render-site | verifiedRetailSourceCount·normalizeRetailerName(bestRetail.source)(1458-1459행), bestRetail.source(1462행), bestRetail.volume·unit·condition(1464행), retailPrice(1470행), retailUnit·bestRetail.unit(1474행) | **guarded** | 게이트 뒤라 안전. 1459행 normalizeRetailerName(bestRetail.source)는 인자가 undefined면 던질 수 있으므로 null-safe 변환 시 주의. |
| `동일 용량 환산 카드 / 막대 그래프` | `app/page.tsx:1480` | render-site | bestRetail.volume·unit(1483행), dutyEquivalent·retailPrice(1486행), (dutyEquivalent / retailPrice)(1492행) | **guarded** | 게이트 뒤라 크래시는 없으나, null-safe 폴백으로 retailPrice가 0이 되면 1492행이 Infinity/NaN을 만들어 style width가 "NaN%"로 렌더됨. 0 가드가 필요한 유일한 산술 지점. |
| `가격 계산 표 (offers.map)` | `app/page.tsx:1517` | render-site | offers.map — offer.id, source, captured, verified, volume, unit, price, shipping, discount, total, unitPrice, url (1518-1566행). 행 삭제 버튼은 removeCapturedOffer(offer.id) | **guarded** | 빈 배열이면 tbody가 비어 헤더만 남은 빈 표가 렌더됨 — 크래시는 아니지만 무음 UX 열화. 게이트 뒤라 실제로는 노출되지 않음. |
| `가격 출처 요약 카드` | `app/page.tsx:1587` | render-site | offers.some(captured)(1587행), offers.some(verified)(1589행), offers.filter(captured).length(1594-1595행), offers.filter(verified).length(1596행), verifiedDutySourceCount·verifiedRetailSourceCount(1597행) | **guarded** | 빈 배열에서도 안전하게 "기본값은 예시 가격" 분기로 떨어짐. baseOffers 제거 후에는 이 문구 자체가 사실과 맞지 않게 되므로 카피 정리 대상. |
| `capturedOffers / setCapturedOffers (useState)` | `app/page.tsx:349` | state | 없음 (초기값 []). 쓰기는 persistOffers(876-878행)를 통해서만 | **n/a** | offers와 무관. 사용자가 캡처를 1건이라도 등록하면 offers가 비지 않게 되므로, baseOffers 제거 후 크래시는 '캡처 0건 + 검수 미성립' 초기 상태에서만 발생. |
| `capturedOffers 읽기 — userOffers 생성` | `app/page.tsx:655` | consumer | capturedOffers.filter(offer.productId === product.id).map(...) — offer 전체 스프레드 + total, unitPrice, condition, captured 재계산(658-668행) | **unguarded** | 안전. 빈 배열이면 []. offers 최종 길이에 기여하는 유일한 사용자 경로. |
| `capturedOffers 읽기 — useMemo 의존성` | `app/page.tsx:675` | consumer | [capturedOffers, product, publishedOffers] | **n/a** | 영향 없음. |
| `capturedOffers 읽기 — handleCapture 추가` | `app/page.tsx:978` | consumer | [...capturedOffers, nextOffer] → persistOffers(979행). 이후 setSelectedId·setCategory·setStatusMessage(980-982행) | **n/a** | 영향 없음. 오히려 이 경로가 빈 offers 상태를 탈출시키는 복구 수단. |
| `capturedOffers 읽기 — removeCapturedOffer 삭제` | `app/page.tsx:993` | consumer | capturedOffers.filter(offer.id !== id) → persistOffers(995행) | **n/a** | 마지막 캡처를 지우면 offers가 다시 길이 0으로 돌아가 704행 크래시를 유발할 수 있음 — baseOffers 제거 시 '삭제로 인한 재크래시' 경로로 반드시 회귀 테스트 필요. |
| `publishedOffers / setPublishedOffers (useState)` | `app/page.tsx:350` | state | 없음 (초기값 []). 쓰기는 /api/offers 로드 effect(548행) | **n/a** | API 실패 시 publishedStatus만 'unavailable'이 되고 publishedOffers는 []로 유지 → offers가 빈 배열이 되는 주요 시나리오. |
| `publishedOffers 적재 effect (/api/offers)` | `app/page.tsx:537` | effect | fetch('/api/offers')(542행) → payload.offers ?? [] → setPublishedOffers(548행), setPublishedStatus('ready')(549행) / catch에서 'unavailable'(552행). cancelled 플래그로 언마운트 가드(557-559행) | **n/a** | 네트워크 실패·빈 응답 어느 쪽이든 publishedOffers=[]가 되어 verifiedOffers=[], hasVerifiedComparison=false. baseOffers가 없으면 곧바로 offers=[]. |
| `verifiedOffers (검수 오퍼 → OfferView 매핑)` | `app/page.tsx:628` | consumer | publishedOffers.filter(!reference && category==='cosmetics' && productId===product.catalogId)(629-634행) → map(id, channel, sourceName, sourceUrl, listPrice, shipping, instantDiscount, volume, unit, finalPrice, unitPrice, observedAt)(635-650행) | **unguarded** | 안전하게 []. 읽는 곳은 652·653행(hasVerifiedComparison 판정)과 672행(offers 조립) 세 곳뿐. |
| `hasVerifiedComparison` | `app/page.tsx:651` | consumer | verifiedOffers.some(channel==='duty') && verifiedOffers.some(channel==='retail') | **unguarded** | false면 672행에서 baseOffers가 선택됨 — 즉 baseOffers는 현재 '검수 미성립 시 유일한 비어있지 않은 소스'. 제거하면 이 분기가 빈 배열로 바뀜. |
| `userOffers` | `app/page.tsx:655` | consumer | capturedOffers 기반. 읽는 곳은 673행(offers 스프레드) 한 곳 | **unguarded** | 빈 배열이면 offers 최종 길이에 기여하지 않음. baseOffers 제거 후 offers의 비어있지 않음을 보장하는 유일한 런타임 소스. |
| `baseOffers (하드코딩 폴백)` | `app/page.tsx:581` | consumer | product.dutyPrice/dutyVolume/dutyCondition/unit/id(582-603행), product.retailSource/retailBasePrice/shipping/retailVolume/retailCondition(604-625행). 읽는 곳은 672행 단 한 곳 | **unguarded** | 이것이 제거 대상 그 자체. 항상 길이 2를 보장하고 있어 offers[0]/offers[1] 폴백이 지금까지 안전했던 유일한 이유. 제거 시 688-711행, 848-874행이 모두 undefined 접근으로 전환됨. |
| `trustedCosmeticOffers (정의 및 소비)` | `app/page.tsx:677` | consumer | offers.filter(verified \|\| captured). 읽는 곳은 680행(selectBestUnitOffer), 682행(selectDomesticRepresentative) 두 곳 | **unguarded** | 항상 안전(빈 배열 허용). 이 값이 비면 trustedBestDuty/Retail이 undefined가 되어 689·692행의 offers[0]/offers[1] 폴백으로 내려가는 것이 크래시의 시작 조건. |
| `verifiedLiquorOffers` | `app/page.tsx:713` | consumer | publishedOffers.filter(!reference && category==='liquor' && productId===liquor.catalogId). 읽는 곳: 719·723행(selectBestUnitOffer), 751·756행(소스 수 집계), 1758행(픽업 링크 렌더) | **unguarded** | 화장품 offers와 독립적이며 729-746행이 모두 hasVerifiedLiquorComparison 삼항으로 이미 null-safe 처리되어 있음 — 화장품 쪽이 따라야 할 올바른 패턴의 참고 사례. |
| `verifiedCosmeticChecks (useMemo)` | `app/page.tsx:818` | consumer | [publishedOffers](845행). 내부에서 itemOffers 필터(821-826행), duty/retail 선택 후 !duty \|\| !retail이면 [] 반환(832행), compareEquivalentVolumes(834행) | **unguarded** | 832행에 명시적 null 가드가 있어 안전 — offers 파생값이 채택해야 할 정확한 방어 패턴. 렌더 사이트는 1872행 length>0 가드와 1882행 map. |
| `publishedOffers 렌더 — 데이터 출처 스트립` | `app/page.tsx:1150` | render-site | publishedOffers.some(!offer.reference), publishedStatus | **unguarded** | 빈 배열에서 안전. offers와 무관하지만 같은 렌더 트리라 704행 크래시 시 함께 소실. |
| `publishedOffers 렌더 — 검수 가격 피드 헤더/그리드` | `app/page.tsx:1236` | render-site | publishedOffers.filter(!reference).length(1236행), .some(reference)(1237행), .filter(reference).length(1238행), .length===0(1244행), .slice(0,8).map(1257행 — id, reference, category, sourceName, channel, evidenceType, brand, productName, finalPrice, unitPrice, volume, unit, observedAt, storeLocation, notes, sourceUrl, abv) | **unguarded** | 빈 배열 전 구간 안전(빈 상태 카피 1244-1254행 존재). offers 크래시가 나면 이 섹션도 함께 사라져 사용자가 '왜 가격이 없는지' 확인할 유일한 화면까지 잃게 됨. |

**비고**

## 핵심 결론

**크래시 순서**: `baseOffers`(581행)를 제거하고 검수 비교가 성립하지 않으면 `offers`(580행)는 길이 0이 됩니다. 그러면 렌더 게이트 **바깥**에서 다음 순서로 터집니다.
1. **704행 `compareEquivalentVolumes(bestDuty, bestRetail)`** — 첫 번째이자 실제 크래시 지점. `bestDuty`가 `undefined`라 `duty.unitPrice`(pricing.ts 121행)에서 TypeError.
2. **705-707행** `bestRetail.total` / `bestDuty.unitPrice` / `bestRetail.unitPrice` — 704행만 고치면 여기서 재크래시.
3. **852·860행 `dutyDecision`**, **867·872행 `retailDecision`** — 객체 리터럴이라 게이트와 무관하게 매 렌더 평가됨. 세 번째 크래시 지점.

즉 null-safe 변환은 704행 하나가 아니라 **688~874행 구간 전체**를 대상으로 해야 합니다.

## 감사 보고서가 놓친 두 가지

**(1) 빈 배열이 아니어도 터집니다.** `bestRetail`은 `offers[1]`(693행)로 폴백합니다. 사용자가 면세 캡처를 **1건만** 등록하면 `offers.length === 1`이 되어 `offers[1]`이 `undefined`가 되고 동일하게 크래시합니다. 빈 배열 케이스만 방어하면 회귀가 남습니다.

**(2) 삭제로 인한 재크래시 경로.** `removeCapturedOffer`(993행)로 마지막 캡처를 지우면 `offers`가 다시 길이 0으로 돌아갑니다. baseOffers 제거 후에는 "등록 → 정상 → 삭제 → 크래시" 시나리오가 성립하므로 회귀 테스트에 반드시 포함해야 합니다.

## 이미 올바른 패턴이 코드 안에 있습니다

- **`verifiedCosmeticChecks`(818행)**: 832행 `if (!duty || !retail) return [];` — 명시적 null 가드.
- **주류 파생값(729-746행)**: `hasVerifiedLiquorComparison` 삼항으로 전 항목이 이미 null-safe.

화장품 파생값만 이 패턴을 따르지 않고 `?? offers[0]` / `?? offers[1]` 인덱스 폴백에 의존하고 있습니다. 주류 쪽 구조를 그대로 이식하는 것이 가장 일관성 있는 수정입니다.

## 무음 열화 (크래시는 아니지만 잘못된 정보)

null-safe 폴백을 0으로 두면 크래시 대신 **오정보**가 됩니다.
- **1492행 `(dutyEquivalent / retailPrice) * 100`** — `retailPrice`가 0이면 `Infinity`/`NaN` → `style={{width: "NaN%"}}`. 0 가드가 필요한 유일한 산술 지점입니다.
- **709행 `equivalentSavings`가 0** → `priceGapIsSmall`(785행)이 항상 true → 결론이 무조건 "국내 픽업 편의"로 고정.
- **711행 `savingRate`가 0** → "0% 차이"로 표시되어 사실과 다른 확신을 줌.
- **694·699행 소스 카운트가 0** → 1434·1458행 배지가 "면세 최저 단위가"/"국내 대표 가격"으로 조용히 전환.
- **1517행 표** → 헤더만 남은 빈 tbody.
- **1587-1598행** → "기본값은 예시 가격" 분기로 떨어지는데, baseOffers 제거 후에는 이 카피 자체가 사실과 맞지 않아 정리 대상입니다.

## savedPicks (Part A) — 전 저장소 결과

`savedPicks`는 **`app/page.tsx` 단일 파일에만** 존재합니다 (전 저장소 grep 확인). 저장소 키는 107-108행 두 개(현행 + 레거시 마이그레이션).

**offers 의존은 한 곳뿐입니다**: `savedPick`(816행)이 `quickDecision.key`를 읽고, 그 key는 `decisionTone ← decisionDifference ← equivalentSavings ← comparison`으로 이어집니다. `savedPickTotal`(817행)과 복원 effect(506행)는 offers와 완전히 독립적입니다.

따라서 remediation 시 **`quickDecision.key` 생성 규칙이 바뀌면 기존 localStorage 항목과 key가 불일치**해 중복 판정(816행)이 깨지고 같은 선택이 중복 저장됩니다. 또한 `quickDecision.amount`(1009행)가 `NaN`으로 저장되지 않도록 폴백 정책을 명시해야 합니다 — 한번 저장되면 `savedPickTotal` 합계가 영구히 `NaN`이 됩니다.

**삭제 핸들러 부재**: savedPicks 개별 항목을 제거하는 UI/핸들러가 없습니다. 삭제 경로는 복원 effect의 catch 블록(532-533행) 전체 삭제뿐입니다. (`removeCapturedOffer`는 `capturedOffers` 전용으로 무관합니다.) 잘못된 key로 저장된 항목을 사용자가 치울 수단이 없다는 점을 PR에서 고려하십시오.

## 렌더 사이트는 대부분 이미 안전합니다

`offers`를 읽는 JSX(1373, 1375, 1391, 1431, 1455, 1480, 1517, 1587행)는 전부 `hasTrustedCosmeticsComparison`(1346행) 게이트 뒤에 있고, savedPicks 렌더(1197, 1200행)는 `currentComparisonReady`(1158행) 게이트 뒤입니다. 게이트 밖 렌더는 1087행(`savedPicks.length`)뿐이며 offers와 무관합니다.

**문제는 렌더가 아니라 계산 위치입니다.** 가장 단순한 수정은 688-874행 파생값을 게이트 안쪽으로 옮기거나, 주류 패턴(729-746행)처럼 `hasTrustedCosmeticsComparison` 삼항으로 감싸는 것입니다.

주의: `bestDuty`/`bestRetail`을 `OfferView | undefined` 타입으로 바꾸면 1431-1495행 JSX 전체가 옵셔널 접근을 요구하게 되어 타입 파급이 큽니다. 특히 **1459행 `normalizeRetailerName(bestRetail.source)`** 는 인자가 `undefined`면 던질 수 있으니 함께 확인하십시오.

읽은 파일: `/Users/maegbug-eeo/Documents/cherrypicker/app/page.tsx` (전체 2326행), `/Users/maegbug-eeo/Documents/cherrypicker/app/lib/pricing.ts` (타입 및 `selectBestUnitOffer` 103-115행, `compareEquivalentVolumes` 117-137행). 파일은 수정하지 않았고 상태를 바꾸는 git 명령도 실행하지 않았습니다.

---

## 입력 상태별 현행 동작 (17건)

| 이름 | 위치 | 종류 | 의존 | 가드 | null 영향 |
|---|---|---|---|---|---|
| `C1` | `app/page.tsx:704` | state-outcome | hasTrustedCosmeticsComparison(685) ← trustedBestDuty(680)/trustedBestRetail(681) 모두 undefined; bestDuty=offers[0](689), bestRetail=offers[1](693) | **unguarded** | 화면에는 결론이 전혀 안 나옵니다. 상단은 '양쪽 가격이 모이면 바로 결론을 드릴게요' pending 카드(1209-1223), 본문은 comparison-pending-card(1614-1622)만 보이고 헤드라인·절약액·판매처 수·상세표는 모두 없습니다. 하지만 내부적으로는 offers가 baseOffers 2건(예시)으로 채워져 bestDuty/bestRetail/comparison/quickDecision/dutyDecision·retailDecision(704-874)이 예시가격으로 전부 계산됩니다(렌더만 안 될 뿐). baseOffers를 지우면 offers=[]가 되어 689/693이 undefined가 되고, 704 compareEquivalentVolumes(undefined, undefined)에서 duty.unitPrice 접근으로 TypeError가 납니다. 이 파일은 'use client' 최상위 라우트 컴포넌트라 SSR·CSR 모두 여기서 던지고, 페이지 자체가 렌더되지 않습니다(에러 화면). 즉 C1에서 baseOffers 제거는 '빈 화면'이 아니라 '페이지 전체 크래시'입니다. |
| `C2` | `app/page.tsx:651` | state-outcome | hasVerifiedComparison(651) — verifiedOffers에 retail이 없어 false → 672에서 verifiedOffers 통째로 폐기 | **unguarded** | 검수된 면세 가격이 비교 영역에 아예 등장하지 않습니다. 651이 false라 672에서 verifiedOffers 전체가 버려지고 offers=baseOffers(예시)로 대체되며, trustedCosmeticOffers(677)가 비어 hasTrustedCosmeticsComparison=false → 상단·본문 모두 pending 카드입니다. verifiedDutySourceCount(694)는 0. 그 면세 검수가는 오직 '확인된 가격 전체 보기' 피드(1257-1318) 카드로만 보입니다. |
| `C3` | `app/page.tsx:672` | state-outcome | hasVerifiedComparison(651) — duty가 없어 false → 672에서 verifiedOffers 폐기 | **unguarded** | C2의 대칭. 검수 국내가가 비교에서 사라지고 offers=baseOffers(예시)만 남아 pending 카드 2종만 보입니다. verifiedRetailSourceCount(699)는 0이고, 검수 국내가는 검수 가격 피드 카드에만 노출됩니다. 사용자 입장에서는 '가격을 하나 확인했는데도 아무 것도 반영되지 않는' 상태입니다. |
| `C4` | `app/page.tsx:685` | state-outcome | hasTrustedCosmeticsComparison(685) ← trustedCosmeticOffers(677)에 captured만 존재 | **unguarded** | 캡처가 면세·국내 양쪽 채널로 있으면 공개 결론이 전부 켜집니다: 체리픽 헤드라인(1166), 절약액(1180/1394), N% 차이(1399), 환산 막대(1489), 상세표(1517). 즉 운영자 검수 없이 사용자 캡처만으로 공개용 헤드라인·절약액이 만들어집니다. 이때 상세표에는 baseOffers 예시 2행('온라인 면세 예시')도 함께 섞여 나오고, source-card는 '직접 확인 가격 반영'(1588)으로 표시됩니다. 캡처가 한쪽 채널뿐이면 hasTrusted=false로 pending이 되며, 반대편은 예시 baseOffers가 bestDuty/bestRetail로 조용히 대입됩니다(689/693). |
| `C5` | `app/page.tsx:672` | state-outcome | hasVerifiedComparison(651)=false → 검수 면세 폐기; trustedBestDuty(680)=undefined → hasTrustedCosmeticsComparison(685)=false | **unguarded** | 결론: 오늘 공개 헤드라인도 절약액도 생성되지 않습니다. 검수 면세가는 651이 false라 672에서 폐기되고, trustedCosmeticOffers에는 캡처 국내가만 남아 trustedBestDuty가 undefined → pending 카드('면세점과 국내 판매처에서 검수된 가격이 각각 한 건 이상 모이면…', 1617-1620)만 보입니다. 사용자가 실제로 보는 것: 절약액 없음, %도 없음, 상세표 없음, 판매처 수 없음. 그런데도 내부적으로 bestDuty는 base-duty 예시(689)로 대체되어 comparison/quickDecision/dutyDecision이 예시가 기반으로 계속 계산됩니다 — 렌더 게이트만 그것을 가려주고 있습니다. |
| `C6` | `app/page.tsx:681` | state-outcome | hasVerifiedComparison(651)=false → 검수 국내가 폐기; selectDomesticRepresentative(681→294-316)가 retail 채널만 보므로 trustedBestRetail=undefined | **unguarded** | C5의 대칭이고 결론도 동일합니다: 공개 헤드라인·절약액 모두 생성되지 않습니다. 검수 국내가는 672에서 폐기되고 trustedCosmeticOffers에는 캡처 면세(duty)만 남는데, 681의 selectDomesticRepresentative는 channel==='retail'만 필터하므로 undefined를 돌려주어 hasTrustedCosmeticsComparison=false → pending 카드만 노출됩니다. 내부적으로는 bestRetail이 base-retail 예시(693)로 대체되어 계산이 계속됩니다. |
| `C7` | `app/page.tsx:704` | state-outcome | hasVerifiedComparison(651)=true → hasTrustedCosmeticsComparison(685)=true; compareEquivalentVolumes(704→app/lib/pricing.ts:159-179)에는 unit/currency/variant 검사가 없음 | **unguarded** | 오늘은 불일치를 전혀 감지하지 못하고 정상 결론처럼 그대로 노출합니다. 704의 compareEquivalentVolumes는 duty.unitPrice × retail.volume만 곱하고 단위·통화·규격을 검사하지 않아, ml vs g처럼 단위가 다르면 의미 없는 숫자가 '면세 환산가가 N원 낮아요'(1390-1396)와 'N% 차이'(1399), 환산 막대(1492)로 확신 있게 표시됩니다. app/lib/pricing.ts에 checkComparablePair(187)/buildVerifiedComparison(227)/selectVerifiedComparison(259)가 이미 있지만 page.tsx의 import 목록(18-28)에 없어 호출되지 않습니다. 통화는 PublishedOffer 타입(app/lib/price-store.ts:13-37)에 필드 자체가 없고, variant는 productId 필터(633)로만 우연히 방어됩니다. 실패 사유 안내 UI도 없습니다. |
| `C8` | `app/page.tsx:1346` | state-outcome | hasTrustedCosmeticsComparison(685)=true (검수 duty·retail 모두 존재) | **guarded** | 정상 경로. 체리픽 헤드라인(1166)과 면세/국내 두 장의 결정 카드·금액(1180), 결론 문구와 절약액(1385-1396), N% 차이(1399), 면세 N곳/국내 N곳 판매처 수 배지(1434/1458), 동일 용량 환산 카드(1480-1496), '가격 계산 자세히 보기' 상세표(1517-1575)가 모두 노출되고, source-card는 '운영자 검수 가격 반영'(1590)으로 표시됩니다. |
| `L1` | `app/page.tsx:747` | state-outcome | hasVerifiedLiquorComparison(726)=false → 729-777이 하드코딩 liquors 테이블(201-266)로 폴백 | **unguarded** | 상단은 pending 카드(1209-1223), 주류 섹션은 comparison-pending-card compact('면세 가격을 확인 중입니다', 1750-1757)이며 '국내 픽업 가격은 0곳에서 확인됐습니다'로 표시됩니다. 절약액·verdict·reason은 렌더되지 않습니다. 다만 liquorDutyPrice~liquorSaving·liquorVerdict(729-777)은 하드코딩 예시값(예: 89,000/109,900)으로 계속 계산되고, dutyDecision.source는 옵셔널 체이닝으로 '면세 가격 확인 중'(853)이 되어 크래시는 없습니다. 주류 경로는 baseOffers와 무관하므로 baseOffers 제거의 영향을 받지 않습니다. |
| `L2` | `app/page.tsx:1752` | state-outcome | hasVerifiedLiquorComparison(726)=false (bestVerifiedLiquorRetail(722)=undefined) | **guarded** | 결론은 안 나오고, 게다가 안내 문구가 반대로 나옵니다. 실제로 빠진 쪽은 국내인데 카드 제목은 '면세 가격을 확인 중입니다'로 하드코딩되어 있고(1752), 본문은 '국내 픽업 가격은 0곳에서 확인됐습니다'(1754)라고 말합니다. 아래 링크 목록(1758-1777)은 retail 검수건만 매핑하므로 비어 있습니다. 확보된 면세 검수가는 이 섹션에 전혀 안 보이고 상단 검수 가격 피드에만 노출됩니다. |
| `L3` | `app/page.tsx:1701` | state-outcome | hasVerifiedLiquorComparison(726)=false (bestVerifiedLiquorDuty(718)=undefined) | **guarded** | 동일한 compact pending 카드가 뜨지만 이 상태에서는 카피가 맞습니다: '면세 가격을 확인 중입니다' + '국내 픽업 가격은 N곳에서 확인됐습니다'(liquorRetailSourceCount, 755). 검수된 국내 픽업 오퍼들이 판매처명·최종가·수령점과 함께 원본 링크 카드로 나열됩니다(1758-1777). 절약액·verdict는 없습니다. |
| `L4` | `app/page.tsx:656` | state-outcome | capturedOffers는 productId가 cosmetics 항목일 때만 저장·소비됨(656, 940, 975) — 주류 catalogId와 매칭되는 경로 없음 | **n/a** | 주류에는 캡처 입력 경로가 아예 없습니다. handleCapture는 cosmetics 목록에 없는 productId를 거부하고(940) 저장 후 setCategory('cosmetics')로 강제 전환하며(981), offers의 userOffers 필터도 cosmetics product.id 기준(656)입니다. 따라서 사용자가 캡처를 아무리 넣어도 주류 화면은 L1과 완전히 동일합니다(compact pending 카드, 국내 0곳). |
| `L5` | `app/page.tsx:747` | state-outcome | hasVerifiedLiquorComparison(726)=true → liquorSaving(747)=liquorRetailPrice − liquorDutyUnitPrice × liquorRetailVolume | **guarded** | 결론이 전부 노출됩니다: 면세/국내 두 카드에 판매처명·용량·최종가·100ml 단가(1703-1736), '면세 N원 절약/차이' 또는 '국내 N원 절약' 배지(1739-1743), verdict 제목(1745)과 사유 문장(1746), '운영자 검수 · 면세 N곳 / 국내 N곳 비교 최저'(1716/1733), 그리고 상단 체리픽 헤드라인(currentComparisonReady=true). 다만 747의 liquorSaving에도 단위·통화·규격 검사가 없어 unit이 'ml'이 아니어도 100ml 단가로 표기됩니다(1712/1729). |
| `hasVerifiedComparison` | `app/page.tsx:651` | predicate | verifiedOffers(628-650) = publishedOffers 중 !reference && category==='cosmetics' && productId===product.catalogId | **unguarded** | 정의: verifiedOffers.some(channel==='duty') && verifiedOffers.some(channel==='retail'). offers useMemo 내부의 지역 변수라 외부로 노출되지 않습니다. 이 값이 false면 672에서 검수 오퍼를 하나도 안 쓰고 baseOffers(예시)로 통째 대체합니다 — 부분 검수 데이터(C2/C3/C5/C6)가 전부 버려지는 원인이자, baseOffers 제거 시 offers가 빈 배열이 되는 지점입니다. |
| `hasTrustedCosmeticsComparison` | `app/page.tsx:685` | predicate | trustedBestDuty(680)=selectBestUnitOffer(trustedCosmeticOffers,'duty'), trustedBestRetail(681)=selectDomesticRepresentative(trustedCosmeticOffers), trustedCosmeticOffers(677)=offers 중 verified\|\|captured | **unguarded** | 정의: Boolean(trustedBestDuty && trustedBestRetail). 화장품 본문 섹션의 렌더 게이트(1346)이자 currentComparisonReady의 화장품 분기(762)입니다. false여도 그 아래 bestDuty(689)/bestRetail(693)/comparison(704)/quickDecision(802)/dutyDecision·retailDecision(848-874)은 게이트 밖에서 계속 계산되므로, 이 술어는 '표시'만 막을 뿐 '계산'은 막지 못합니다. |
| `currentComparisonReady` | `app/page.tsx:760` | predicate | category(340) 및 hasTrustedCosmeticsComparison(685) / hasVerifiedLiquorComparison(726) | **unguarded** | 정의: category==='cosmetics' ? hasTrustedCosmeticsComparison : hasVerifiedLiquorComparison. 상단 체리픽 quick-decision 섹션의 단일 렌더 게이트(1158)이며, false면 pending 카드(1209)로 대체됩니다. 다만 게이트가 소비하는 quickDecision·dutyDecision·retailDecision 객체는 게이트보다 앞(802/848/863)에서 무조건 생성되므로, 게이트가 false여도 그 생성 과정에서 bestDuty/bestRetail을 역참조합니다. |
| `hasVerifiedLiquorComparison` | `app/page.tsx:726` | predicate | bestVerifiedLiquorDuty(718)/bestVerifiedLiquorRetail(722) = selectBestUnitOffer(verifiedLiquorOffers, ...), verifiedLiquorOffers(713-717)=publishedOffers 중 !reference && category==='liquor' && productId===liquor.catalogId | **unguarded** | 정의: Boolean(bestVerifiedLiquorDuty && bestVerifiedLiquorRetail). 주류 가격 블록의 렌더 게이트(1701)이자 currentComparisonReady의 주류 분기(763). 화장품 경로와 달리 후속 파생값(729-777)이 모두 이 술어의 삼항 분기로 감싸져 있고 non-null 단언(!)은 true 분기에서만 쓰이므로, 주류 경로는 이미 null-safe합니다. 대신 false일 때 하드코딩 liquors 테이블 값으로 폴백해 '조용한 예시가격'이 계산됩니다. |

**비고**

핵심 결론 3가지.

(1) C5·C6에서 공개 헤드라인과 절약액은 오늘 생성되지 않습니다. 이유는 app/page.tsx:651의 hasVerifiedComparison이 duty·retail 둘 다 있어야만 true가 되고, false면 672에서 검수 오퍼 배열 전체를 버리고 baseOffers로 대체하기 때문입니다. 그 결과 C5는 trustedBestDuty가, C6은 trustedBestRetail이 undefined가 되어 hasTrustedCosmeticsComparison(685)이 false → pending 카드만 렌더됩니다. 다만 '표시되지 않을 뿐 계산은 진행'되며, 빠진 쪽은 base-duty/base-retail 예시가로 조용히 대체됩니다(689/693).

(2) C1에서 baseOffers를 제거하면 페이지가 렌더되지 않습니다. offers=[] → bestDuty=offers[0]=undefined, bestRetail=offers[1]=undefined → app/page.tsx:704 compareEquivalentVolumes(undefined, undefined)가 app/lib/pricing.ts:163에서 duty.unitPrice를 읽다가 TypeError를 던집니다. 렌더 게이트(1158/1346)는 704보다 뒤에 있어 아무 보호도 못 합니다. 704를 넘긴다 해도 705(bestRetail.total), 852/860/867(dutyDecision·retailDecision)이 연쇄로 터집니다. 'use client'이지만 Next는 클라이언트 컴포넌트도 SSR하므로 서버 렌더와 하이드레이션 모두 실패합니다. 따라서 리메디에이션 PR은 704 이전에 bestDuty/bestRetail을 null 허용으로 바꾸고, 704/705/848-874/802-815를 전부 null-safe 형태로 전환해야 합니다. 반대로 주류 경로(726-777, 853/868)는 이미 삼항 폴백과 ?.로 감싸져 있어 수정 대상이 아닙니다.

(3) C7(단위·통화·규격 불일치)은 오늘 아무 방어도 없습니다. app/lib/pricing.ts에 checkComparablePair(187)·buildVerifiedComparison(227)·selectVerifiedComparison(259)와 ComparabilityFailure 타입(67-73)이 이미 작성돼 있지만(현재 워킹트리 미커밋 변경분), app/page.tsx의 import(18-28)는 compareEquivalentVolumes와 selectBestUnitOffer만 가져오므로 계약이 한 번도 호출되지 않습니다. 게다가 통화는 PublishedOffer 타입(app/lib/price-store.ts:13-37)에 필드가 존재하지 않고 variantKey도 없어, 현재 데이터 모델로는 currency-mismatch/variant-mismatch를 표현조차 할 수 없습니다(변형 일치는 633/716의 productId 필터로만 간접 방어). 따라서 C7은 C8과 구분되지 않고 확신에 찬 절약액을 그대로 노출합니다.

부수 관찰. (a) C4에서 사용자 캡처만으로 hasTrustedCosmeticsComparison이 true가 되어(677에서 verified||captured를 동등 취급) 검수 없이도 공개 헤드라인·절약액이 만들어집니다. (b) L2는 실제로 빠진 쪽이 국내인데 pending 카드 제목이 '면세 가격을 확인 중입니다'로 하드코딩되어(1752) 반대로 안내합니다. (c) C2/C3/C5/C6에서 확보된 검수 가격이 비교 영역에서 완전히 사라지고 상단 검수 가격 피드(1257-1318)에만 남는 것도 사용자 관점의 손실입니다.

참고: 이 조사 중 app/lib/pricing.ts가 세션 시작 시점(189줄)과 조사 시점(320줄)에 다르게 읽혔습니다. git status 기준 app/lib/pricing.ts는 워킹트리 수정 상태(+131줄)이고 app/page.tsx는 HEAD와 동일하므로, 위 page.tsx 줄번호는 모두 현재 파일에서 직접 읽은 값입니다. 아무 파일도 수정하지 않았습니다.

