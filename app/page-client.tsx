"use client";

import { ProductImage } from "./components/product-image";
import Link from "next/link";
import {
  type ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AdSlot } from "./components/ad-slot";
import type { AdsenseConfig, RuntimeFlags } from "./lib/runtime-flags";
import { guideArticles } from "./guides/data";
import { extractCartFields, type CartOcrResult } from "./lib/cart-ocr";
import {
  buildVerifiedComparison,
  calculateOfferTotal,
  calculateUnitPrice,
  isSafeExternalUrl,
  selectBestUnitOffer,
  selectPreferredDomesticOffer,
  verdictFor,
  type CapturedOffer,
  type Channel,
  type OfferView,
  type Unit,
} from "./lib/pricing";
import {
  buildIdentityKey,
  createPendingPick,
  findExistingPick,
  normalizeStoredPicks,
  sumVerifiedAmounts,
  LEGACY_PICK_STORAGE_KEYS,
  MAX_SAVED_PICKS,
  PICK_QUARANTINE_KEY,
  PICK_STORAGE_KEY,
  type SavedPickCategory,
  type SavedPickV1,
} from "./lib/saved-picks";
import type { PublishedOffer } from "./lib/price-store";
import {
  fulfillmentLabelForRetailer,
  normalizeRetailerName,
} from "./lib/retailers";

type Category = "cosmetics" | "liquor";
type PriceBasis = "total" | "unit";
type Taste = "beginner" | "sweet" | "smoky";
type SavedPick = SavedPickV1;

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


const travelEssentials = [
  {
    name: "휴대용 멀티 충전기",
    reason: "공항·호텔에서 여러 기기를 한 번에 충전",
    query: "여행용 멀티 충전기 USB C",
  },
  {
    name: "접이식 보조가방",
    reason: "면세·현지 쇼핑으로 늘어난 짐 정리",
    query: "여행용 접이식 보조가방",
  },
  {
    name: "캐리어 무게측정기",
    reason: "출국 전 수하물 무게를 빠르게 확인",
    query: "휴대용 캐리어 무게측정기",
  },
] as const;


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

const cosmeticOcrCatalog = cosmetics.map((item) => ({
  id: item.id,
  brand: item.brand,
  name: item.name,
  unit: item.unit,
  defaultVolume: item.retailVolume,
}));

