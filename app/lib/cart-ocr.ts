import type { Channel, Unit } from "./pricing";

export type OcrCatalogItem = {
  id: string;
  brand: string;
  name: string;
  unit: Unit;
  defaultVolume: number;
};

/** 사용자 확인 없이 자동 확정하면 안 되는 이유. */
export type CartOcrAmbiguity =
  | "installment-detected"
  | "quantity-detected"
  | "total-composition-unclear"
  /** 캡처에 상품이 둘 이상이다. 어느 행의 가격인지 사람이 골라야 한다. */
  | "multiple-products"
  /** 서로 다른 채널의 판매처가 함께 보인다. 비교 화면 캡처일 수 있다. */
  | "seller-conflict";

/**
 * 값이 어디서 왔는지.
 *
 * `"recognized"` 만 인식 성공으로 센다. 예전에는 카탈로그 기본 용량을
 * 채워 넣고도 "용량 인식 완료"라고 표시해, 1,000ml 를 50ml 로 저장하고
 * 사용자에게는 성공이라고 말했다(H-07).
 *
 * `"defaulted"` 상태는 만들지 않는다 — 기본값으로 채우는 동작 자체를
 * 없앴으므로, 그 값을 표현할 수 있게 두면 도달하지 않는 분기가 된다.
 */
export type FieldProvenance = "recognized" | "unknown";

export type CartOcrProvenance = {
  sourceName: FieldProvenance;
  productId: FieldProvenance;
  price: FieldProvenance;
  shipping: FieldProvenance;
  discount: FieldProvenance;
  volume: FieldProvenance;
};

/**
 * OCR 이 읽은 한 줄. `top` 은 이미지 세로 좌표다.
 *
 * 평평한 문자열만 받던 때는 "이 금액이 어느 상품 아래에 있는가"를 물을 수
 * 없었고, 그래서 장바구니에 상품이 둘이면 다른 행의 가격이 현재 상품에
 * 붙었다(H-06).
 */
export type OcrLine = { text: string; top: number };

/** 캡처에서 찾은 상품 후보 하나. */
export type OcrProductCandidate = {
  id: string;
  /** 이 상품 이름이 나온 줄. 금액을 어느 상품에 붙일지 정하는 기준점이다. */
  lineIndex: number;
};

export type CartOcrResult = {
  sourceName: string | null;
  channel: Channel | null;
  productId: string | null;
  /**
   * 캡처에서 찾은 모든 상품. 둘 이상이면 `productId` 는 null 이고
   * UI 가 이 목록으로 선택을 요구해야 한다.
   */
  productCandidates: OcrProductCandidate[];
  price: number | null;
  /** 읽지 못했으면 null. 0으로 단정하지 않는다. */
  shipping: number | null;
  discount: number | null;
  volume: number | null;
  confidence: number;
  usedFinalPrice: boolean;
  recognizedFields: string[];
  provenance: CartOcrProvenance;
  /** 비어 있을 때만 자동 확정할 수 있다. */
  ambiguities: CartOcrAmbiguity[];
};

const sellerPatterns: Array<{
  pattern: RegExp;
  sourceName: string;
  channel: Channel;
}> = [
  { pattern: /쿠팡|coupang/i, sourceName: "쿠팡", channel: "retail" },
  {
    pattern: /올리브\s*영|olive\s*young/i,
    sourceName: "올리브영",
    channel: "retail",
  },
  {
    pattern: /롯데\s*(인터넷)?\s*면세|lotte\s*duty/i,
    sourceName: "롯데면세점",
    channel: "duty",
  },
  {
    pattern: /신라\s*(인터넷)?\s*면세|shilla\s*duty/i,
    sourceName: "신라면세점",
    channel: "duty",
  },
  {
    pattern: /신세계\s*(인터넷)?\s*면세|shinsegae\s*duty/i,
    sourceName: "신세계면세점",
    channel: "duty",
  },
  {
    pattern: /현대\s*(인터넷)?\s*면세|hyundai\s*duty/i,
    sourceName: "현대면세점",
    channel: "duty",
  },
  {
    pattern: /데일리샷|daily\s*shot/i,
    sourceName: "데일리샷",
    channel: "retail",
  },
  { pattern: /포켓\s*cu|pocket\s*cu/i, sourceName: "포켓CU", channel: "retail" },
  {
    pattern: /와인25|wine25|gs25/i,
    sourceName: "GS25 와인25플러스",
    channel: "retail",
  },
];

