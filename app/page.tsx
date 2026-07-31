"use client";

import Image from "next/image";
import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdSlot } from "./components/ad-slot";
import { guideArticles } from "./guides/data";
import {
  calculateOfferTotal,
  calculateUnitPrice,
  compareEquivalentVolumes,
  isSafeExternalUrl,
  parseCapturedOffers,
  selectBestUnitOffer,
  type CapturedOffer,
  type Channel,
  type OfferView,
  type Unit,
} from "./lib/pricing";
import type { PublishedOffer } from "./lib/price-store";
import {
  fulfillmentLabelForRetailer,
  normalizeRetailerName,
} from "./lib/retailers";

type Category = "cosmetics" | "liquor";
type PriceBasis = "total" | "unit";
type Taste = "beginner" | "sweet" | "smoky";
type ShoppingContext = "departure" | "domestic" | "visitor";
type SavedPick = {
  key: string;
  title: string;
  amount: number;
  savedAt: number;
};

type Cosmetic = {
  id: string;
  catalogId: string;
  brand: string;
  name: string;
  image: string;
  imageAlt: string;
  imageSource: string;
  unit: Unit;
  dutyVolume: number;
  retailVolume: number;
  dutyPrice: number;
  retailBasePrice: number;
  shipping: number;
  dutyCondition: string;
  retailSource: string;
  retailCondition: string;
  freshness: string;
};

type Liquor = {
  taste: Taste;
  catalogId: string;
  label: string;
  name: string;
  volume: number;
  image: string;
  imageAlt: string;
  imageSource: string;
  tags: string[];
  summary: string;
  sweet: number;
  smoke: number;
  body: number;
  dutyPrice: number;
  retailPrice: number;
  retailCondition: string;
  verdict: string;
  reason: string;
};

const providerDomains = [
  { host: "coupang.com", name: "쿠팡", channel: "retail" as Channel },
  {
    host: "search.shopping.naver.com",
    name: "네이버 가격비교",
    channel: "retail" as Channel,
  },
  {
    host: "shopping.naver.com",
    name: "네이버 쇼핑",
    channel: "retail" as Channel,
  },
  { host: "costco.co.kr", name: "코스트코 온라인몰", channel: "retail" as Channel },
  { host: "ssg.com", name: "SSG.COM·트레이더스", channel: "retail" as Channel },
  { host: "oliveyoung.co.kr", name: "올리브영", channel: "retail" as Channel },
  { host: "lottedfs.com", name: "롯데면세점", channel: "duty" as Channel },
  { host: "shilladfs.com", name: "신라면세점", channel: "duty" as Channel },
  { host: "ssgdfs.com", name: "신세계면세점", channel: "duty" as Channel },
  { host: "hddfs.com", name: "현대면세점", channel: "duty" as Channel },
];

const storageKey = "cherrypicker-captured-offers-v1";
const pickStorageKey = "cherrypicker-smart-picks-v1";
const legacyStorageKeys = [
  "oiso-captured-offers-v1",
  "salkka-captured-offers-v1",
];

const cosmetics: Cosmetic[] = [
  {
    id: "anr",
    catalogId: "estee-lauder-anr",
    brand: "에스티 로더",
    name: "어드밴스드 나이트 리페어",
    image: "/products/estee-lauder-anr.jpg",
    imageAlt: "에스티 로더 어드밴스드 나이트 리페어 제품",
    imageSource:
      "https://www.esteelauder.com/product/689/77491/product-catalog/skincare/repair-serum/advanced-night-repair-serum/synchronized-multi-recovery-complex",
    unit: "ml",
    dutyVolume: 100,
    retailVolume: 50,
    dutyPrice: 138000,
    retailBasePrice: 86800,
    shipping: 3000,
    dutyCondition: "예시 할인 적용 · 출국장 수령",
    retailSource: "국내 리테일 예시",
    retailCondition: "예시 일반배송 · 배송비 포함",
    freshness: "예시 가격",
  },
  {
    id: "skii",
    catalogId: "sk-ii-facial-treatment-essence",
    brand: "SK-II",
    name: "페이셜 트리트먼트 에센스",
    image: "/products/skii-facial-treatment-essence.png",
    imageAlt: "SK-II 페이셜 트리트먼트 에센스 230ml 제품",
    imageSource: "https://www.sk2.co.kr/product/facial-treatment-essence",
    unit: "ml",
    dutyVolume: 230,
    retailVolume: 160,
    dutyPrice: 179000,
    retailBasePrice: 139000,
    shipping: 3000,
    dutyCondition: "예시 회원 할인 · 출국장 수령",
    retailSource: "국내 리테일 예시",
    retailCondition: "예시 일반배송 · 배송비 포함",
    freshness: "예시 가격",
  },
  {
    id: "sulwhasoo",
    catalogId: "sulwhasoo-concentrated-ginseng-cream",
    brand: "설화수",
    name: "자음생크림 클래식",
    image: "/products/sulwhasoo-ginseng-cream.jpg",
    imageAlt: "설화수 자음생크림 제품",
    imageSource:
      "https://www.sulwhasoo.com/product/%EC%9E%90%EC%9D%8C%EC%83%9D%ED%81%AC%EB%A6%BC/53/",
    unit: "ml",
    dutyVolume: 60,
    retailVolume: 50,
    dutyPrice: 139000,
    retailBasePrice: 128000,
    shipping: 0,
    dutyCondition: "예시 적립금 적용 · 출국장 수령",
    retailSource: "국내 리테일 예시",
    retailCondition: "예시 무료배송",
    freshness: "예시 가격",
  },
];

const liquors: Record<Taste, Liquor> = {
  beginner: {
    taste: "beginner",
    catalogId: "balvenie-doublewood-12",
    label: "입문자 추천",
    name: "발베니 12 더블우드",
    volume: 700,
    image: "/products/balvenie-doublewood-12.png",
    imageAlt: "발베니 12 더블우드 보틀과 패키지",
    imageSource:
      "https://shop.us.thebalvenie.com/products/the-balvenie-doublewood-12",
    tags: ["꿀", "말린 과일", "오크"],
    summary:
      "향이 부드럽고 단맛과 나무 향의 균형이 좋아 처음 고르는 한 병으로 실패 확률이 낮아요.",
    sweet: 4,
    smoke: 1,
    body: 3,
    dutyPrice: 89000,
    retailPrice: 109900,
    retailCondition: "예시 매장 픽업",
    verdict: "여행 계획이 있다면 면세 구매 추천",
    reason: "가격 차이가 충분하고, 선물용으로도 무난한 스타일이에요.",
  },
  sweet: {
    taste: "sweet",
    catalogId: "glenmorangie-lasanta-12",
    label: "달콤한 취향",
    name: "글렌모렌지 라산타 12",
    volume: 700,
    image: "/products/glenmorangie-lasanta-12.png",
    imageAlt: "글렌모렌지 라산타 12 보틀",
    imageSource: "https://www.glenmorangie.com/en-us/products/the-lasanta",
    tags: ["건포도", "초콜릿", "계피"],
    summary:
      "셰리 캐스크의 달콤한 과일과 초콜릿 느낌이 선명해 식후에 편하게 즐기기 좋아요.",
    sweet: 5,
    smoke: 1,
    body: 3,
    dutyPrice: 74000,
    retailPrice: 92000,
    retailCondition: "예시 매장 픽업",
    verdict: "달콤한 위스키를 찾는다면 면세 구매 추천",
    reason: "취향과 가격 우위가 모두 분명해 디저트 위스키로 잘 맞아요.",
  },
  smoky: {
    taste: "smoky",
    catalogId: "laphroaig-10",
    label: "강한 개성",
    name: "라프로익 10",
    volume: 700,
    image: "/products/laphroaig-10.webp",
    imageAlt: "라프로익 10 보틀과 패키지",
    imageSource: "https://www.laphroaig.com/whiskies/10-year-old",
    tags: ["피트", "바다", "약초"],
    summary:
      "연기와 바다 향이 강한 전형적인 피트 위스키예요. 호불호가 커서 취향 확인이 먼저입니다.",
    sweet: 2,
    smoke: 5,
    body: 4,
    dutyPrice: 68000,
    retailPrice: 73900,
    retailCondition: "예시 매장 픽업",
    verdict: "가격 차이가 작아 가까운 국내 픽업 추천",
    reason: "공항 수령 번거로움보다 절감액이 작아 먼저 잔술로 취향을 확인해도 좋아요.",
  },
};

