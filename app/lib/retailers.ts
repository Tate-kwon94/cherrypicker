import type { Channel } from "./pricing";

export type PriceRetailer = {
  id: string;
  name: string;
  channel: Channel;
  fulfillment: "airport_pickup" | "delivery" | "store_pickup" | "convenience_pickup";
  aliases?: readonly string[];
};

export const priceRetailers: readonly PriceRetailer[] = [
  {
    id: "lotte-duty-free",
    name: "롯데면세점",
    channel: "duty",
    fulfillment: "airport_pickup",
  },
  {
    id: "shilla-duty-free",
    name: "신라면세점",
    channel: "duty",
    fulfillment: "airport_pickup",
  },
  {
    id: "shinsegae-duty-free",
    name: "신세계면세점",
    channel: "duty",
    fulfillment: "airport_pickup",
  },
  {
    id: "hyundai-duty-free",
    name: "현대면세점",
    channel: "duty",
    fulfillment: "airport_pickup",
  },
  { id: "coupang", name: "쿠팡", channel: "retail", fulfillment: "delivery" },
  {
    id: "olive-young",
    name: "올리브영",
    channel: "retail",
    fulfillment: "delivery",
  },
  {
    id: "ssg",
    name: "SSG.COM·트레이더스",
    channel: "retail",
    fulfillment: "delivery",
  },
  {
    id: "costco",
    name: "코스트코 온라인몰",
    channel: "retail",
    fulfillment: "delivery",
  },
  {
    id: "official-store",
    name: "국내 공식몰",
    channel: "retail",
    fulfillment: "delivery",
  },
  {
    id: "dailyshot",
    name: "데일리샷",
    channel: "retail",
    fulfillment: "store_pickup",
  },
  {
    id: "seoul-wine",
    name: "서울와인",
    channel: "retail",
    fulfillment: "store_pickup",
    aliases: ["Seoul Wine"],
  },
  {
    id: "pocket-cu",
    name: "포켓CU 예약구매",
    channel: "retail",
    fulfillment: "convenience_pickup",
    aliases: ["CU", "포켓CU", "CU 예약구매"],
  },
  {
    id: "wine25-plus",
    name: "GS25 와인25플러스",
    channel: "retail",
    fulfillment: "convenience_pickup",
    aliases: ["와인25플러스", "와인25+", "우리동네GS 와인25플러스"],
  },
  {
    id: "seven-eleven-liquor-pickup",
    name: "세븐일레븐 주류 픽업",
    channel: "retail",
    fulfillment: "convenience_pickup",
    aliases: ["세븐일레븐", "세븐앱 주류 픽업"],
  },
  {
    id: "emart24-bottle-order",
    name: "이마트24 보틀오더",
    channel: "retail",
    fulfillment: "convenience_pickup",
    aliases: ["이마트24", "보틀오더", "이마트24 주류픽업"],
  },
];

export const dutyFreeRetailers = priceRetailers.filter(
  (retailer) => retailer.channel === "duty",
);

export const conveniencePickupRetailers = priceRetailers.filter(
  (retailer) => retailer.fulfillment === "convenience_pickup",
);

export const fulfillmentLabels = {
  airport_pickup: "공항 수령",
  delivery: "국내 배송",
  store_pickup: "주류매장 픽업",
  convenience_pickup: "편의점 픽업",
} as const;

export function normalizeRetailerName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s.·_-]+/g, "");
}

export function findRetailerByName(value: string): PriceRetailer | undefined {
  const normalized = normalizeRetailerName(value);
  return priceRetailers.find(
    (retailer) =>
      normalizeRetailerName(retailer.name) === normalized ||
      retailer.aliases?.some(
        (alias) => normalizeRetailerName(alias) === normalized,
      ),
  );
}

export function fulfillmentLabelForRetailer(
  value: string,
  channel: Channel,
  pickupEvidence = false,
): string {
  const retailer = findRetailerByName(value);
  if (retailer) return fulfillmentLabels[retailer.fulfillment];
  if (channel === "duty") return fulfillmentLabels.airport_pickup;
  if (pickupEvidence) return fulfillmentLabels.store_pickup;
  return "국내 구매";
}