/**
 * 최종 결제가 키워드.
 *
 * 예전 패턴은 모든 그룹이 optional이라 `최종` 한 단어만 있어도 매칭됐다.
 * 그래서 "최종 배송지 서울시 강남구 12345"가 최종가 줄로 잡혔다.
 * 이제 `최종`·`총` 뒤에는 반드시 `결제/결재`가 와야 한다.
 */
const finalPriceKeywords =
  /(?:최종|총)\s*(?:결제|결재)\s*(?:금액|가격)?|결제\s*(?:예정|예상)\s*금액|order\s*total|total\s*payment/i;
const productPriceKeywords =
  /상품\s*(?:금액|가격|합계)|판매가|회원가|쿠폰가|할인가|주문\s*금액|product\s*total/i;
const shippingKeywords = /배송비|배송\s*요금|shipping/i;
const discountKeywords = /총\s*할인|쿠폰\s*할인|할인\s*(?:금액|합계)|discount/i;

/**
 * 할부 안내 문맥. 여기 붙은 금액은 결제 총액이 아니다.
 *
 * 마커는 금액 **앞**에 온다("12개월 무이자 할부 시 월 7,233원"). 뒤까지
 * 넓게 보면 같은 줄의 총액("86,800원 (12개월 …")까지 할부금으로 걸러진다.
 */
const installmentBefore = /할부|무이자|개월|월\s*$/;
/** 뒤에 붙는 형태는 "/월" 정도만 본다. */
const installmentAfter = /^\s*\/\s*월/;
/** 수량·묶음 표기. 단품 가격으로 단정할 수 없다. */
const quantityMarkers = /수량\s*[2-9]|[2-9]\s*개(?!월)|\d\s*\+\s*\d|[x×]\s*[2-9]/;

/**
 * 금액 토큰.
 *
 * 통화 표기(원·₩·￦·KRW)가 반드시 있어야 금액으로 본다. 예전에는 맨숫자
 * 4~8자리를 금액으로 받아 우편번호·주문번호·전화번호 조각이 가격이 됐다.
 * 앞뒤 숫자 경계도 확인해 긴 숫자열 안의 일부를 잘라내지 않는다.
 */
const moneyPattern =
  /(?<![\d,.])(?:(?:₩|￦)\s*)?(\d{1,3}(?:,\d{3})+|\d+)\s*(?:원|krw)(?![\d,.])|(?:₩|￦)\s*(\d{1,3}(?:,\d{3})+|\d+)(?![\d,.])/gi;

type MoneyToken = { value: number; index: number };

function moneyTokens(text: string): MoneyToken[] {
  const tokens: MoneyToken[] = [];
  for (const match of text.matchAll(moneyPattern)) {
    const raw = match[1] ?? match[2];
    if (!raw) continue;
    const value = Number(raw.replace(/,/g, ""));
    if (Number.isSafeInteger(value) && value >= 100 && value <= 50_000_000) {
      tokens.push({ value, index: match.index ?? 0 });
    }
  }
  return tokens;
}

/** 토큰 바로 앞이 할부 안내인지 본다. */
function isInstallmentToken(text: string, token: MoneyToken): boolean {
  const before = text.slice(Math.max(0, token.index - 16), token.index);
  const tokenEnd = text.indexOf("원", token.index);
  const after = text.slice(tokenEnd < 0 ? token.index : tokenEnd + 1);
  return installmentBefore.test(before) || installmentAfter.test(after);
}

/**
 * 키워드에 **인접한** 금액을 고른다.
 *
 * 예전에는 줄의 마지막 금액을 골랐다. 한국 결제화면은 총액 뒤에 월 할부금을
 * 덧붙이는 경우가 많아, "최종 결제금액 86,800원 (12개월 무이자 할부 시
 * 월 7,233원)" 에서 7,233원이 결제가로 들어갔다.
 */