const won = new Intl.NumberFormat("ko-KR");
const shortDateTime = new Intl.DateTimeFormat("ko-KR", {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatWon(value: number) {
  return `${won.format(Math.round(value))}원`;
}

function evidenceLabel(value: PublishedOffer["evidenceType"]) {
  if (value === "licensed_pickup") return "성인 인증 픽업";
  if (value === "receipt") return "영수증 확인";
  if (value === "store_photo") return "매장 가격표";
  return "공식 원본";
}

function formatOfferUnitPrice(offer: PublishedOffer) {
  if (offer.category === "liquor" && offer.unit === "ml") {
    return `${formatWon(offer.unitPrice * 100)}/100ml`;
  }
  return `${formatWon(offer.unitPrice)}/${offer.unit}`;
}

function coupangSearchUrl(item: Cosmetic) {
  const query = encodeURIComponent(`${item.brand} ${item.name}`);
  return `https://www.coupang.com/np/search?q=${query}`;
}

function providerFromUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.replace(/^www\./, "");
    return providerDomains.find(
      (provider) =>
        hostname === provider.host || hostname.endsWith(`.${provider.host}`),
    );
  } catch {
    return undefined;
  }
}

export default function Home() {
  const [category, setCategory] = useState<Category>("cosmetics");
  const [basis, setBasis] = useState<PriceBasis>("total");
  const [selectedId, setSelectedId] = useState("anr");
  const [taste, setTaste] = useState<Taste>("beginner");
  const [query, setQuery] = useState("");
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureUrl, setCaptureUrl] = useState("");
  const [captureSource, setCaptureSource] = useState("");
  const [captureChannel, setCaptureChannel] = useState<Channel>("retail");
  const [capturedOffers, setCapturedOffers] = useState<CapturedOffer[]>([]);
  const [publishedOffers, setPublishedOffers] = useState<PublishedOffer[]>([]);
  const [publishedStatus, setPublishedStatus] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const [captureError, setCaptureError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [shoppingContext, setShoppingContext] =
    useState<ShoppingContext>("departure");
  const [savedPicks, setSavedPicks] = useState<SavedPick[]>([]);

  useEffect(() => {
    const stored =
      window.localStorage.getItem(storageKey) ??
      legacyStorageKeys
        .map((key) => window.localStorage.getItem(key))
        .find((value) => value !== null);
    if (!stored) return;

    const parsed = parseCapturedOffers(
      stored,
      new Set(cosmetics.map((item) => item.id)),
    );
    window.localStorage.setItem(storageKey, JSON.stringify(parsed));
    legacyStorageKeys.forEach((key) => window.localStorage.removeItem(key));

    const restoreTimer = window.setTimeout(() => {
      if (parsed.length > 0) {
        setCapturedOffers(parsed);
      }
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(pickStorageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored) as unknown;
      if (!Array.isArray(parsed)) return;
      setSavedPicks(
        parsed
          .filter(
            (item): item is SavedPick =>
              Boolean(
                item &&
                  typeof item === "object" &&
                  typeof (item as SavedPick).key === "string" &&
                  typeof (item as SavedPick).title === "string" &&
                  Number.isFinite((item as SavedPick).amount) &&
                  Number.isFinite((item as SavedPick).savedAt),
              ),
          )
          .slice(-50),
      );
    } catch {
      window.localStorage.removeItem(pickStorageKey);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPublishedOffers() {
      try {
        const response = await fetch("/api/offers");
        const payload = (await response.json()) as {
          offers?: PublishedOffer[];
        };
        if (!response.ok) throw new Error("verified price feed unavailable");
        if (!cancelled) {
          setPublishedOffers(payload.offers ?? []);
          setPublishedStatus("ready");
        }
      } catch {
        if (!cancelled) setPublishedStatus("unavailable");
      }
    }

    void loadPublishedOffers();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!captureOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCaptureOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("modal-open");
    };
  }, [captureOpen]);

  const product = useMemo(
    () => cosmetics.find((item) => item.id === selectedId) ?? cosmetics[0],
    [selectedId],
  );

  const offers = useMemo<OfferView[]>(() => {
    const baseOffers: OfferView[] = [
      {
        id: `base-duty-${product.id}`,
        channel: "duty",
        source: "온라인 면세 예시",
        url: "",
        price: product.dutyPrice + 15000,
        shipping: 0,
        discount: 15000,
        volume: product.dutyVolume,
        unit: product.unit,
        total: calculateOfferTotal({
          price: product.dutyPrice + 15000,
          shipping: 0,
          discount: 15000,
        }),
        unitPrice: calculateUnitPrice(
          product.dutyPrice,
          product.dutyVolume,
        ),
        condition: product.dutyCondition,
        captured: false,
      },
      {
        id: `base-retail-${product.id}`,
        channel: "retail",
        source: product.retailSource,
        url: "",
        price: product.retailBasePrice,
        shipping: product.shipping,
        discount: 0,
        volume: product.retailVolume,
        unit: product.unit,
        total: calculateOfferTotal({
          price: product.retailBasePrice,
          shipping: product.shipping,
          discount: 0,
        }),
        unitPrice: calculateUnitPrice(
          product.retailBasePrice + product.shipping,
          product.retailVolume,
        ),
        condition: product.retailCondition,
        captured: false,
      },
    ];

    const verifiedOffers = publishedOffers
      .filter(
        (offer) =>
          offer.category === "cosmetics" &&
          offer.productId === product.catalogId,
      )
      .map<OfferView>((offer) => ({
        id: `verified-${offer.id}`,
        channel: offer.channel,
        source: offer.sourceName,
        url: offer.sourceUrl,
        price: offer.listPrice,
        shipping: offer.shipping,
        discount: offer.instantDiscount,
        volume: offer.volume,
        unit: offer.unit,
        total: offer.finalPrice,
        unitPrice: offer.unitPrice,
        condition: `운영자 검수 · ${shortDateTime.format(offer.observedAt)}`,
        captured: false,
        verified: true,
      }));
    const hasVerifiedComparison =
      verifiedOffers.some((offer) => offer.channel === "duty") &&
      verifiedOffers.some((offer) => offer.channel === "retail");

    const userOffers = capturedOffers
      .filter((offer) => offer.productId === product.id)
      .map<OfferView>((offer) => {
        const total = calculateOfferTotal(offer);
        return {
          ...offer,
          total,
          unitPrice: calculateUnitPrice(total, offer.volume),
          condition:
            offer.channel === "duty"
              ? "직접 확인 · 출국장 수령"
              : `직접 확인 · 배송비 ${formatWon(offer.shipping)}`,
          captured: true,
        };
      });

    return [
      ...(hasVerifiedComparison ? verifiedOffers : baseOffers),
      ...userOffers,
    ];
  }, [capturedOffers, product, publishedOffers]);

  const trustedCosmeticOffers = offers.filter(
    (offer) => offer.verified || offer.captured,
  );
  const trustedBestDuty = selectBestUnitOffer(trustedCosmeticOffers, "duty");
  const trustedBestRetail = selectBestUnitOffer(trustedCosmeticOffers, "retail");
  const hasTrustedCosmeticsComparison = Boolean(
    trustedBestDuty && trustedBestRetail,
  );
  const bestDuty =
    trustedBestDuty ?? selectBestUnitOffer(offers, "duty") ?? offers[0];
  const bestRetail =
    trustedBestRetail ?? selectBestUnitOffer(offers, "retail") ?? offers[1];
  const verifiedDutySourceCount = new Set(
    offers
      .filter((offer) => offer.verified && offer.channel === "duty")
      .map((offer) => normalizeRetailerName(offer.source)),
  ).size;
  const verifiedRetailSourceCount = new Set(
    offers
      .filter((offer) => offer.verified && offer.channel === "retail")
      .map((offer) => normalizeRetailerName(offer.source)),
  ).size;
  const comparison = compareEquivalentVolumes(bestDuty, bestRetail);
  const retailPrice = bestRetail.total;
  const dutyUnit = bestDuty.unitPrice;
  const retailUnit = bestRetail.unitPrice;
  const dutyEquivalent = comparison.dutyEquivalent;
  const equivalentSavings = comparison.savings;
  const dutyWins = comparison.dutyWins;
  const savingRate = comparison.savingRate;
  const liquor = liquors[taste];
  const verifiedLiquorOffers = publishedOffers.filter(
    (offer) =>
      offer.category === "liquor" && offer.productId === liquor.catalogId,
  );
  const bestVerifiedLiquorDuty = selectBestUnitOffer(
    verifiedLiquorOffers,
    "duty",
  );
  const bestVerifiedLiquorRetail = selectBestUnitOffer(
    verifiedLiquorOffers,
    "retail",
  );
  const hasVerifiedLiquorComparison = Boolean(
    bestVerifiedLiquorDuty && bestVerifiedLiquorRetail,
  );
  const liquorDutyPrice = hasVerifiedLiquorComparison
    ? bestVerifiedLiquorDuty!.finalPrice
    : liquor.dutyPrice;
  const liquorRetailPrice = hasVerifiedLiquorComparison
    ? bestVerifiedLiquorRetail!.finalPrice
    : liquor.retailPrice;
  const liquorDutyVolume = hasVerifiedLiquorComparison
    ? bestVerifiedLiquorDuty!.volume
    : liquor.volume;
  const liquorRetailVolume = hasVerifiedLiquorComparison
    ? bestVerifiedLiquorRetail!.volume
    : liquor.volume;
  const liquorDutyUnitPrice = hasVerifiedLiquorComparison
    ? bestVerifiedLiquorDuty!.unitPrice
    : liquor.dutyPrice / liquor.volume;
  const liquorRetailUnitPrice = hasVerifiedLiquorComparison
    ? bestVerifiedLiquorRetail!.unitPrice
    : liquor.retailPrice / liquor.volume;
  const liquorSaving = hasVerifiedLiquorComparison
    ? liquorRetailPrice - liquorDutyUnitPrice * liquorRetailVolume
    : liquor.retailPrice - liquor.dutyPrice;
  const liquorDutySourceCount = new Set(
    verifiedLiquorOffers
      .filter((offer) => offer.channel === "duty")
      .map((offer) => normalizeRetailerName(offer.sourceName)),
  ).size;
  const liquorRetailSourceCount = new Set(
    verifiedLiquorOffers
      .filter((offer) => offer.channel === "retail")
      .map((offer) => normalizeRetailerName(offer.sourceName)),
  ).size;
  const currentComparisonReady =
    category === "cosmetics"
      ? hasTrustedCosmeticsComparison
      : hasVerifiedLiquorComparison;
  const liquorVerdict = hasVerifiedLiquorComparison
    ? liquorSaving > 10000
      ? `${bestVerifiedLiquorDuty!.sourceName} 면세 구매 추천`
      : liquorSaving < 0
        ? `${bestVerifiedLiquorRetail!.sourceName} 국내 구매 추천`
        : "가격 차이가 작아 수령 편의 우선"
    : liquor.verdict;
  const liquorReason = hasVerifiedLiquorComparison
    ? liquorSaving > 10000
      ? `국내 최저 단위가보다 같은 용량 기준 ${formatWon(liquorSaving)} 낮습니다.`
      : liquorSaving < 0
        ? `면세 최저 단위가보다 같은 용량 기준 ${formatWon(Math.abs(liquorSaving))} 낮습니다.`
        : `같은 용량 기준 차이가 ${formatWon(Math.abs(liquorSaving))}로 작습니다.`
    : liquor.reason;
  const decisionDifference =
    category === "cosmetics" ? equivalentSavings : liquorSaving;
  const decisionThreshold = category === "cosmetics" ? 3000 : 10000;
  const selectedDecisionTitle =
    category === "cosmetics"
      ? `${product.brand} ${product.name}`
      : liquor.name;
  const dutyIsAvailable = shoppingContext !== "domestic";
  const priceGapIsSmall =
    Math.abs(decisionDifference) <= decisionThreshold;
  const decisionWinner =
    !dutyIsAvailable || priceGapIsSmall
      ? "retail"
      : decisionDifference > 0
        ? "duty"
        : "retail";
  const decisionTone = !dutyIsAvailable
    ? "retail"
    : priceGapIsSmall
      ? "convenience"
      : decisionWinner;
  const expectedSavings =
    decisionWinner === "duty" && decisionDifference > 0
      ? decisionDifference
      : decisionWinner === "retail" && decisionDifference < 0
        ? Math.abs(decisionDifference)
        : 0;
  const quickDecision = {
    key: `${category}-${category === "cosmetics" ? product.id : taste}-${shoppingContext}-${decisionTone}`,
    label:
      decisionTone === "duty"
        ? "면세 PICK"
        : decisionTone === "retail"
          ? "국내 PICK"
          : "편리함 PICK",
    heading:
      decisionTone === "duty"
        ? "이번에는 온라인 면세가 유리해요"
        : decisionTone === "retail"
          ? "이번에는 국내 구매가 유리해요"
          : "가격보다 수령 편의가 중요해요",
    reason:
      shoppingContext === "domestic"
        ? "출국 일정이 없다면 면세 가격은 참고만 하고 국내 배송·픽업 경로를 선택해야 합니다."
        : priceGapIsSmall
          ? `가격 차이가 ${formatWon(Math.abs(decisionDifference))}에 불과해 공항 수령보다 국내 배송·픽업이 편리합니다.`
          : decisionWinner === "duty"
            ? `동일 용량 기준 면세 가격이 ${formatWon(Math.abs(decisionDifference))} 낮아 공항 수령을 감수할 가치가 있습니다.`
            : `동일 용량 기준 국내 가격이 ${formatWon(Math.abs(decisionDifference))} 낮아 출국 전 받을 수 있다면 국내 구매가 낫습니다.`,
    amount: expectedSavings,
  };
  const savedPick = savedPicks.some((item) => item.key === quickDecision.key);
  const savedPickTotal = savedPicks.reduce((sum, item) => sum + item.amount, 0);
  const verifiedCosmeticChecks = useMemo(
    () =>
      cosmetics.flatMap((item) => {
        const itemOffers = publishedOffers.filter(
          (offer) =>
            offer.category === "cosmetics" &&
            offer.productId === item.catalogId,
        );
        const duty = selectBestUnitOffer(itemOffers, "duty");
        const retail = selectBestUnitOffer(itemOffers, "retail");
        if (!duty || !retail) return [];

        const itemComparison = compareEquivalentVolumes(duty, retail);
        return [
          {
            item,
            duty,
            retail,
            saving: itemComparison.savings,
            dutyEquivalent: itemComparison.dutyEquivalent,
          },
        ];
      }),
    [publishedOffers],
  );

  function persistOffers(next: CapturedOffer[]) {
    setCapturedOffers(next);
    window.localStorage.setItem(storageKey, JSON.stringify(next));
  }

  function closeCapture() {
    setCaptureOpen(false);
    setCaptureError("");
  }

  function inspectCaptureUrl(value: string) {
    setCaptureUrl(value);
    const provider = providerFromUrl(value);
    if (!provider) return;
    setCaptureSource(provider.name);
    setCaptureChannel(provider.channel);
  }

  function handleCapture(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCaptureError("");
    const form = new FormData(event.currentTarget);
    const productId = String(form.get("productId") ?? "");
    const price = Number(form.get("price"));
    const shipping = Number(form.get("shipping") || 0);
    const discount = Number(form.get("discount") || 0);
    const volume = Number(form.get("volume"));
    const source = captureSource.trim();
    const selectedProduct =
      cosmetics.find((item) => item.id === productId) ?? cosmetics[0];

    if (
      !cosmetics.some((item) => item.id === productId) ||
      !source ||
      !Number.isFinite(price) ||
      !Number.isFinite(shipping) ||
      !Number.isFinite(discount) ||
      !Number.isFinite(volume) ||
      price <= 0 ||
      shipping < 0 ||
      discount < 0 ||
      volume <= 0
    ) {
      setCaptureError("판매처, 상품가, 용량을 확인해주세요.");
      return;
    }

    if (discount >= price + shipping) {
      setCaptureError("할인은 상품가와 배송비를 합친 금액보다 작아야 합니다.");
      return;
    }

    if (!isSafeExternalUrl(captureUrl)) {
      setCaptureError("상품 URL은 http 또는 https 주소만 사용할 수 있습니다.");
      return;
    }

    const nextOffer: CapturedOffer = {
      id: `captured-${Date.now()}`,
      productId,
      channel: captureChannel,
      source,
      url: captureUrl,
      price,
      shipping,
      discount,
      volume,
      unit: selectedProduct.unit,
      createdAt: Date.now(),
    };
    const next = [...capturedOffers, nextOffer];
    persistOffers(next);
    setSelectedId(productId);
    setCategory("cosmetics");
    setStatusMessage(`${source} 가격을 비교표에 반영했습니다.`);
    setCaptureUrl("");
    setCaptureSource("");
    setCaptureChannel("retail");
    closeCapture();
  }

  function removeCapturedOffer(id: string) {
    const next = capturedOffers.filter((offer) => offer.id !== id);
    persistOffers(next);
    setStatusMessage("직접 등록한 가격을 삭제했습니다.");
  }

  function saveQuickDecision() {
    if (savedPick) {
      setStatusMessage("이미 나의 스마트 픽에 저장된 선택입니다.");
      return;
    }
    const next = [
      ...savedPicks,
      {
        key: quickDecision.key,
        title: selectedDecisionTitle,
        amount: quickDecision.amount,
        savedAt: Date.now(),
      },
    ].slice(-50);
    setSavedPicks(next);
    window.localStorage.setItem(pickStorageKey, JSON.stringify(next));
    setStatusMessage(
      quickDecision.amount > 0
        ? `예상 절약액 ${formatWon(quickDecision.amount)}을 나의 스마트 픽에 저장했습니다.`
        : "수령 편의를 우선한 선택을 나의 스마트 픽에 저장했습니다.",
    );
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      setStatusMessage("검색할 상품명이나 브랜드를 입력해주세요.");
      return;
    }

    const foundLiquor = Object.values(liquors).find((item) =>
      [item.name, item.label, ...item.tags]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
    if (foundLiquor) {
      setTaste(foundLiquor.taste);
      setCategory("liquor");
      setStatusMessage(`${foundLiquor.name} 검수 가격 현황을 열었습니다.`);
      return;
    }

    if (
      ["주류", "위스키", "싱글몰트"].some((keyword) =>
        normalized.includes(keyword),
      )
    ) {
      setCategory("liquor");
      setStatusMessage("위스키 검수 가격 현황을 열었습니다.");
      return;
    }

    const found = cosmetics.find((item) => {
      const searchable = `${item.brand} ${item.name}`.toLowerCase();
      return (
        searchable.includes(normalized) ||
        normalized.includes(item.name.toLowerCase())
      );
    });
    if (found) {
      setSelectedId(found.id);
      setCategory("cosmetics");
      setStatusMessage(`${found.brand} ${found.name} 검수 가격 현황을 열었습니다.`);
      return;
    }

    setStatusMessage(
      "현재 비교 상품에서 찾지 못했습니다. 직접 확인한 가격은 ‘가격 등록’에서 비교할 수 있습니다.",
    );
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="체리피커 홈">
          <span className="brand-cherry" aria-hidden="true">
            <span />
            <span />
          </span>
          <span className="brand-word">CHERRY</span>
          <span className="brand-country">PICKER</span>
        </a>
        <div className="top-actions">
          <Link className="text-button" href="/guides">
            가격 가이드
          </Link>
          <a className="text-button" href="#partner-policy">
            가격·제휴 원칙
          </a>
          <button
            className="capture-button"
            type="button"
            onClick={() => setCaptureOpen(true)}
          >
            ＋ 가격 등록
          </button>
        </div>
      </header>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">SMART PRICE GUIDE · 면세와 국내가를 한눈에</p>
          <h1>
            가격은 비교하고,
            <br />
            좋은 것만 <span className="cherry-pick">픽</span>하세요.
          </h1>
        </div>
        <p className="hero-copy">
          배송비·쿠폰·용량 차이까지 같은 기준으로 바꿔, 지금 어디서 사는 게
          나은지 선명하게 보여드립니다.
        </p>
      </section>

      <form className="search-box" onSubmit={handleSearch}>
        <label className="sr-only" htmlFor="product-search">
          상품 검색
        </label>
        <span className="search-icon" aria-hidden="true">
          ⌕
        </span>
        <input
          id="product-search"
          type="search"
          placeholder="상품명 또는 브랜드를 입력하세요"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit">비교하기</button>
      </form>

      <p className="status-message" aria-live="polite">
        {statusMessage}
      </p>

      <section className="shopping-context" aria-labelledby="shopping-context-title">
        <div>
          <p className="section-kicker">SHOPPING CONTEXT</p>
          <h2 id="shopping-context-title">지금 어떤 상황인가요?</h2>
        </div>
        <div className="context-picker" aria-label="구매 상황">
          {(
            [
              ["departure", "곧 출국해요", "면세와 국내 모두 비교"],
              ["domestic", "국내에서 받을래요", "배송·픽업 중심"],
              ["visitor", "한국 여행 중이에요", "호텔·공항 수령 고려"],
            ] as const
          ).map(([value, title, description]) => (
            <button
              type="button"
              key={value}
              className={shoppingContext === value ? "active" : ""}
              aria-pressed={shoppingContext === value}
              onClick={() => setShoppingContext(value)}
            >
              <strong>{title}</strong>
              <small>{description}</small>
            </button>
          ))}
        </div>
      </section>

      <div className="context-strip" aria-label="현재 가격 비교 기준">
        <span>
          <b>기준</b> 배송비·즉시할인 반영
        </span>
        <span>
          <b>환산</b> 화장품 1ml · 주류 100ml 단가
        </span>
        <span>
          <b>데이터</b>{" "}
          {publishedOffers.length > 0
            ? "운영자 검수 가격만 사용"
            : publishedStatus === "loading"
              ? "검수 가격 불러오는 중"
              : "검수 가격 준비 중"}
        </span>
      </div>

      {currentComparisonReady ? (
        <section
          className={`quick-decision ${decisionTone}`}
          aria-labelledby="quick-decision-title"
        >
          <div className="quick-decision-copy">
            <span>{quickDecision.label}</span>
            <p>{selectedDecisionTitle}</p>
            <h2 id="quick-decision-title">{quickDecision.heading}</h2>
            <p>{quickDecision.reason}</p>
          </div>
          <div className="quick-decision-result">
            <small>
              {quickDecision.amount > 0 ? "예상 절약" : "현재 가격 차이"}
            </small>
            <strong>
              {formatWon(
                quickDecision.amount > 0
                  ? quickDecision.amount
                  : Math.abs(decisionDifference),
              )}
            </strong>
            <span>동일 용량·현재 상황 기준</span>
          </div>
          <div className="quick-decision-actions">
            <button
              type="button"
              onClick={() =>
                document
                  .getElementById("comparison-start")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
            >
              계산 근거 보기
            </button>
            <button type="button" onClick={saveQuickDecision} disabled={savedPick}>
              {savedPick ? "저장 완료 ✓" : "이 선택 저장"}
            </button>
            {savedPicks.length > 0 && (
              <p>
                나의 스마트 픽 {savedPicks.length}개
                {savedPickTotal > 0 && ` · 예상 ${formatWon(savedPickTotal)} 절약`}
              </p>
            )}
          </div>
        </section>
      ) : (
        <section className="quick-decision pending" aria-live="polite">
          <div className="quick-decision-copy">
            <span>PRICE CHECK</span>
            <p>{selectedDecisionTitle}</p>
            <h2>
              {publishedStatus === "loading"
                ? "검수 가격을 불러오고 있어요"
                : "양쪽 가격이 모이면 바로 결론을 드릴게요"}
            </h2>
            <p>
              면세점과 국내 판매처 가격이 모두 확인된 경우에만 구매 추천과
              절약액을 표시합니다.
            </p>
          </div>
        </section>
      )}

      <section
        className="verified-price-section"
        aria-labelledby="verified-price-title"
      >
        <div className="verified-price-heading">
          <div>
            <p className="section-kicker">VERIFIED PRICE FEED</p>
            <h2 id="verified-price-title">운영자가 확인한 최신 가격</h2>
          </div>
          <span>
            <i aria-hidden="true" />
            승인·유효기간 통과
          </span>
        </div>

        {publishedStatus === "loading" ? (
          <p className="verified-price-empty">검수 가격을 불러오는 중입니다.</p>
        ) : publishedOffers.length === 0 ? (
          <div className="verified-price-empty">
            <strong>
              {publishedStatus === "unavailable"
                ? "검수 가격 데이터가 아직 준비되지 않았습니다."
                : "아직 공개된 검수 가격이 없습니다."}
            </strong>
            <p>
              원본과 확인 시각을 검수한 가격만 이 영역과 구매 추천에 공개합니다.
            </p>
          </div>
        ) : (
          <div className="verified-price-grid">
            {publishedOffers.slice(0, 8).map((offer) => (
              <article key={offer.id}>
                <div className="verified-price-topline">
                  <span>{offer.category === "cosmetics" ? "화장품" : "주류"}</span>
                  <small>
                    {fulfillmentLabelForRetailer(
                      offer.sourceName,
                      offer.channel,
                      offer.evidenceType === "licensed_pickup",
                    )}
                  </small>
                </div>
                <span className="evidence-chip">
                  {evidenceLabel(offer.evidenceType)}
                </span>
                <p>{offer.brand}</p>
                <h3>{offer.productName}</h3>
                <div className="verified-price-value">
                  <strong>{formatWon(offer.finalPrice)}</strong>
                  <span>{formatOfferUnitPrice(offer)}</span>
                </div>
                <dl>
                  <div>
                    <dt>판매처</dt>
                    <dd>{offer.sourceName}</dd>
                  </div>
                  <div>
                    <dt>구성</dt>
                    <dd>
                      {offer.volume}
                      {offer.unit}
                      {offer.category === "liquor" &&
                        offer.abv !== null &&
                        ` · 도수 ${offer.abv}% 참고`}
                    </dd>
                  </div>
                  <div>
                    <dt>확인</dt>
                    <dd>{shortDateTime.format(offer.observedAt)}</dd>
                  </div>
                  {offer.storeLocation && (
                    <div className="pickup-detail">
                      <dt>수령</dt>
                      <dd>{offer.storeLocation}</dd>
                    </div>
                  )}
                  {offer.notes && (
                    <div className="pickup-detail">
                      <dt>조건</dt>
                      <dd>{offer.notes}</dd>
                    </div>
                  )}
                </dl>
                <a
                  href={offer.sourceUrl}
                  target="_blank"
                  rel="noreferrer sponsored"
                >
                  원본 가격 확인 ↗
                </a>
              </article>
            ))}
          </div>
        )}
      </section>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_TOP} />

      <nav
        className="category-tabs"
        id="comparison-start"
        aria-label="상품 카테고리"
      >
        <button
          type="button"
          className={category === "cosmetics" ? "active" : ""}
          aria-pressed={category === "cosmetics"}
          onClick={() => setCategory("cosmetics")}
        >
          화장품
        </button>
        <button
          type="button"
          className={category === "liquor" ? "active" : ""}
          aria-pressed={category === "liquor"}
          onClick={() => setCategory("liquor")}
        >
          주류 추천
        </button>
      </nav>

      {category === "cosmetics" ? hasTrustedCosmeticsComparison ? (
        <section className="content-grid" aria-label="화장품 가격 비교">
          <div className="main-column">
            <article className="product-summary">
              <div className="product-identity">
                <figure className="product-image">
                  <Image
                    src={product.image}
                    alt={product.imageAlt}
                    width={256}
                    height={304}
                    priority
                  />
                  <figcaption>
                    <a
                      href={product.imageSource}
                      target="_blank"
                      rel="noreferrer"
                    >
                      브랜드 공식 이미지 ↗
                    </a>
                  </figcaption>
                </figure>
                <div>
                  <p className="product-brand">{product.brand}</p>
                  <h2>{product.name}</h2>
                  <div className="meta-row">
                    <span>면세 {bestDuty.volume}{bestDuty.unit}</span>
                    <span>리테일 {bestRetail.volume}{bestRetail.unit}</span>
                    {offers.some((offer) => offer.captured) && (
                      <span>직접 등록 가격 반영</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="recommendation">
                <span className="recommendation-label">현재 비교 결론</span>
                <div>
                  <h3>
                    {dutyWins
                      ? "출국 예정이라면 온라인 면세"
                      : "이번에는 배송 리테일 구매"}
                  </h3>
                  <p>
                    같은 {comparison.comparisonVolume}
                    {bestRetail.unit} 기준으로{" "}
                    {dutyWins ? "면세 환산가가" : "국내 리테일가가"}{" "}
                    <strong>{formatWon(Math.abs(equivalentSavings))}</strong>{" "}
                    낮아요.
                  </p>
                </div>
                <div className="saving">
                  <strong>{savingRate}% 차이</strong>
                  <span>동일 용량 기준</span>
                </div>
              </div>
            </article>

            <div className="section-heading">
              <div>
                <p className="section-kicker">PRICE CHECK</p>
                <h2>실구매가 비교</h2>
              </div>
              <div className="basis-toggle" aria-label="가격 표시 기준">
                <button
                  type="button"
                  className={basis === "total" ? "active" : ""}
                  aria-pressed={basis === "total"}
                  onClick={() => setBasis("total")}
                >
                  총 결제가
                </button>
                <button
                  type="button"
                  className={basis === "unit" ? "active" : ""}
                  aria-pressed={basis === "unit"}
                  onClick={() => setBasis("unit")}
                >
                  단위 가격
                </button>
              </div>
            </div>

            <div className="offer-stack">
              <article className="offer-card best">
                <div>
                  <span className="rank-badge">
                    {verifiedDutySourceCount > 0
                      ? `면세 ${verifiedDutySourceCount}곳 비교 최저`
                      : "면세 최저 단위가"}
                  </span>
                  <h3>{bestDuty.source}</h3>
                  <p>
                    {bestDuty.volume}{bestDuty.unit} · {bestDuty.condition}
                  </p>
                </div>
                <div className="offer-values">
                  <div className={basis === "total" ? "focus" : ""}>
                    <span>총 결제가</span>
                    <strong>{formatWon(bestDuty.total)}</strong>
                  </div>
                  <div className={basis === "unit" ? "focus" : ""}>
                    <span>단위 가격</span>
                    <strong>{formatWon(dutyUnit)}/{bestDuty.unit}</strong>
                  </div>
                </div>
              </article>

              <article className="offer-card">
                <div>
                  <span className="rank-badge neutral">
                    {verifiedRetailSourceCount > 0
                      ? `국내 ${verifiedRetailSourceCount}곳 비교 최저`
                      : "리테일 최저 단위가"}
                  </span>
                  <h3>{bestRetail.source}</h3>
                  <p>
                    {bestRetail.volume}{bestRetail.unit} · {bestRetail.condition}
                  </p>
                </div>
                <div className="offer-values">
                  <div className={basis === "total" ? "focus" : ""}>
                    <span>배송비 포함</span>
                    <strong>{formatWon(retailPrice)}</strong>
                  </div>
                  <div className={basis === "unit" ? "focus" : ""}>
                    <span>단위 가격</span>
                    <strong>{formatWon(retailUnit)}/{bestRetail.unit}</strong>
                  </div>
                </div>
              </article>
            </div>

            <div className="equivalent-card">
              <div>
                <span>
                  동일 {bestRetail.volume}{bestRetail.unit}로 환산
                </span>
                <strong>
                  면세 {formatWon(dutyEquivalent)} · 리테일 {formatWon(retailPrice)}
                </strong>
              </div>
              <div className="equivalent-bars" aria-hidden="true">
                <span
                  className="duty-bar"
                  style={{ width: `${Math.min(100, (dutyEquivalent / retailPrice) * 100)}%` }}
                />
                <span className="retail-bar" />
              </div>
            </div>

            <details className="price-details">
              <summary>
                <span>가격 계산 자세히 보기</span>
                <span aria-hidden="true">＋</span>
              </summary>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>판매처</th>
                      <th>구성</th>
                      <th>상품가</th>
                      <th>추가 비용</th>
                      <th>최종 결제가</th>
                      <th>단위 가격</th>
                      <th>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {offers.map((offer) => (
                      <tr key={offer.id}>
                        <td>
                          <span className="table-source">{offer.source}</span>
                          {offer.captured && (
                            <span className="captured-label">직접 등록</span>
                          )}
                          {offer.verified && (
                            <span className="captured-label verified-label">
                              검수 가격
                            </span>
                          )}
                        </td>
                        <td>
                          {offer.volume}
                          {offer.unit}
                        </td>
                        <td>{formatWon(offer.price)}</td>
                        <td>
                          {[
                            offer.shipping > 0
                              ? `배송 +${formatWon(offer.shipping)}`
                              : "",
                            offer.discount > 0
                              ? `할인 −${formatWon(offer.discount)}`
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" · ") || "0원"}
                        </td>
                        <td>{formatWon(offer.total)}</td>
                        <td>
                          {formatWon(offer.unitPrice)}/{offer.unit}
                        </td>
                        <td className="row-actions">
                          {(offer.captured || offer.verified) && (
                            <>
                            {offer.url && (
                              <a
                                href={offer.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                열기 ↗
                              </a>
                            )}
                            {offer.captured && (
                              <button
                                type="button"
                                onClick={() => removeCapturedOffer(offer.id)}
                              >
                                삭제
                              </button>
                            )}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          </div>

          <aside className="side-column">
            <div className="source-card">
              <span className="source-dot" aria-hidden="true" />
              <div>
                <strong>
                  {offers.some((offer) => offer.captured)
                    ? "직접 확인 가격 반영"
                    : offers.some((offer) => offer.verified)
                      ? "운영자 검수 가격 반영"
                      : "기본값은 예시 가격"}
                </strong>
                <p>
                  {offers.filter((offer) => offer.captured).length
                    ? `${offers.filter((offer) => offer.captured).length}개 가격이 이 브라우저에 저장됨`
                    : offers.filter((offer) => offer.verified).length
                      ? `면세 ${verifiedDutySourceCount}곳 · 국내 ${verifiedRetailSourceCount}곳 최저가 비교`
                    : "실제 구매 전 판매처에서 다시 확인하세요"}
                </p>
              </div>
            </div>

            <div className="limit-card">
              <p className="section-kicker">DATA NOTICE</p>
              <h3>가격 출처를 구분합니다</h3>
              <p>
                검수 가격은 운영자가 원본과 확인 시각을 검증한 값입니다. 직접
                등록한 가격은 공개 데이터와 섞지 않고 이 브라우저에만 반영됩니다.
              </p>
            </div>
          </aside>
        </section>
      ) : (
        <section className="comparison-pending-card" aria-live="polite">
          <p className="section-kicker">VERIFIED COMPARISON</p>
          <h2>{product.brand} {product.name}</h2>
          <p>
            면세점과 국내 판매처에서 검수된 가격이 각각 한 건 이상 모이면
            동일 용량 기준 결론과 절약액을 공개합니다.
          </p>
          <a href="#verified-price-title">현재 확인된 가격 보기 ↑</a>
        </section>
      ) : (
        <section className="liquor-section" aria-label="주류 취향 추천">
          <div className="liquor-intro">
            <div>
              <p className="section-kicker">TASTE FIRST</p>
              <h2>어떤 맛을 좋아하세요?</h2>
            </div>
            <p>취향을 먼저 고르면 가격과 함께 실패 확률이 낮은 한 병을 찾아드려요.</p>
          </div>

          <div className="taste-picker" aria-label="위스키 취향">
            {(
              [
                ["beginner", "처음 마셔요", "부드럽고 균형 좋은 맛"],
                ["sweet", "달콤·부드러움", "과일과 디저트 느낌"],
                ["smoky", "피트·스모키", "연기와 바다 향"],
              ] as const
            ).map(([value, title, description]) => (
              <button
                type="button"
                key={value}
                className={taste === value ? "active" : ""}
                aria-pressed={taste === value}
                onClick={() => setTaste(value)}
              >
                <span>{title}</span>
                <small>{description}</small>
              </button>
            ))}
          </div>

          <div className="liquor-grid">
            <article className="liquor-product">
              <figure className="liquor-image">
                <Image
                  src={liquor.image}
                  alt={liquor.imageAlt}
                  width={360}
                  height={570}
                />
                <figcaption>
                  <a
                    href={liquor.imageSource}
                    target="_blank"
                    rel="noreferrer"
                  >
                    브랜드 공식 이미지 ↗
                  </a>
                </figcaption>
              </figure>
              <div className="liquor-copy">
                <span className="recommendation-label">{liquor.label}</span>
                <h2>{liquor.name}</h2>
                <div className="flavour-tags">
                  {liquor.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
                <p>{liquor.summary}</p>

                <div className="taste-profile">
                  {[
                    ["달콤함", liquor.sweet],
                    ["스모키", liquor.smoke],
                    ["바디감", liquor.body],
                  ].map(([label, value]) => (
                    <div className="taste-row" key={String(label)}>
                      <span>{label}</span>
                      <div>
                        <i style={{ width: `${Number(value) * 20}%` }} />
                      </div>
                      <b>{value}/5</b>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            {hasVerifiedLiquorComparison ? (
              <div className="liquor-prices">
              <article className="liquor-offer best">
                <span>
                  {hasVerifiedLiquorComparison
                    ? bestVerifiedLiquorDuty!.sourceName
                    : "온라인 면세"} ·{" "}
                  {liquorDutyVolume}ml
                </span>
                <strong>{formatWon(liquorDutyPrice)}</strong>
                <b>
                  {formatWon(liquorDutyUnitPrice * 100)}/100ml
                </b>
                <small>
                  {hasVerifiedLiquorComparison
                    ? `운영자 검수 · 면세 ${liquorDutySourceCount}곳 비교 최저`
                    : "출국장 수령 · 예시 가격"}
                </small>
              </article>
              <article className="liquor-offer">
                <span>
                  {hasVerifiedLiquorComparison
                    ? bestVerifiedLiquorRetail!.sourceName
                    : "국내 픽업 예시가"} ·{" "}
                  {liquorRetailVolume}ml
                </span>
                <strong>{formatWon(liquorRetailPrice)}</strong>
                <b>
                  {formatWon(liquorRetailUnitPrice * 100)}/100ml
                </b>
                <small>
                  {hasVerifiedLiquorComparison
                    ? `운영자 검수 · 국내 ${liquorRetailSourceCount}곳 비교 최저`
                    : liquor.retailCondition}
                </small>
              </article>
              <div className="liquor-verdict">
                <span>
                  {liquorSaving > 0
                    ? `면세 ${formatWon(liquorSaving)} ${liquorSaving > 10000 ? "절약" : "차이"}`
                    : liquorSaving < 0
                      ? `국내 ${formatWon(Math.abs(liquorSaving))} 절약`
                      : "동일 용량 기준 가격 동일"}
                </span>
                <h3>{liquorVerdict}</h3>
                <p>{liquorReason}</p>
              </div>
              </div>
            ) : (
              <div className="comparison-pending-card compact">
                <p className="section-kicker">PRICE COVERAGE</p>
                <h3>면세 가격을 확인 중입니다</h3>
                <p>
                  국내 픽업 가격은 {liquorRetailSourceCount}곳에서 확인됐습니다.
                  같은 상품의 면세 가격이 확보되기 전에는 어느 쪽이 유리한지
                  단정하지 않습니다.
                </p>
                {verifiedLiquorOffers
                  .filter((offer) => offer.channel === "retail")
                  .map((offer) => (
                    <a
                      key={offer.id}
                      href={offer.sourceUrl}
                      target="_blank"
                      rel="noreferrer sponsored"
                    >
                      <span>
                        {fulfillmentLabelForRetailer(
                          offer.sourceName,
                          offer.channel,
                          offer.evidenceType === "licensed_pickup",
                        )}
                      </span>
                      <strong>{offer.sourceName} · {formatWon(offer.finalPrice)}</strong>
                      <small>{offer.storeLocation || "판매처에서 수령점 선택"}</small>
                    </a>
                  ))}
              </div>
            )}
          </div>

          <div className="alcohol-note">
            <strong>주류 비교 기준</strong>
            <span>
              일반 주류는 택배가 아닌 국내 매장 픽업 가격과 비교해야 합니다.
              편의점 앱·전문점 스마트오더도 지점별 픽업 가격으로 포함하며,
              가성비는 100ml당 실결제가를 기본으로 봅니다. 구매 시 성인 인증과
              실제 수령점 재고를 다시 확인하세요.
            </span>
          </div>

          <section
            className="liquor-verification"
            aria-labelledby="liquor-verification-title"
          >
            <div className="liquor-verification-heading">
              <div>
                <p className="section-kicker">LIQUOR PRICE EVIDENCE</p>
                <h2 id="liquor-verification-title">주류 가격은 이렇게 검증합니다</h2>
              </div>
              <p>
                비교 목적에 따라 기준을 나눕니다. 도수와 바코드는 배치·국가별로
                달라질 수 있어 필수 일치 조건이 아닌 참고 정보로 사용합니다.
              </p>
            </div>
            <div className="liquor-verification-grid">
              <article>
                <span>가성비 비교 · 기본</span>
                <h3>100ml당 실결제가</h3>
                <p>
                  병 크기가 달라도 상품가와 필수 비용을 100ml 기준으로 환산해
                  빠르게 비교합니다.
                </p>
              </article>
              <article>
                <span>같은 병 비교 · 신뢰도</span>
                <h3>제품군·연수·용량 확인</h3>
                <p>
                  핵심 상품명과 숙성 연수, 병 용량을 우선 확인합니다. 도수·배치·
                  바코드는 확인되면 신뢰도를 높입니다.
                </p>
              </article>
              <article>
                <span>최신성 · 최대 14일</span>
                <h3>출처에 따라 갱신</h3>
                <p>
                  공식 원본 14일, 성인 인증 픽업 7일, 영수증·매장 가격표 3일을
                  기준으로 다시 확인합니다.
                </p>
              </article>
            </div>
            <p className="liquor-law-note">
              일반 주류는 온라인 주문 후 택배 배송이 아니라 성인 확인을 거친
              매장 수령 가격을 기본 비교 대상으로 사용합니다.{" "}
              <a
                href="https://www.nts.go.kr/webtv/na/ntt/selectNttInfo.do?nttSn=851264"
                target="_blank"
                rel="noreferrer"
              >
                국세청 스마트오더 안내 ↗
              </a>
            </p>
          </section>
        </section>
      )}

      <section className="capture-cta">
        <div>
          <p className="section-kicker">MY CHECKOUT PRICE</p>
          <h2>로그인 후 보이는 가격도 비교하세요.</h2>
          <p>
            면세점 쿠폰과 회원가는 사람마다 달라요. 결제 화면의 상품가·할인·
            배송비를 등록하면 같은 용량으로 즉시 다시 계산합니다.
          </p>
        </div>
        <div className="capture-steps">
          <span>
            <b>1</b> 상품 URL 붙여넣기
          </span>
          <span>
            <b>2</b> 결제 화면 가격 입력
          </span>
          <span>
            <b>3</b> 단위가 자동 비교
          </span>
        </div>
        <button type="button" onClick={() => setCaptureOpen(true)}>
          내 가격 등록하기 ↗
        </button>
      </section>

      {verifiedCosmeticChecks.length > 0 && (
      <section className="more-products">
        <div className="section-heading">
          <div>
            <p className="section-kicker">POPULAR CHECKS</p>
            <h2>많이 비교하는 화장품</h2>
          </div>
          <span>실구매가 기준</span>
        </div>
        <div className="product-list">
          {verifiedCosmeticChecks.map(
            ({ item, saving, dutyEquivalent }) => (
              <button
                type="button"
                key={item.id}
                className={selectedId === item.id ? "active" : ""}
                onClick={() => {
                  setSelectedId(item.id);
                  setCategory("cosmetics");
                  window.scrollTo({ top: 260, behavior: "smooth" });
                }}
              >
                <span className="mini-product-image">
                  <Image
                    src={item.image}
                    alt=""
                    width={128}
                    height={164}
                    loading="lazy"
                  />
                </span>
                <span>
                  <small>{item.brand}</small>
                  <strong>{item.name}</strong>
                  <b>면세 환산가 {formatWon(dutyEquivalent)}</b>
                </span>
                <em>
                  {saving > 0
                    ? `면세 ${formatWon(saving)} 절약`
                    : `국내 ${formatWon(Math.abs(saving))} 절약`}
                </em>
              </button>
            ),
          )}
        </div>
      </section>
      )}

      <section className="guide-preview" aria-labelledby="guide-preview-title">
        <div className="guide-preview-heading">
          <div>
            <p className="section-kicker">ORIGINAL PRICE GUIDES</p>
            <h2 id="guide-preview-title">가격표보다 먼저 볼 것들</h2>
          </div>
          <Link href="/guides">모든 가이드 보기 →</Link>
        </div>
        <div className="guide-preview-grid">
          {guideArticles.map((article) => (
            <Link href={`/guides/${article.slug}`} key={article.slug}>
              <span className="guide-card-image">
                <Image
                  src={article.image}
                  alt=""
                  width={320}
                  height={180}
                  loading="lazy"
                />
              </span>
              <span className="guide-card-category">{article.category}</span>
              <small>{article.brand}</small>
              <strong>{article.title}</strong>
              <p>{article.verdict}</p>
              <b>읽어보기 →</b>
            </Link>
          ))}
        </div>
      </section>

      <AdSlot slot={process.env.NEXT_PUBLIC_ADSENSE_SLOT_HOME_CONTENT} />

      <section
        className="partner-policy"
        id="partner-policy"
        aria-labelledby="partner-policy-title"
      >
        <div className="partner-heading">
          <div>
            <p className="section-kicker">PRICE &amp; PARTNERSHIP POLICY</p>
            <h2 id="partner-policy-title">가격 비교 원칙과 제휴 안내</h2>
          </div>
          <p>
            체리피커는 판매처가 아니라 구매 판단을 돕는 가격 비교 서비스입니다.
            링크를 통해 판매처로 이동한 뒤 실제 결제 조건을 확인해 주세요.
          </p>
        </div>

        <div className="policy-grid">
          <article>
            <span>01</span>
            <h3>실구매가 기준</h3>
            <p>
              상품가에 배송비를 더하고 누구나 받을 수 있는 즉시할인을 뺀
              금액을 기본 비교가로 사용합니다.
            </p>
          </article>
          <article>
            <span>02</span>
            <h3>같은 용량으로 환산</h3>
            <p>
              면세용과 국내용 구성이 다르면 ml·g·개당 가격으로 환산해 동일한
              기준에서 비교합니다.
            </p>
          </article>
          <article>
            <span>03</span>
            <h3>제휴와 순위 분리</h3>
            <p>
              제휴 수수료 유무는 최저가·절감액·추천 순위에 반영하지 않으며,
              적용된 링크는 명확히 표시합니다.
            </p>
          </article>
          <article>
            <span>04</span>
            <h3>확인 시각 공개</h3>
            <p>
              가격에는 확인 시각과 조건을 함께 표시합니다. 만료된 가격은
              자동으로 숨기며 실제 구매 전 판매처에서 재확인해야 합니다.
            </p>
          </article>
        </div>

        <div className="coupang-checks">
          <div>
            <span className="partner-badge">쿠팡 가격 확인</span>
            <h3>비교 상품을 쿠팡에서 직접 확인하세요.</h3>
            <p>
              현재는 일반 검색 링크입니다. 파트너스 가입 후 발급된 추적 링크로
              교체하며, 적용된 버튼에는 제휴 링크임을 별도로 표시합니다.
            </p>
            <p className="affiliate-disclosure">
              쿠팡 파트너스 활동을 통해 일정액의 수수료를 제공받을 수 있습니다.
            </p>
          </div>
          <div className="coupang-link-list">
            {cosmetics.map((item) => (
              <a
                key={item.id}
                href={coupangSearchUrl(item)}
                target="_blank"
                rel="noreferrer sponsored"
              >
                <span>
                  <small>{item.brand}</small>
                  <strong>{item.name}</strong>
                </span>
                <b>쿠팡 검색 ↗</b>
              </a>
            ))}
          </div>
        </div>
      </section>

      <footer>
        <div>
          <div className="brand footer-brand">
            <span className="brand-cherry" aria-hidden="true">
              <span />
              <span />
            </span>
            <span className="brand-word">CHERRY</span>
            <span className="brand-country">PICKER</span>
          </div>
          <small>
            가격은 비교하고, 좋은 것만{" "}
            <span className="cherry-pick">픽</span>하세요.
          </small>
        </div>
        <div className="footer-copy">
          <nav aria-label="사이트 정책">
            <Link href="/about">서비스 소개</Link>
            <Link href="/guides">가격 가이드</Link>
            <Link href="/privacy">개인정보처리방침</Link>
            <Link href="/terms">이용약관</Link>
            <Link href="/advertising">광고·제휴 원칙</Link>
          </nav>
          <p>
            이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의
            수수료를 제공받을 수 있습니다.
          </p>
          <p>
            표시 가격은 운영자가 원본과 확인 시각을 검수한 값입니다. 실제 결제
            전 판매처의 가격·재고·수령 조건을 다시 확인하세요.
          </p>
        </div>
      </footer>

      {captureOpen && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCapture();
          }}
        >
          <section
            className="capture-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="capture-title"
          >
            <div className="modal-heading">
              <div>
                <p className="section-kicker">ADD REAL PRICE</p>
                <h2 id="capture-title">결제 화면 가격 등록</h2>
              </div>
              <button
                className="modal-close"
                type="button"
                aria-label="닫기"
                onClick={closeCapture}
              >
                ×
              </button>
            </div>

            <p className="modal-intro">
              로그인 정보는 받지 않습니다. 판매처 링크와 직접 확인한 가격만 이
              브라우저에 저장됩니다.
            </p>

            <form className="capture-form" onSubmit={handleCapture}>
              <label className="wide-field">
                <span>상품 URL</span>
                <input
                  autoFocus
                  type="url"
                  placeholder="https://www.coupang.com/…"
                  value={captureUrl}
                  onChange={(event) => inspectCaptureUrl(event.target.value)}
                />
                <small>
                  쿠팡·네이버 가격비교·코스트코·SSG·주요 면세점 주소는
                  판매처를 자동으로 인식합니다.
                </small>
              </label>

              <label>
                <span>비교할 상품</span>
                <select name="productId" defaultValue={product.id}>
                  {cosmetics.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.brand} {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                <span>구분</span>
                <select
                  value={captureChannel}
                  onChange={(event) =>
                    setCaptureChannel(event.target.value as Channel)
                  }
                >
                  <option value="retail">리테일·온라인몰</option>
                  <option value="duty">온라인 면세점</option>
                </select>
              </label>

              <label className="wide-field">
                <span>판매처 이름</span>
                <input
                  type="text"
                  placeholder="예: 쿠팡 공식판매자"
                  value={captureSource}
                  onChange={(event) => setCaptureSource(event.target.value)}
                  required
                />
              </label>

              <label>
                <span>표시 상품가</span>
                <div className="input-with-unit">
                  <input
                    name="price"
                    type="number"
                    min="1"
                    inputMode="numeric"
                    placeholder="86800"
                    required
                  />
                  <b>원</b>
                </div>
              </label>

              <label>
                <span>배송비</span>
                <div className="input-with-unit">
                  <input
                    name="shipping"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    defaultValue="0"
                  />
                  <b>원</b>
                </div>
              </label>

              <label>
                <span>쿠폰·즉시할인</span>
                <div className="input-with-unit">
                  <input
                    name="discount"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    defaultValue="0"
                  />
                  <b>원</b>
                </div>
              </label>

              <label>
                <span>용량·수량</span>
                <div className="volume-field">
                  <input
                    name="volume"
                    type="number"
                    min="0.01"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="50"
                    required
                  />
                  <b>{product.unit}</b>
                </div>
              </label>

              {captureError && (
                <p className="form-error" role="alert">
                  {captureError}
                </p>
              )}

              <div className="modal-actions wide-field">
                <button type="button" onClick={closeCapture}>
                  취소
                </button>
                <button className="primary" type="submit">
                  저장하고 비교하기
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
