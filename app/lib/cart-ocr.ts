import type { Channel, Unit } from "./pricing";

export type OcrCatalogItem = {
  id: string;
  brand: string;
  name: string;
  unit: Unit;
  defaultVolume: number;
};

export type CartOcrResult = {
  sourceName: string | null;
  channel: Channel | null;
  productId: string | null;
  price: number | null;
  shipping: number;
  discount: number;
  volume: number | null;
  confidence: number;
  usedFinalPrice: boolean;
  recognizedFields: string[];
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

const finalPriceKeywords =
  /최종\s*(결제|결재)?\s*(금액|가격|예상)?|총\s*결제|결제\s*예정|주문\s*금액|order\s*total|total\s*payment/i;
const productPriceKeywords =
  /상품\s*(금액|가격|합계)|판매가|회원가|쿠폰가|할인가|product\s*total/i;
const shippingKeywords = /배송비|배송\s*요금|shipping/i;
const discountKeywords = /총\s*할인|쿠폰\s*할인|할인\s*(금액|합계)|discount/i;

function compact(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9가-힣]+/g, "");
}

function amountsInLine(line: string): number[] {
  const values: number[] = [];
  const money = /(?:₩|￦)?\s*(\d{1,3}(?:[,.]\d{3})+|\d{4,8})\s*(?:원|krw)?/gi;
  for (const match of line.matchAll(money)) {
    const parsed = Number(match[1].replace(/[,.]/g, ""));
    if (Number.isSafeInteger(parsed) && parsed >= 100 && parsed <= 50_000_000) {
      values.push(parsed);
    }
  }
  return values;
}

function amountForKeyword(lines: string[], pattern: RegExp): number | null {
  for (const line of [...lines].reverse()) {
    if (!pattern.test(line)) continue;
    const values = amountsInLine(line);
    if (values.length > 0) return values.at(-1) ?? null;
  }
  return null;
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
    const matchedTokens = nameTokens.filter((token) => compactText.includes(token));
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
  const volumePattern = new RegExp(`(\\d+(?:[.]\\d+)?)\\s*(?:${unitPattern})`, "gi");
  const values = [...text.matchAll(volumePattern)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isFinite(value) && value > 0 && value <= 10_000);
  if (values.length === 0) return item.defaultVolume;

  return values.sort(
    (a, b) =>
      Math.abs(a - item.defaultVolume) - Math.abs(b - item.defaultVolume),
  )[0];
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
  const seller = sellerPatterns.find(({ pattern }) => pattern.test(normalizedText));
  const product = inferProduct(normalizedText, catalog);
  const finalPrice = amountForKeyword(lines, finalPriceKeywords);
  const productPrice = amountForKeyword(lines, productPriceKeywords);
  const shippingLine = lines.find((line) => shippingKeywords.test(line));
  const shipping = shippingLine
    ? /무료|free/i.test(shippingLine)
      ? 0
      : amountsInLine(shippingLine).at(-1) ?? 0
    : 0;
  const discountLine = lines.find((line) => discountKeywords.test(line));
  const discount = discountLine
    ? amountsInLine(discountLine).at(-1) ?? 0
    : 0;
  const volume = inferVolume(normalizedText, product);
  const usedFinalPrice = finalPrice !== null;
  const price = finalPrice ?? productPrice;
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
    shipping: usedFinalPrice ? 0 : shipping,
    discount: usedFinalPrice ? 0 : discount,
    volume,
    confidence,
    usedFinalPrice,
    recognizedFields,
  };
}
