import type { Channel } from "./pricing";

export type PriceRetailer = {
  id: string;
  name: string;
  channel: Channel;
};

export const priceRetailers: readonly PriceRetailer[] = [
  { id: "lotte-duty-free", name: "롯데면세점", channel: "duty" },
  { id: "shilla-duty-free", name: "신라면세점", channel: "duty" },
  { id: "shinsegae-duty-free", name: "신세계면세점", channel: "duty" },
  { id: "hyundai-duty-free", name: "현대면세점", channel: "duty" },
  { id: "coupang", name: "쿠팡", channel: "retail" },
  { id: "olive-young", name: "올리브영", channel: "retail" },
  { id: "ssg", name: "SSG.COM·트레이더스", channel: "retail" },
  { id: "costco", name: "코스트코 온라인몰", channel: "retail" },
  { id: "official-store", name: "국내 공식몰", channel: "retail" },
  { id: "dailyshot", name: "데일리샷", channel: "retail" },
];

export const dutyFreeRetailers = priceRetailers.filter(
  (retailer) => retailer.channel === "duty",
);

export function normalizeRetailerName(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s.·_-]+/g, "");
}

export function findRetailerByName(value: string): PriceRetailer | undefined {
  const normalized = normalizeRetailerName(value);
  return priceRetailers.find(
    (retailer) => normalizeRetailerName(retailer.name) === normalized,
  );
}