/**
 * 키워드가 있는 줄을 훑을 순서를 정한다.
 *
 * 기준점(상품 이름이 나온 줄)이 있으면 **거기서 가장 가까운 줄부터** 본다.
 * 없으면 예전처럼 아래에서 위로 — 장바구니 합계는 맨 아래에 있다.
 *
 * 아래에서 위로만 훑으면 장바구니 **밑에 붙는 추천 상품 띠**가 이긴다.
 * 그 띠의 카드에도 `판매가` 가 붙어 있고, 카탈로그에 없는 상품이라
 * 상품 중복 판정(H-06)에도 걸리지 않는다. 그래서 179,000원짜리 에센스가
 * 띠에 있던 12,900원으로 저장됐다 — 모호성 표시 없이, 신뢰도 100으로.
 */
function searchOrder(lines: string[], anchor: number | null): number[] {
  const indexes = lines.map((_, index) => index);
  if (anchor === null) return indexes.reverse();
  return indexes.sort(
    (a, b) => Math.abs(a - anchor) - Math.abs(b - anchor) || a - b,
  );
}

function amountForKeyword(
  lines: string[],
  pattern: RegExp,
  anchor: number | null = null,
): { value: number; sawInstallment: boolean } | null {
  for (const index of searchOrder(lines, anchor)) {
    const line = lines[index];
    const match = pattern.exec(line);
    if (!match) continue;

    const tokens = moneyTokens(line);
    if (tokens.length === 0) continue;

    const keywordEnd = (match.index ?? 0) + match[0].length;
    const sawInstallment = tokens.some((token) =>
      isInstallmentToken(line, token),
    );
    const usable = tokens.filter((token) => !isInstallmentToken(line, token));
    if (usable.length === 0) continue;

    const afterKeyword = usable.filter((token) => token.index >= keywordEnd);
    const chosen = (afterKeyword[0] ?? usable[0]).value;

    return { value: chosen, sawInstallment };
  }
  return null;
}

function compact(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "");
}

const PRODUCT_MATCH_THRESHOLD = 0.42;

/** 한 덩어리의 텍스트가 카탈로그 항목과 얼마나 맞는지. */
function productScore(text: string, item: OcrCatalogItem): number {
  const compactText = compact(text);
  const brand = compact(item.brand);
  const name = compact(item.name);
  const nameTokens = item.name
    .normalize("NFKC")
    .toLowerCase()
    .split(/[^a-z0-9가-힣]+/)
    .map(compact)
    .filter((token) => token.length >= 2);
  const matchedTokens = nameTokens.filter((token) => compactText.includes(token));
  const tokenScore =
    nameTokens.length > 0 ? matchedTokens.length / nameTokens.length : 0;

  return (
    (brand && compactText.includes(brand) ? 0.25 : 0) +
    (name && compactText.includes(name) ? 0.75 : tokenScore * 0.75)
  );
}

/**
 * 캡처에 등장하는 상품을 **줄 단위로** 전부 찾는다.
 *
 * 예전에는 전체 텍스트를 한 덩어리로 채점해 가장 점수가 높은 항목 하나만
 * 돌려줬다. 그러면 장바구니에 상품이 둘일 때 나머지 하나가 통째로 사라지고,
 * 그 상품의 가격은 남은 하나에 붙었다(H-06).
 *
 * 상품 이름이 두 줄에 걸치는 경우가 있어 인접한 줄을 함께 본다.
 */
function findProductCandidates(
  lines: string[],
  catalog: OcrCatalogItem[],
): OcrProductCandidate[] {
  const best = new Map<string, { score: number; lineIndex: number }>();

  for (let index = 0; index < lines.length; index += 1) {
    // 한 줄과 그 다음 줄까지를 한 후보 덩어리로 본다.
    const window = [lines[index], lines[index + 1] ?? ""].join(" ");
    for (const item of catalog) {
      const score = productScore(window, item);
      if (score < PRODUCT_MATCH_THRESHOLD) continue;
      const previous = best.get(item.id);
      if (!previous || score > previous.score) {
        best.set(item.id, { score, lineIndex: index });
      }
    }
  }

  return [...best.entries()]
    .map(([id, { lineIndex }]) => ({ id, lineIndex }))
    .sort((a, b) => a.lineIndex - b.lineIndex);
}

type SellerHit = {
  sourceName: string;
  channel: Channel;
  lineIndex: number;
};

