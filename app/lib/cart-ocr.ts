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
  | "total-composition-unclear";

export type CartOcrResult = {
  sourceName: string | null;
  channel: Channel | null;
  productId: string | null;
  price: number | null;
  /** 읽지 못했으면 null. 0으로 단정하지 않는다. */
  shipping: number | null;
  discount: number | null;
  volume: number | null;
  confidence: number;
  usedFinalPrice: boolean;
  recognizedFields: string[];
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
function amountForKeyword(
  lines: string[],
  pattern: RegExp,
): { value: number; sawInstallment: boolean } | null {
  for (const line of [...lines].reverse()) {
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

function inferProduct(
  normalizedText: string,
  catalog: OcrCatalogItem[],
): OcrCatalogItem | null {
  const compactText = compact(normalizedText);
  let best: { item: OcrCatalogItem; score: number } | null = null;

  for (const item of catalog) {
    const brand = compact(item.brand);
    const name = compact(item.name);
    const nameTokens = item.name
      .normalize("NFKC")
      .toLowerCase()
      .split(/[^a-z0-9가-힣]+/)
      .map(compact)
      .filter((token) => token.length >= 2);
    const matchedTokens = nameTokens.filter((token) =>
      compactText.includes(token),
    );
    const tokenScore =
      nameTokens.length > 0 ? matchedTokens.length / nameTokens.length : 0;
    const score =
      (brand && compactText.includes(brand) ? 0.25 : 0) +
      (name && compactText.includes(name) ? 0.75 : tokenScore * 0.75);

    if (!best || score > best.score) best = { item, score };
  }

  return best && best.score >= 0.42 ? best.item : null;
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

function amountOnLine(lines: string[], pattern: RegExp): number | null {
  const line = lines.find((candidate) => pattern.test(candidate));
  if (!line) return null;
  if (/무료|free/i.test(line)) return 0;
  const tokens = moneyTokens(line).filter(
    (token) => !isInstallmentToken(line, token),
  );
  return tokens.at(-1)?.value ?? null;
}

export function extractCartFields(
  text: string,
  catalog: OcrCatalogItem[],
): CartOcrResult {
  const normalizedText = text.normalize("NFKC");
  const lines = normalizedText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const seller = sellerPatterns.find(({ pattern }) =>
    pattern.test(normalizedText),
  );
  const product = inferProduct(normalizedText, catalog);
  const finalPrice = amountForKeyword(lines, finalPriceKeywords);
  const productPrice = amountForKeyword(lines, productPriceKeywords);
  const shippingOnLine = amountOnLine(lines, shippingKeywords);
  const discountOnLine = amountOnLine(lines, discountKeywords);
  const volume = inferVolume(normalizedText, product);

  const usedFinalPrice = finalPrice !== null;
  const price = finalPrice?.value ?? productPrice?.value ?? null;

  const ambiguities: CartOcrAmbiguity[] = [];
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

  const recognizedFields = [
    seller ? "판매처" : "",
    product ? "상품" : "",
    price !== null ? "가격" : "",
    volume !== null ? "용량" : "",
  ].filter(Boolean);
  const confidence = Math.round(
    ((seller ? 0.2 : 0) +
      (product ? 0.3 : 0) +
      (price !== null ? 0.35 : 0) +
      (volume !== null ? 0.15 : 0)) *
      100,
  );

  return {
    sourceName: seller?.sourceName ?? null,
    channel: seller?.channel ?? null,
    productId: product?.id ?? null,
    price,
    shipping,
    discount,
    volume,
    confidence,
    usedFinalPrice,
    recognizedFields,
    ambiguities,
  };
}