const liquors: Record<Taste, Liquor> = {
  beginner: {
    taste: "beginner",
    catalogId: "balvenie-doublewood-12",
    label: "입문자 취향",
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
    verdict: "여행 계획이 있다면 면세 가격 우위",
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
    verdict: "달콤한 취향이라면 면세 가격 우위",
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
    verdict: "가격 차이가 작아 가까운 국내 픽업 우선",
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

/** 자동 확정하지 않은 이유를 사용자가 확인할 수 있는 문장으로 바꾼다. */
function ocrReviewMessage(fields: CartOcrResult): string {
  if (fields.ambiguities.includes("installment-detected")) {
    return "할부 안내가 함께 보여요. 결제 총액이 맞는지 확인해 주세요.";
  }
  if (fields.ambiguities.includes("quantity-detected")) {
    return "수량이나 묶음 표기가 보여요. 한 개 기준 가격인지 확인해 주세요.";
  }
  if (fields.ambiguities.includes("total-composition-unclear")) {
    return "상품가·배송비·할인의 합이 최종가와 달라요. 금액을 확인해 주세요.";
  }
  return "채워진 값을 확인하고 빠진 항목만 입력해 주세요.";
}

/**
 * 검수 가격을 비교 계약 형태로 옮긴다.
 * `PublishedOffer`에는 `total`·`currency`·`variantKey`가 없어 그대로는
 * 비교 후보가 될 수 없다. 통화는 아직 스키마에 없으므로 KRW로 고정한다.
 */
function toContractOffer(offer: PublishedOffer): OfferView {
  return {
    id: `verified-${offer.id}`,
    channel: offer.channel,
    source: offer.sourceName,
    url: offer.sourceUrl,
    price: offer.listPrice,
    shipping: offer.shipping,
    discount: offer.instantDiscount,
    volume: offer.volume,
    unit: offer.unit,
    currency: "KRW",
    variantKey: offer.productId,
    verification: "verified",
    total: offer.finalPrice,
    unitPrice: offer.unitPrice,
    condition: `운영자 검수 · ${shortDateTime.format(offer.observedAt)}`,
    captured: false,
    verified: true,
  };
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

function coupangQueryUrl(query: string) {
  return `https://www.coupang.com/np/search?q=${encodeURIComponent(query)}`;
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

export type HomeClientProps = {
  /** 서버가 request-time 에 판독한 플래그. 부재·오타·파싱 실패는 모두 false. */
  flags: RuntimeFlags;
  adsense: AdsenseConfig;
};

export default function HomeClient({ flags, adsense }: HomeClientProps) {
  // 실제 수익 귀속이 있는 링크에만 제휴 표기를 붙인다. 현재 쿠팡 검색 URL에는
  // 제휴 식별자가 없으므로 이 플래그가 켜져도 링크 자체는 중립이다.
  const coupangPartnersActive = flags.MONETIZATION_ENABLED;
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
  const [captureImageName, setCaptureImageName] = useState("");
  const [capturePreviewUrl, setCapturePreviewUrl] = useState("");
  const [captureOrigin, setCaptureOrigin] = useState<"direct" | "kakao">(
    "direct",
  );
  const [captureProductId, setCaptureProductId] = useState("anr");
  const [capturePrice, setCapturePrice] = useState("");
  const [captureShipping, setCaptureShipping] = useState("0");
  const [captureDiscount, setCaptureDiscount] = useState("0");
  const [captureVolume, setCaptureVolume] = useState("");
  const [ocrStatus, setOcrStatus] = useState<
    "idle" | "reading" | "ready" | "partial" | "error"
  >("idle");
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrMessage, setOcrMessage] = useState("");
  const ocrRunRef = useRef(0);
  const capturePreviewUrlRef = useRef("");
  const [statusMessage, setStatusMessage] = useState("");
  const [savedPicks, setSavedPicks] = useState<SavedPick[]>([]);

  const recognizeCaptureFile = useCallback(
    async (file: File, origin: "direct" | "kakao") => {
      if (
        !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
        file.size === 0 ||
        file.size > 12 * 1024 * 1024
      ) {
        setCaptureError("캡처 파일은 12MB 이하의 PNG·JPG·WebP 이미지로 선택해주세요.");
        return;
      }

      if (capturePreviewUrlRef.current) {
        URL.revokeObjectURL(capturePreviewUrlRef.current);
      }
      const nextPreviewUrl = URL.createObjectURL(file);
      capturePreviewUrlRef.current = nextPreviewUrl;
      setCapturePreviewUrl(nextPreviewUrl);
      setCaptureImageName(file.name);
      setCaptureOrigin(origin);
      setCaptureError("");
      setOcrStatus("reading");
      setOcrProgress(2);
      setOcrMessage("브라우저에서 캡처를 읽고 있어요.");
      const runId = ocrRunRef.current + 1;
      ocrRunRef.current = runId;

      let worker: Awaited<
        ReturnType<typeof import("tesseract.js")["createWorker"]>
      > | null = null;
      try {
        const { createWorker } = await import("tesseract.js");
        worker = await createWorker(["kor", "eng"], 1, {
          logger: (message) => {
            if (Number.isFinite(message.progress)) {
              setOcrProgress(Math.max(2, Math.round(message.progress * 100)));
            }
          },
        });
        const result = await worker.recognize(file);
        if (ocrRunRef.current !== runId) return;
        const fields = extractCartFields(result.data.text, cosmeticOcrCatalog);

        if (fields.sourceName) setCaptureSource(fields.sourceName);
        if (fields.channel) setCaptureChannel(fields.channel);
        if (fields.productId) setCaptureProductId(fields.productId);
        if (fields.price !== null) setCapturePrice(String(fields.price));
        // 읽지 못한 값은 덮어쓰지 않는다. 예전에는 null 을 0 으로 밀어넣어
        // 사용자가 직접 적어둔 배송비·쿠폰이 지워졌다.
        if (fields.shipping !== null) setCaptureShipping(String(fields.shipping));
        if (fields.discount !== null) setCaptureDiscount(String(fields.discount));
        if (fields.volume !== null) setCaptureVolume(String(fields.volume));

        const recognizedAll = Boolean(
          fields.sourceName &&
            fields.productId &&
            fields.price !== null &&
            fields.volume !== null,
        );
        // 모호한 입력은 자동 확정하지 않는다. 플래그가 꺼져 있으면 인식이
        // 완전해도 초안 상태로 두고 사용자 확인을 받는다.
        const autoConfirmed =
          recognizedAll &&
          fields.ambiguities.length === 0 &&
          flags.AUTO_CONFIRM_ENABLED;

        setOcrStatus(autoConfirmed ? "ready" : "partial");
        setOcrProgress(100);
        setOcrMessage(
          autoConfirmed
            ? `${fields.recognizedFields.join("·")} 자동 입력 완료${fields.usedFinalPrice ? " · 최종 결제가 기준" : ""}`
            : ocrReviewMessage(fields),
        );
      } catch {
        if (ocrRunRef.current !== runId) return;
        setOcrStatus("error");
        setOcrMessage(
          origin === "kakao"
            ? "자동 인식에 실패했습니다. 일회용 링크는 이미 삭제됐으며, 보이는 캡처를 참고해 아래 항목을 직접 입력할 수 있어요."
            : "자동 인식에 실패했습니다. 캡처는 전송되지 않았으며 아래 항목을 직접 확인할 수 있어요.",
        );
      } finally {
        if (worker) await worker.terminate();
      }
    },
    // 플래그가 바뀌면 자동 확정 판정도 달라져야 하므로 의존성에 포함한다.
    [flags.AUTO_CONFIRM_ENABLED],
  );

  useEffect(() => {
    // 토큰은 fragment 로 온다. fragment 는 서버로 전송되지 않으므로
    // 랜딩 요청 로그에 남지 않는다.
    const currentUrl = new URL(window.location.href);
    const hash = currentUrl.hash.replace(/^#/, "");
    const token = hash.startsWith("kakao_import=")
      ? decodeURIComponent(hash.slice("kakao_import=".length)).trim()
      : "";
    if (!token) return;

    // 주소창과 히스토리에서 즉시 지운다. 그래도 이 시점까지는 브라우저
    // 히스토리와 카카오 대화방에 원문이 남아 있으므로, 짧은 TTL 과 1회
    // 소비가 실질 방어다.
    window.history.replaceState(
      {},
      "",
      `${currentUrl.pathname}${currentUrl.search}`,
    );
    async function loadKakaoCapture() {
      await Promise.resolve();
      setCaptureOrigin("kakao");
      setCaptureOpen(true);
      setOcrStatus("reading");
      setOcrProgress(1);
      setOcrMessage("카카오톡에서 보낸 캡처를 안전하게 가져오고 있어요.");

      try {
        const response = await fetch("/api/kakao/import", {
          method: "POST",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ token }),
        });
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(payload?.error || "캡처 링크를 열지 못했습니다.");
        }

        const blob = await response.blob();
        const extension =
          blob.type === "image/png"
            ? "png"
            : blob.type === "image/webp"
              ? "webp"
              : "jpg";
        const file = new File([blob], `카카오톡-장바구니-캡처.${extension}`, {
          type: blob.type,
        });
        await recognizeCaptureFile(file, "kakao");
      } catch (error) {
        setOcrStatus("error");
        setOcrProgress(0);
        setOcrMessage(
          error instanceof Error
            ? error.message
            : "캡처 링크를 열지 못했습니다.",
        );
      }
    }

    void loadKakaoCapture();
  }, [recognizeCaptureFile]);

  useEffect(() => {
    // v2 키를 먼저 읽고, 없을 때만 구 키를 읽기 전용으로 승격한다.
    // 구 번들이 v2를 필터로 덮어쓰지 못하도록 쓰기는 v2에만 한다.
    let sourceKey: string | null = null;
    let stored: string | null = null;
    for (const key of [PICK_STORAGE_KEY, ...LEGACY_PICK_STORAGE_KEYS]) {
      const value = window.localStorage.getItem(key);
      if (value) {
        sourceKey = key;
        stored = value;
        break;
      }
    }
    if (!stored) return;

    const { picks, quarantined } = normalizeStoredPicks(stored);

    if (quarantined !== null) {
      // 파싱 실패 원문은 삭제하지 않고 격리한다. 다른 키는 건드리지 않는다.
      window.localStorage.setItem(
        PICK_QUARANTINE_KEY,
        JSON.stringify({ key: sourceKey, raw: quarantined }),
      );
      return;
    }

    // 원문이 아니라 정규화 결과를 기록해야 schemaVersion·amountState가 영속된다.
    window.localStorage.setItem(PICK_STORAGE_KEY, JSON.stringify(picks));
    const restoreTimer = window.setTimeout(() => setSavedPicks(picks), 0);
    return () => window.clearTimeout(restoreTimer);
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

  const closeCapture = useCallback(() => {
    ocrRunRef.current += 1;
    if (capturePreviewUrlRef.current) {
      URL.revokeObjectURL(capturePreviewUrlRef.current);
      capturePreviewUrlRef.current = "";
    }
    setCaptureOpen(false);
    setCaptureError("");
    setCaptureImageName("");
    setCapturePreviewUrl("");
    setCaptureUrl("");
    setCaptureSource("");
    setCaptureChannel("retail");
    setCapturePrice("");
    setCaptureShipping("0");
    setCaptureDiscount("0");
    setCaptureVolume("");
    setOcrStatus("idle");
    setOcrProgress(0);
    setOcrMessage("");
    setCaptureOrigin("direct");
  }, []);

  useEffect(() => {
    if (!captureOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      // 모든 닫기 경로가 같은 리셋을 지나야 한다. 예전에는 Escape 만
      // 모달을 숨겨서, 다시 열면 이전 상품의 가격·판매처·미리보기가
      // 남아 있었고 그대로 다른 상품에 제출될 수 있었다.
      if (event.key === "Escape") closeCapture();
    };
    document.addEventListener("keydown", handleKeyDown);
    document.body.classList.add("modal-open");
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.classList.remove("modal-open");
    };
  }, [captureOpen, closeCapture]);

  const product = useMemo(
    () => cosmetics.find((item) => item.id === selectedId) ?? cosmetics[0],
    [selectedId],
  );

  const offers = useMemo<OfferView[]>(() => {
    const verifiedOffers = publishedOffers
      .filter(
        (offer) =>
          !offer.reference &&
          offer.category === "cosmetics" &&
          offer.productId === product.catalogId,
      )
      .map(toContractOffer);

    const userOffers = capturedOffers
      .filter((offer) => offer.productId === product.id)
      .map<OfferView>((offer) => {
        const total = calculateOfferTotal(offer);
        return {
          ...offer,
          currency: "KRW",
          variantKey: product.catalogId,
          verification: "captured",
          total,
          unitPrice: calculateUnitPrice(total, offer.volume),
          condition:
            offer.channel === "duty"
              ? "직접 확인 · 출국장 수령"
              : `직접 확인 · 배송비 ${formatWon(offer.shipping)}`,
          captured: true,
        };
      });

    // 검수 가격과 사용자 직접 입력만 표에 남는다. 예시 fixture는 공개 경로에
    // 들어가지 않으며, 한쪽만 검수된 상태에서도 그 한 건은 표와 출처 수에 남는다.
    return [...verifiedOffers, ...userOffers];
  }, [capturedOffers, product, publishedOffers]);

  // 공개 비교 후보는 검수 가격만이다. 배열 순서 폴백(offers[0]/offers[1])을
  // 쓰지 않으므로 사용자가 캡처한 국내 가격이 면세 자리에 들어갈 수 없고,
  // 후보가 없으면 비교는 0원이 아니라 null이 된다.
  const verifiedCosmeticOffers = offers.filter(
    (offer) => offer.verification === "verified",
  );
  const verifiedCosmeticDuty = selectBestUnitOffer(
    verifiedCosmeticOffers,
    "duty",
  );
  const verifiedCosmeticRetail = selectPreferredDomesticOffer(verifiedCosmeticOffers, (offer) =>
    normalizeRetailerName(offer.source).includes("쿠팡"),
  );
  const cosmeticsComparison =
    verifiedCosmeticDuty && verifiedCosmeticRetail
      ? buildVerifiedComparison(verifiedCosmeticDuty, verifiedCosmeticRetail)
      : null;
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
  const equivalentSavings = cosmeticsComparison?.savingsAtRetailVolume ?? null;
  const liquor = liquors[taste];
  // 주류도 검수 가격만 비교 후보다. 예전에는 검수 데이터가 없으면
  // 하드코딩 카탈로그 가격으로 조용히 대체돼 공개 판정이 만들어졌다.
  const verifiedLiquorOffers = publishedOffers.filter(
    (offer) =>
      !offer.reference &&
      offer.category === "liquor" &&
      offer.productId === liquor.catalogId,
  );
  // 비교 계약을 적용하려면 PublishedOffer에 없는 total·currency·variantKey가
  // 필요하다. 표시는 원본을 그대로 쓰고, 비교만 계약 형태로 변환한다.
  const verifiedLiquorContractOffers =
    verifiedLiquorOffers.map(toContractOffer);
  const verifiedLiquorDuty = selectBestUnitOffer(
    verifiedLiquorContractOffers,
    "duty",
  );
  const verifiedLiquorRetail = selectBestUnitOffer(
    verifiedLiquorContractOffers,
    "retail",
  );
  const liquorComparison =
    verifiedLiquorDuty && verifiedLiquorRetail
      ? buildVerifiedComparison(verifiedLiquorDuty, verifiedLiquorRetail)
      : null;
  const liquorSaving = liquorComparison?.savingsAtRetailVolume ?? null;
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
  // 임계값은 카테고리마다 하나뿐이다. 화면의 모든 결론이 이 값을 쓴다.
  const decisionThreshold = category === "cosmetics" ? 3000 : 10000;
  const liquorVerdictKind =
    liquorComparison === null
      ? null
      : verdictFor(liquorComparison.savingsAtRetailVolume, 10000);
  const liquorVerdict =
    liquorComparison === null || liquorVerdictKind === null
      ? null
      : liquorVerdictKind === "duty"
        ? `${liquorComparison.duty.source} 면세 가격 우위`
        : liquorVerdictKind === "retail"
          ? `${liquorComparison.retail.source} 국내 가격 우위`
          : "가격 차이가 작아 수령 편의 우선";
  const liquorReason =
    liquorComparison === null || liquorVerdictKind === null
      ? null
      : liquorVerdictKind === "duty"
        ? `국내 최저 단위가보다 같은 용량 기준 ${formatWon(liquorComparison.savingsAtRetailVolume)} 낮습니다.`
        : liquorVerdictKind === "retail"
          ? `면세 최저 단위가보다 같은 용량 기준 ${formatWon(Math.abs(liquorComparison.savingsAtRetailVolume))} 낮습니다.`
          : `같은 용량 기준 차이가 ${formatWon(Math.abs(liquorComparison.savingsAtRetailVolume))}로 작습니다.`;
  // 비교가 없으면 결정도 없다. 예전에는 차이가 undefined여도 Math.abs가 NaN을
  // 만들어 "국내 우위" 쪽으로 조용히 기울었다.
  const decisionDifference =
    category === "cosmetics" ? equivalentSavings : liquorSaving;
  const selectedDecisionTitle =
    category === "cosmetics"
      ? `${product.brand} ${product.name}`
      : liquor.name;
  const savedPickCategory: SavedPickCategory =
    category === "cosmetics" ? "cosmetics" : "liquor";
  const savedPickProductId = category === "cosmetics" ? product.id : taste;
  const savedPickIdentity = buildIdentityKey({
    category: savedPickCategory,
    productId: savedPickProductId,
  });
  const quickDecision =
    decisionDifference === null
      ? null
      : (() => {
          const verdict = verdictFor(decisionDifference, decisionThreshold);
          const priceGapIsSmall = verdict === "tie";
          const decisionWinner = verdict === "duty" ? "duty" : "retail";
          return {
            priceGapIsSmall,
            winner: decisionWinner,
            tone: priceGapIsSmall ? "convenience" : decisionWinner,
            heading: priceGapIsSmall
              ? `지금 확인된 가격 차이는 ${formatWon(Math.abs(decisionDifference))}이에요`
              : `지금 확인된 가격으로는 ${decisionWinner === "duty" ? "온라인 면세점" : "국내몰"}이 ${formatWon(Math.abs(decisionDifference))} 유리해요`,
            reason: priceGapIsSmall
              ? `가격 차이가 ${formatWon(Math.abs(decisionDifference))}에 불과해 공항 수령보다 국내 배송·픽업이 편리합니다.`
              : decisionWinner === "duty"
                ? `동일 용량 기준 면세 가격이 ${formatWon(Math.abs(decisionDifference))} 낮아 공항 수령을 감수할 가치가 있습니다.`
                : `동일 용량 기준 국내 가격이 ${formatWon(Math.abs(decisionDifference))} 낮아 출국 전 받을 수 있다면 국내 구매가 낫습니다.`,
          };
        })();
  const savedPick = findExistingPick(savedPicks, savedPickIdentity);
  // Phase 0에서는 검증된 금액이 없으므로 합계는 0이다. 0으로 조용히 더해지는
  // pending·legacy 항목과 실제 검증 금액을 구분하기 위해 전용 함수를 쓴다.
  const savedPickTotal = sumVerifiedAmounts(savedPicks);
  const verifiedCosmeticChecks = useMemo(
    () =>
      cosmetics.flatMap((item) => {
        const itemOffers = publishedOffers.filter(
          (offer) =>
            !offer.reference &&
            offer.category === "cosmetics" &&
            offer.productId === item.catalogId,
        );
        const contractOffers = itemOffers.map(toContractOffer);
        const duty = selectBestUnitOffer(contractOffers, "duty");
        const retail = selectPreferredDomesticOffer(contractOffers, (offer) =>
          normalizeRetailerName(offer.source).includes("쿠팡"),
        );
        if (!duty || !retail) return [];

        const itemComparison = buildVerifiedComparison(duty, retail);
        if (!itemComparison) return [];

        return [
          {
            item,
            duty,
            retail,
            saving: itemComparison.savingsAtRetailVolume,
            dutyEquivalent: itemComparison.dutyEquivalentAtRetailVolume,
          },
        ];
      }),
    [publishedOffers],
  );

  // 결정 카드는 해당 카테고리의 검수 비교가 성립할 때만 만들어진다.
  // 예전에는 비교가 없어도 카드가 만들어지고 값만 폴백으로 채워졌다.
  const activeComparison =
    category === "cosmetics" ? cosmeticsComparison : liquorComparison;
  const dutyDecision =
    activeComparison === null
      ? null
      : {
          title: "온라인 면세점",
          source: activeComparison.duty.source,
          // 환산가는 결제할 수 없는 값이다. 표시에만 쓰고 저장하지 않는다.
          price: activeComparison.dutyEquivalentAtRetailVolume,
          detail: `${activeComparison.comparisonVolume}${activeComparison.retail.unit} 환산 · 공항 수령`,
        };
  const retailDecision =
    activeComparison === null
      ? null
      : {
          title: category === "liquor" ? "국내 픽업" : "국내몰",
          source: activeComparison.retail.source,
          price: activeComparison.retailPaidTotal,
          detail:
            category === "liquor"
              ? `${activeComparison.comparisonVolume}${activeComparison.retail.unit} · 매장 픽업`
              : `${activeComparison.comparisonVolume}${activeComparison.retail.unit} · 배송비 반영`,
        };

  function openCapture() {
    setCaptureOrigin("direct");
    setCaptureProductId(product.id);
    setCaptureVolume(String(product.retailVolume));
    setCaptureOpen(true);
  }


  async function handleCaptureImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setCaptureOrigin("direct");
    await recognizeCaptureFile(file, "direct");
    if (file.size > 12 * 1024 * 1024) event.target.value = "";
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
    const productId = captureProductId;
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
    setCapturedOffers(next);
    setSelectedId(productId);
    setCategory("cosmetics");
    setStatusMessage(`${source} 가격을 비교표에 반영했습니다.`);
    setCaptureUrl("");
    setCaptureSource("");
    setCaptureChannel("retail");
    setCapturePrice("");
    setCaptureShipping("0");
    setCaptureDiscount("0");
    setCaptureVolume("");
    closeCapture();
  }

  function removeCapturedOffer(id: string) {
    const next = capturedOffers.filter((offer) => offer.id !== id);
    setCapturedOffers(next);
    setStatusMessage("직접 등록한 가격을 삭제했습니다.");
  }

  function saveQuickDecision() {
    if (savedPick) {
      setStatusMessage("이미 내 비교함에 저장된 선택입니다.");
      return;
    }
    // Phase 0에서는 금액을 저장하지 않는다. 검증된 결제액 차이의 의미론이
    // 확정되기 전까지 환산가가 절감액으로 굳어지는 경로를 열지 않는다.
    const next = [
      ...savedPicks,
      createPendingPick({
        category: savedPickCategory,
        productId: savedPickProductId,
        title: selectedDecisionTitle,
        savedAt: Date.now(),
      }),
    ].slice(-MAX_SAVED_PICKS);
    setSavedPicks(next);
    window.localStorage.setItem(PICK_STORAGE_KEY, JSON.stringify(next));
    setStatusMessage(
      "내 비교함에 저장했습니다. 금액은 검수 가격이 확인된 뒤 표시됩니다.",
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
      "현재 비교 상품에서 찾지 못했습니다. 장바구니 캡처에서 직접 확인한 가격을 비교할 수 있습니다.",
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
          <a className="text-button" href="#comparison-start">비교하기</a>
          <Link className="text-button" href="/guides">여행가이드</Link>
          <a className="text-button" href="#my-comparisons">
            내 비교함{savedPicks.length > 0 ? ` ${savedPicks.length}` : ""}
          </a>
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
          placeholder="상품명 검색 또는 장바구니 캡처"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          className="search-capture"
          type="button"
          aria-label="장바구니 캡처로 비교"
          title="장바구니 캡처로 비교"
          onClick={openCapture}
        >
          <span aria-hidden="true">▣</span>
        </button>
        <button type="submit">비교하기</button>
      </form>

      <p className="search-helper">
        로그인 없이 비교할 수 있어요. 캡처 이미지는 서버에 저장하지 않습니다.
      </p>

      <p className="status-message" aria-live="polite">
        {statusMessage}
      </p>

      <div className="context-strip" aria-label="현재 가격 비교 기준">
        <span>
          <b>기준</b> 배송비·즉시할인 반영
        </span>
        <span>
          <b>환산</b> 화장품 1ml · 주류 100ml 단가
        </span>
        <span>
          <b>데이터</b>{" "}
          {publishedOffers.some((offer) => !offer.reference)
            ? "운영자 검수 가격만 사용"
            : publishedStatus === "loading"
              ? "검수 가격 불러오는 중"
              : "검수 가격 준비 중"}
        </span>
      </div>

      {quickDecision && dutyDecision && retailDecision ? (
        <section
          className={`quick-decision ${quickDecision.tone}`}
          aria-labelledby="quick-decision-title"
        >
          <div className="quick-decision-copy">
            <span className="cherry-pick-badge">체리<span>픽</span></span>
            <p>{selectedDecisionTitle}</p>
            <h2 id="quick-decision-title">{quickDecision.heading}</h2>
            <p>{quickDecision.reason}</p>
          </div>
          <div
            className={`decision-options ${quickDecision.priceGapIsSmall ? "near-tie" : ""}`}
          >
            {[dutyDecision, retailDecision].map((option, index) => {
              const optionChannel = index === 0 ? "duty" : "retail";
              const selected =
                !quickDecision.priceGapIsSmall &&
                quickDecision.winner === optionChannel;
              return (
                <article className={selected ? "selected" : ""} key={option.title}>
                  <div>
                    <span>
                      {selected
                        ? "체리픽"
                        : quickDecision.priceGapIsSmall
                          ? "비슷한 가격"
                          : "대안"}
                    </span>
                    <h3>{option.title}</h3>
                    <p>{option.source}</p>
                  </div>
                  <strong>{formatWon(option.price)}</strong>
                  <small>{option.detail}</small>
                </article>
              );
            })}
          </div>
          <div className="quick-decision-actions" id="my-comparisons">
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
            <button
              type="button"
              onClick={saveQuickDecision}
              disabled={savedPick !== undefined}
            >
              {savedPick ? "저장 완료 ✓" : "이 선택 저장"}
            </button>
            {savedPicks.length > 0 && (
              <p>
                내 비교함 {savedPicks.length}개
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
              면세점과 국내 판매처 가격이 모두 확인된 경우에만 체리픽과
              절약액을 표시합니다.
            </p>
          </div>
        </section>
      )}

      <details
        className="verified-price-section"
      >
        <summary className="verified-price-heading">
          <div>
            <p className="section-kicker">VERIFIED PRICE FEED</p>
            <h2 id="verified-price-title">확인된 가격 전체 보기</h2>
          </div>
          <span>
            <i aria-hidden="true" />
            {publishedOffers.filter((offer) => !offer.reference).length}개 최신
            {publishedOffers.some((offer) => offer.reference) &&
              ` · ${publishedOffers.filter((offer) => offer.reference).length}개 참고`}
          </span>
        </summary>

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
              원본과 확인 시각을 검수한 가격만 이 영역과 체리픽에 사용합니다.
            </p>
          </div>
        ) : (
          <div className="verified-price-grid">
            {publishedOffers.slice(0, 8).map((offer) => (
              <article className={offer.reference ? "reference-price" : ""} key={offer.id}>
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
                <span className={`evidence-chip ${offer.reference ? "reference" : ""}`}>
                  {offer.reference ? "참고가격" : evidenceLabel(offer.evidenceType)}
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
                  rel="noreferrer"
                >
                  원본 가격 확인 ↗
                </a>
              </article>
            ))}
          </div>
        )}
      </details>

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
          주류
        </button>
      </nav>

      {category === "cosmetics" ? cosmeticsComparison ? (
        <section className="content-grid" aria-label="화장품 가격 비교">
          <div className="main-column">
            <article className="product-summary">
              <div className="product-identity">
                <figure className="product-image">
                  <ProductImage
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
                    <span>면세 {cosmeticsComparison.duty.volume}{cosmeticsComparison.duty.unit}</span>
                    <span>리테일 {cosmeticsComparison.retail.volume}{cosmeticsComparison.retail.unit}</span>
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
                    {cosmeticsComparison.dutyWins
                      ? "출국 예정이라면 온라인 면세"
                      : "이번에는 배송 리테일 구매"}
                  </h3>
                  <p>
                    같은 {cosmeticsComparison.comparisonVolume}
                    {cosmeticsComparison.retail.unit} 기준으로{" "}
                    {cosmeticsComparison.dutyWins ? "면세 환산가가" : "국내 리테일가가"}{" "}
                    <strong>{formatWon(Math.abs(cosmeticsComparison.savingsAtRetailVolume))}</strong>{" "}
                    낮아요.
                  </p>
                </div>
                <div className="saving">
                  <strong>{cosmeticsComparison.savingRate}% 차이</strong>
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
                  <h3>{cosmeticsComparison.duty.source}</h3>
                  <p>
                    {cosmeticsComparison.duty.volume}{cosmeticsComparison.duty.unit} · {cosmeticsComparison.duty.condition}
                  </p>
                </div>
                <div className="offer-values">
                  <div className={basis === "total" ? "focus" : ""}>
                    <span>총 결제가</span>
                    <strong>{formatWon(cosmeticsComparison.duty.total)}</strong>
                  </div>
                  <div className={basis === "unit" ? "focus" : ""}>
                    <span>단위 가격</span>
                    <strong>{formatWon(cosmeticsComparison.duty.unitPrice)}/{cosmeticsComparison.duty.unit}</strong>
                  </div>
                </div>
              </article>

              <article className="offer-card">
                <div>
                  <span className="rank-badge neutral">
                    {verifiedRetailSourceCount > 0
                      ? `${normalizeRetailerName(cosmeticsComparison.retail.source).includes("쿠팡") ? "쿠팡 대표가" : "국내 최저가"} · ${verifiedRetailSourceCount}곳 비교`
                      : "국내 대표 가격"}
                  </span>
                  <h3>{cosmeticsComparison.retail.source}</h3>
                  <p>
                    {cosmeticsComparison.retail.volume}{cosmeticsComparison.retail.unit} · {cosmeticsComparison.retail.condition}
                  </p>
                </div>
                <div className="offer-values">
                  <div className={basis === "total" ? "focus" : ""}>
                    <span>배송비 포함</span>
                    <strong>{formatWon(cosmeticsComparison.retailPaidTotal)}</strong>
                  </div>
                  <div className={basis === "unit" ? "focus" : ""}>
                    <span>단위 가격</span>
                    <strong>{formatWon(cosmeticsComparison.retail.unitPrice)}/{cosmeticsComparison.retail.unit}</strong>
                  </div>
                </div>
              </article>
            </div>

            <div className="equivalent-card">
              <div>
                <span>
                  동일 {cosmeticsComparison.retail.volume}{cosmeticsComparison.retail.unit}로 환산
                </span>
                <strong>
                  면세 {formatWon(cosmeticsComparison.dutyEquivalentAtRetailVolume)} · 리테일 {formatWon(cosmeticsComparison.retailPaidTotal)}
                </strong>
              </div>
              <div className="equivalent-bars" aria-hidden="true">
                <span
                  className="duty-bar"
                  style={{ width: `${Math.min(100, (cosmeticsComparison.dutyEquivalentAtRetailVolume / cosmeticsComparison.retailPaidTotal) * 100)}%` }}
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
                    ? `${offers.filter((offer) => offer.captured).length}개 가격이 현재 비교에만 반영됨`
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
                등록한 가격은 공개 데이터와 섞지 않고 현재 비교에만 반영됩니다.
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
        <section className="liquor-section" aria-label="주류 취향과 가격 비교">
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
                <ProductImage
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

            {liquorComparison ? (
              <div className="liquor-prices">
              <article className="liquor-offer best">
                <span>
                  {liquorComparison.duty.source} ·{" "}
                  {liquorComparison.duty.volume}ml
                </span>
                <strong>{formatWon(liquorComparison.duty.total)}</strong>
                <b>
                  {formatWon(liquorComparison.duty.unitPrice * 100)}/100ml
                </b>
                <small>
                  {`운영자 검수 · 면세 ${liquorDutySourceCount}곳 비교 최저`}
                </small>
              </article>
              <article className="liquor-offer">
                <span>
                  {liquorComparison.retail.source} ·{" "}
                  {liquorComparison.comparisonVolume}ml
                </span>
                <strong>{formatWon(liquorComparison.retailPaidTotal)}</strong>
                <b>
                  {formatWon(liquorComparison.retail.unitPrice * 100)}/100ml
                </b>
                <small>
                  {`운영자 검수 · 국내 ${liquorRetailSourceCount}곳 비교 최저`}
                </small>
              </article>
              <div className="liquor-verdict">
                <span>
                  {liquorVerdictKind === "duty"
                    ? `면세 ${formatWon(liquorComparison.savingsAtRetailVolume)} 절약`
                    : liquorVerdictKind === "retail"
                      ? `국내 ${formatWon(Math.abs(liquorComparison.savingsAtRetailVolume))} 절약`
                      : `동일 용량 기준 차이 ${formatWon(Math.abs(liquorComparison.savingsAtRetailVolume))}`}
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
                      rel="noreferrer"
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
          <p className="section-kicker">CART CAPTURE PILOT</p>
          <h2>장바구니 캡처로 내 가격을 반영하세요.</h2>
          <p>
            면세점 쿠폰과 회원가는 사람마다 달라요. 캡처에서 상품·판매처·가격을
            자동으로 읽고, 확인된 값만 같은 용량으로 다시 계산합니다.
          </p>
        </div>
        <div className="capture-steps">
          <span>
            <b>1</b> 캡처 선택
          </span>
          <span>
            <b>2</b> 자동 인식 확인
          </span>
          <span>
            <b>3</b> 단위가 자동 비교
          </span>
        </div>
        <button type="button" onClick={openCapture}>
          캡처로 비교하기 ↗
        </button>
      </section>

      {verifiedCosmeticChecks.length > 0 && (
      <section className="more-products">
        <div className="section-heading">
          <div>
            <p className="section-kicker">POPULAR CHECKS</p>
            <h2>비교 가능한 화장품</h2>
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
                  <ProductImage
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
            <p className="section-kicker">TRAVEL SHOPPING GUIDES</p>
            <h2 id="guide-preview-title">여행 쇼핑을 더 쉽게</h2>
          </div>
          <Link href="/guides">여행가이드 전체 보기 →</Link>
        </div>
        <div className="guide-preview-grid">
          {guideArticles.map((article) => (
            <Link href={`/guides/${article.slug}`} key={article.slug}>
              <span className="guide-card-image">
                <ProductImage
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

      <AdSlot client={adsense.client} slot={adsense.homeContentSlot} />

      <section className="travel-essentials" aria-labelledby="travel-essentials-title">
        <div className="section-heading">
          <div>
            <p className="section-kicker">TRAVEL ESSENTIALS</p>
            <h2 id="travel-essentials-title">쇼핑 전 함께 챙길 것</h2>
          </div>
          <Link href="/guides">여행 준비 팁 보기 →</Link>
        </div>
        <div className="travel-essential-grid">
          {travelEssentials.map((item) => (
            <a
              href={coupangQueryUrl(item.query)}
              key={item.name}
              target="_blank"
              rel={coupangPartnersActive ? "noreferrer sponsored" : "noreferrer"}
            >
              <span>여행 준비물</span>
              <strong>{item.name}</strong>
              <p>{item.reason}</p>
              <b>쿠팡에서 확인 ↗</b>
            </a>
          ))}
        </div>
        {coupangPartnersActive && (
          <p className="affiliate-group-disclosure">
            이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의
            수수료를 제공받습니다.
          </p>
        )}
      </section>

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
              참고가격으로 낮춰 표시하고 체리픽 계산에서는 제외합니다. 실제
              구매 전 판매처에서 재확인해야 합니다.
            </p>
          </article>
        </div>

        <div className="coupang-checks">
          <div>
            <span className="partner-badge">쿠팡 가격 확인</span>
            <h3>비교 상품을 쿠팡에서 직접 확인하세요.</h3>
            <p>
              상품명만 비슷한 판매 페이지일 수 있으니 용량·구성·판매자를
              확인한 뒤 최종 가격을 비교하세요.
            </p>
            {coupangPartnersActive && (
              <p className="affiliate-disclosure">
                이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의
                수수료를 제공받습니다.
              </p>
            )}
          </div>
          <div className="coupang-link-list">
            {cosmetics.map((item) => (
              <a
                key={item.id}
                href={coupangSearchUrl(item)}
                target="_blank"
                rel={coupangPartnersActive ? "noreferrer sponsored" : "noreferrer"}
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
            <Link href="/guides">여행가이드</Link>
            <Link href="/privacy">개인정보처리방침</Link>
            <Link href="/terms">이용약관</Link>
            <Link href="/price-contribution">가격정보 제공 동의</Link>
            <Link href="/advertising">광고·제휴 원칙</Link>
          </nav>
          {coupangPartnersActive && (
            <p>
              이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의
              수수료를 제공받습니다.
            </p>
          )}
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
                <p className="section-kicker">CART CAPTURE PILOT</p>
                <h2 id="capture-title">장바구니 캡처로 비교</h2>
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
              {captureOrigin === "kakao"
                ? "카카오톡의 임시 이미지는 체리피커 서버에 저장하지 않았습니다. 일회용 링크를 통해 기기 안에서 자동 인식하며, 상품·판매처·가격만 현재 비교에 반영합니다."
                : "캡처는 서버로 전송하거나 저장하지 않습니다. 기기 안에서 자동 인식한 뒤 상품·판매처·가격만 남기고 인식 원문은 즉시 버립니다."}
            </p>

            <form className="capture-form" onSubmit={handleCapture}>
              <label className="wide-field capture-file-field">
                <span>장바구니 캡처</span>
                <input
                  autoFocus
                  accept="image/png,image/jpeg,image/webp"
                  type="file"
                  onChange={(event) => void handleCaptureImage(event)}
                />
                <small>
                  {captureImageName
                    ? `${captureImageName} · 이 화면을 닫으면 선택이 사라집니다.`
                    : captureOrigin === "kakao"
                      ? "링크가 만료됐으면 카카오톡에서 캡처를 다시 보내주세요."
                      : "주문번호·주소·연락처는 가능하면 가린 뒤 선택해주세요."}
                </small>
                {capturePreviewUrl && (
                  <span className="capture-preview" aria-hidden="true">
                    <ProductImage
                      src={capturePreviewUrl}
                      alt=""
                      width={160}
                      height={200}
                    />
                  </span>
                )}
                {ocrStatus !== "idle" && (
                  <span className={`ocr-status ${ocrStatus}`} aria-live="polite">
                    <span>
                      <i style={{ width: `${ocrProgress}%` }} />
                    </span>
                    <b>{ocrStatus === "reading" ? `${ocrProgress}%` : "확인 필요"}</b>
                    <small>{ocrMessage}</small>
                  </span>
                )}
              </label>
              <label className="wide-field">
                <span>상품 URL</span>
                <input
                  type="url"
                  placeholder="https://www.coupang.com/…"
                  value={captureUrl}
                  onChange={(event) => inspectCaptureUrl(event.target.value)}
                />
                <small>
                  선택 사항 · 쿠팡·올리브영·주요 면세점 주소는 판매처를
                  자동으로 인식합니다.
                </small>
              </label>

              <label>
                <span>비교할 상품</span>
                <select
                  name="productId"
                  value={captureProductId}
                  onChange={(event) => {
                    const nextId = event.target.value;
                    const nextProduct = cosmetics.find((item) => item.id === nextId);
                    setCaptureProductId(nextId);
                    if (nextProduct && ocrStatus === "idle") {
                      setCaptureVolume(String(nextProduct.retailVolume));
                    }
                  }}
                >
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
                    value={capturePrice}
                    onChange={(event) => setCapturePrice(event.target.value)}
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
                    value={captureShipping}
                    onChange={(event) => setCaptureShipping(event.target.value)}
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
                    value={captureDiscount}
                    onChange={(event) => setCaptureDiscount(event.target.value)}
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
                    value={captureVolume}
                    onChange={(event) => setCaptureVolume(event.target.value)}
                    required
                  />
                  <b>
                    {cosmetics.find((item) => item.id === captureProductId)?.unit ??
                      product.unit}
                  </b>
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
                <button className="primary" type="submit" disabled={ocrStatus === "reading"}>
                  현재 비교에 반영
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