/**
 * 캡처에 보이는 판매처를 전부 찾아 등장 위치와 함께 돌려준다.
 *
 * 예전에는 `sellerPatterns.find(...)` 로 **패턴 목록 순서상** 첫 번째를
 * 골랐다. 텍스트 어디에 있는지는 보지 않으므로, 비교 화면 캡처처럼 두
 * 판매처가 같이 보이면 목록에서 앞선 쪽이 이겼다 — 화면과 무관하게(L-16).
 */
function findSellers(lines: string[]): SellerHit[] {
  const hits: SellerHit[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    for (const { pattern, sourceName, channel } of sellerPatterns) {
      if (!pattern.test(lines[index])) continue;
      if (hits.some((hit) => hit.sourceName === sourceName)) continue;
      hits.push({ sourceName, channel, lineIndex: index });
    }
  }
  return hits;
}

/** 상품 기준점에 가장 가까운 판매처를 고른다. 기준점이 없으면 문서 순서 첫 번째. */
function pickSeller(hits: SellerHit[], anchor: number | null): SellerHit | null {
  if (hits.length === 0) return null;
  if (anchor === null) return hits[0];
  return [...hits].sort(
    (a, b) =>
      Math.abs(a.lineIndex - anchor) - Math.abs(b.lineIndex - anchor) ||
      a.lineIndex - b.lineIndex,
  )[0];
}

function inferVolume(text: string, item: OcrCatalogItem | null): number | null {
  if (!item) return null;
  const unitPattern =
    item.unit === "ml" ? "m[l1]|㎖" : item.unit === "g" ? "g|그램" : "개|ea";
  // 1,000ml 처럼 천 단위 구분자가 붙은 표기도 읽는다.
  const volumePattern = new RegExp(
    `(\\d{1,3}(?:,\\d{3})+|\\d+(?:[.]\\d+)?)\\s*(?:${unitPattern})`,
    "gi",
  );
  const values = [...text.matchAll(volumePattern)]
    .map((match) => Number(match[1].replace(/,/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 10_000);
  // 읽지 못하면 카탈로그 기본값으로 채우지 않는다. 기본값을 인식 성공으로
  // 계상하면 1,000ml 를 50ml 로 저장하고도 "용량 인식 완료"라고 표시된다.
  if (values.length === 0) return null;

  return values.sort(
    (a, b) => Math.abs(a - item.defaultVolume) - Math.abs(b - item.defaultVolume),
  )[0];
}

function amountOnLine(
  lines: string[],
  pattern: RegExp,
  anchor: number | null = null,
): number | null {
  const index = searchOrder(lines, anchor).find((candidate) =>
    pattern.test(lines[candidate]),
  );
  if (index === undefined) return null;
  const line = lines[index];
  if (/무료|free/i.test(line)) return 0;
  const tokens = moneyTokens(line).filter(
    (token) => !isInstallmentToken(line, token),
  );
  return tokens.at(-1)?.value ?? null;
}

/** 평평한 텍스트를 줄 목록으로. 좌표가 없으면 순서만으로 근접도를 잰다. */
export function linesFromText(text: string): OcrLine[] {
  return text
    .normalize("NFKC")
    .split(/\r?\n/)
    .map((line, index) => ({ text: line.trim(), top: index }))
    .filter((line) => line.text.length > 0);
}

export function extractCartFields(
  input: string | readonly OcrLine[],
  catalog: OcrCatalogItem[],
): CartOcrResult {
  const ocrLines =
    typeof input === "string"
      ? linesFromText(input)
      : [...input]
          .map((line) => ({ text: line.text.normalize("NFKC").trim(), top: line.top }))
          .filter((line) => line.text.length > 0)
          .sort((a, b) => a.top - b.top);
  const lines = ocrLines.map((line) => line.text);
  const normalizedText = lines.join("\n");

  const candidates = findProductCandidates(lines, catalog);
  const multipleProducts = candidates.length > 1;
  // 상품이 둘 이상이면 어느 것인지 코드가 정하지 않는다. 고르면 반드시
  // 절반은 틀리고, 틀린 쪽은 다른 상품의 가격을 이 상품에 붙인다.
  const chosen = multipleProducts ? null : (candidates[0] ?? null);
  const product = chosen
    ? (catalog.find((item) => item.id === chosen.id) ?? null)
    : null;

  /**
   * 금액을 찾을 범위.
   *
   * 상품이 하나면 캡처 전체다. 둘 이상이면 어느 상품인지 정하지 못했으므로
   * 어떤 범위도 안전하지 않다 — 금액을 읽지 않는다.
   */
  const searchLines = multipleProducts ? [] : lines;

  const sellerHits = findSellers(lines);
  const seller = pickSeller(sellerHits, chosen?.lineIndex ?? null);
  // 채널이 서로 다른 판매처가 함께 보이면 비교 화면일 수 있다. 어느 쪽
  // 가격인지는 사람이 확인해야 한다.
  const sellerConflict =
    new Set(sellerHits.map((hit) => hit.channel)).size > 1;

  const anchor = chosen?.lineIndex ?? null;
  // 장바구니 합계는 맨 아래에 있으므로 기준점을 쓰지 않는다. 나머지는
  // 상품 줄에 가장 가까운 값을 쓴다 — 그러지 않으면 장바구니 밑의 추천
  // 상품 띠가 이긴다.
  const finalPrice = amountForKeyword(searchLines, finalPriceKeywords);
  const productPrice = amountForKeyword(searchLines, productPriceKeywords, anchor);
  const shippingOnLine = amountOnLine(searchLines, shippingKeywords, anchor);
  const discountOnLine = amountOnLine(searchLines, discountKeywords, anchor);
  // 용량도 상품 줄 주변에서만 읽는다. 캡처 전체를 보면 추천 띠에 있는 다른
  // 상품의 용량이, 카탈로그 기본값에 더 가깝다는 이유만으로 이긴다.
  const volume =
    product && anchor !== null
      ? inferVolume(lines.slice(anchor, anchor + 2).join(" "), product)
      : null;

  const usedFinalPrice = finalPrice !== null;
  const price = finalPrice?.value ?? productPrice?.value ?? null;

  const ambiguities: CartOcrAmbiguity[] = [];
  if (multipleProducts) ambiguities.push("multiple-products");
  if (sellerConflict) ambiguities.push("seller-conflict");
  if (finalPrice?.sawInstallment || productPrice?.sawInstallment) {
    ambiguities.push("installment-detected");
  }
  if (quantityMarkers.test(normalizedText)) {
    ambiguities.push("quantity-detected");
  }

  // 최종가는 배송비·할인을 이미 포함하므로 구성요소를 다시 빼면 이중 차감이
  // 된다. 다만 "포함한다"는 가정이 성립하는지 확인할 수 있을 때만 0으로 둔다.
  let shipping: number | null;
  let discount: number | null;
  if (usedFinalPrice) {
    shipping = 0;
    discount = 0;
    if (productPrice !== null) {
      const composed =
        productPrice.value + (shippingOnLine ?? 0) - (discountOnLine ?? 0);
      if (composed !== finalPrice.value) {
        ambiguities.push("total-composition-unclear");
      }
    }
  } else {
    shipping = shippingOnLine;
    discount = discountOnLine;
  }

  // provenance 는 실제로 읽은 값에서 유도한다. 인식했다는 주장과 값이
  // 따로 놀 자리를 남기지 않는다.
  const provenance: CartOcrProvenance = {
    sourceName: seller ? "recognized" : "unknown",
    productId: product ? "recognized" : "unknown",
    price: price !== null ? "recognized" : "unknown",
    shipping: shipping !== null ? "recognized" : "unknown",
    discount: discount !== null ? "recognized" : "unknown",
    volume: volume !== null ? "recognized" : "unknown",
  };

  const recognizedFields = [
    provenance.sourceName === "recognized" ? "판매처" : "",
    provenance.productId === "recognized" ? "상품" : "",
    provenance.price === "recognized" ? "가격" : "",
    provenance.volume === "recognized" ? "용량" : "",
  ].filter(Boolean);
  const confidence = Math.round(
    ((provenance.sourceName === "recognized" ? 0.2 : 0) +
      (provenance.productId === "recognized" ? 0.3 : 0) +
      (provenance.price === "recognized" ? 0.35 : 0) +
      (provenance.volume === "recognized" ? 0.15 : 0)) *
      100,
  );

  return {
    sourceName: seller?.sourceName ?? null,
    channel: seller?.channel ?? null,
    productId: product?.id ?? null,
    productCandidates: candidates,
    price,
    shipping,
    discount,
    volume,
    confidence,
    usedFinalPrice,
    recognizedFields,
    provenance,
    ambiguities,
  };
}
