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
  describeFreshnessPolicy,
  MAX_FRESHNESS_DAYS,
} from "./lib/freshness";
import {
  buildVerifiedComparison,
  calculateOfferTotal,
  calculateUnitPrice,
  isSafeExternalUrl,
  selectBestUnitOffer,
  selectPersonalComparison,
  selectPreferredDomesticOffer,
  sessionGapAmount,
  verdictFor,
  type CapturedOffer,
  type Channel,
  type Currency,
  type OfferView,
  type Unit,
  type VerifiedComparison,
} from "./lib/pricing";
import {
  buildIdentityKey,
  createVerifiedPick,
  findExistingPick,
  appendPick,
  normalizeStoredPicks,
  LEGACY_PICK_STORAGE_KEYS,
  PICK_QUARANTINE_KEY,
  PICK_STORAGE_KEY,
  type SavedPickCategory,
  type SavedPickV2,
} from "./lib/saved-picks";
import type { PublishedOffer } from "./lib/price-store";
import { useFocusTrap } from "./lib/use-focus-trap";
import {
  fulfillmentLabelForRetailer,
  normalizeRetailerName,
} from "./lib/retailers";

type Category = "cosmetics" | "liquor";
type PriceBasis = "total" | "unit";
type Taste = "beginner" | "sweet" | "smoky";
type SavedPick = SavedPickV2;

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

// 주류는 취향(taste)으로 고르지만, OCR 은 상품명으로 매칭한다. 캡처가
// 주류 탭에서 열렸으면 주류 카탈로그로 대조해야 발베니를 설화수로 잘못
// 붙이거나 아예 못 읽는 일이 없다.
const liquorOcrCatalog = Object.values(liquors).map((item) => ({
  id: item.catalogId,
  brand: item.label,
  name: item.name,
  unit: "ml" as Unit,
  defaultVolume: item.volume,
}));

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

/**
 * 금액을 저장된 통화로 표시한다.
 *
 * 통화를 스키마에 넣고도 화면에서 전부 `원`을 붙이면, 고치려던 결함이
 * 표시 계층으로 옮겨갈 뿐이다. 등록 경로는 아직 KRW 만 받지만, 다른
 * 경로로 들어온 행이 원화인 척하지 않도록 표시도 값을 따른다.
 */
function formatMoney(value: number, currency: Currency) {
  if (currency === "USD") return `$${won.format(Math.round(value))}`;
  return formatWon(value);
}

/** 자동 확정하지 않은 이유를 사용자가 확인할 수 있는 문장으로 바꾼다. */
function ocrReviewMessage(fields: CartOcrResult): string {
  // 가장 먼저 말한다. 이 경우에는 금액을 아예 채우지 않았으므로, 다른
  // 안내를 앞세우면 "왜 값이 비었는지"에 답하지 못한다.
  if (fields.ambiguities.includes("multiple-products")) {
    return `상품이 ${fields.productCandidates.length}개 보여요. 어느 상품의 가격인지 직접 골라 주세요.`;
  }
  if (fields.ambiguities.includes("seller-conflict")) {
    return "면세점과 국내몰이 함께 보여요. 어느 쪽 가격인지 확인해 주세요.";
  }
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
 * `PublishedOffer`에는 `total`·`variantKey`가 없어 그대로는 비교 후보가
 * 될 수 없다. 통화는 저장된 값을 그대로 쓴다 — 예전에는 여기서 KRW로
 * 단정해, 면세점이 USD로 표시한 가격도 원화처럼 빼고 있었다.
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
    currency: offer.currency,
    variantKey: offer.productId,
    verification: "verified",
    total: offer.finalPrice,
    unitPrice: offer.unitPrice,
    condition: `운영자 검수 · ${shortDateTime.format(offer.observedAt)}`,
  };
}

function evidenceLabel(value: PublishedOffer["evidenceType"]) {
  if (value === "licensed_pickup") return "성인 인증 픽업";
  if (value === "receipt") return "영수증 확인";
  if (value === "store_photo") return "매장 가격표";
  return "공식 원본";
}

/**
 * localStorage 는 잠긴 브라우저에서 접근만으로 SecurityError 를 던진다.
 * 마운트 이펙트 밖으로 던지면 비교함이 아니라 화면 전체가 빈다.
 */
function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

/**
 * 동률로 볼 가격 차이. 카테고리마다 하나뿐이고, 화면의 **모든** 판정이
 * 이 값을 쓴다.
 *
 * 예전에는 헤드라인만 임계값을 통과시키고 그 아래 "현재 비교 결론"과
 * 상품 타일은 차이의 부호만 봤다. 1,000원 차이에서 헤드라인은 "차이가
 * 작아요", 바로 아래는 "출국 예정이라면 온라인 면세" 가 동시에 나왔다.
 */
export const DECISION_THRESHOLD = { cosmetics: 3_000, liquor: 10_000 } as const;

function formatOfferUnitPrice(offer: PublishedOffer) {
  if (offer.category === "liquor" && offer.unit === "ml") {
    return `${formatMoney(offer.unitPrice * 100, offer.currency)}/100ml`;
  }
  return `${formatMoney(offer.unitPrice, offer.currency)}/${offer.unit}`;
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
  const captureModalRef = useFocusTrap<HTMLElement>(captureOpen);
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
  /**
   * 저장소를 온전히 읽지 못했다. 이때는 새 저장도 거부한다 — 화면의 목록이
   * 저장소의 전부가 아니므로, 그 목록을 그대로 쓰면 읽지 못한 행이 지워진다.
   */
  const [storageBlocked, setStorageBlocked] = useState(false);

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
      // 새 캡처는 빈 폼에서 시작한다.
      //
      // "읽지 못한 값은 덮어쓰지 않는다"는 규칙은 한 번의 캡처 안에서
      // 사용자가 적은 값을 지키기 위한 것이다. 그런데 모달을 닫지 않고
      // 두 번째 파일을 고르면, 그 규칙이 **직전 캡처가 넣은 값**까지
      // 지켜버린다. 첫 캡처가 면세점 190,000원을 채우고 둘째 캡처가
      // 가격을 못 읽으면, 다른 상품이 그 금액과 그 판매처로 저장된다.
      // 파일을 새로 고르는 것은 "이걸 대신 읽어라"라는 뜻이므로 비운다.
      setCaptureSource("");
      setCapturePrice("");
      setCaptureShipping("0");
      setCaptureDiscount("0");
      setCaptureVolume("");
      const runId = ocrRunRef.current + 1;
      ocrRunRef.current = runId;

      let worker: Awaited<
        ReturnType<typeof import("tesseract.js")["createWorker"]>
      > | null = null;
      try {
        const { createWorker } = await import("tesseract.js");
        worker = await createWorker(["kor", "eng"], 1, {
          // 자체 호스팅한 실행 자산을 쓴다. 경로를 주지 않으면 worker 와
          // wasm 코어가 jsdelivr 에서 오는데, 그건 제3자 출처가 우리 페이지
          // 안에서 코드를 실행한다는 뜻이다(M-26).
          //
          // `langPath` 는 아직 지정하지 않는다 — 언어 데이터는 저장소에
          // 없고, 어디에 둘지는 따로 정해야 한다. 그래서 CSP 의 CDN 출처도
          // connect-src 에만 남는다.
          workerPath: "/ocr/worker.min.js",
          corePath: "/ocr",
          logger: (message) => {
            if (Number.isFinite(message.progress)) {
              setOcrProgress(Math.max(2, Math.round(message.progress * 100)));
            }
          },
        });
        // 좌표가 있어야 "이 금액이 어느 상품 아래에 있는가"를 물을 수 있다.
        // 평평한 문자열만 쓰던 때는 장바구니에 상품이 둘이면 다른 행의
        // 가격이 현재 상품에 붙었다.
        const result = await worker.recognize(file, {}, { blocks: true });
        if (ocrRunRef.current !== runId) return;
        // 캡처가 열린 카테고리의 카탈로그로만 대조한다.
        const ocrCatalog =
          category === "liquor" ? liquorOcrCatalog : cosmeticOcrCatalog;
        const ocrLines = (result.data.blocks ?? []).flatMap((block) =>
          block.paragraphs.flatMap((paragraph) =>
            paragraph.lines.map((line) => ({
              text: line.text,
              top: line.bbox.y0,
            })),
          ),
        );
        // 블록을 받지 못하면 평평한 텍스트로 물러선다. 그 경우 근접도는
        // 좌표가 아니라 줄 순서로만 잰다.
        const fields = extractCartFields(
          ocrLines.length > 0 ? ocrLines : result.data.text,
          ocrCatalog,
        );

        if (fields.sourceName) setCaptureSource(fields.sourceName);
        if (fields.channel) setCaptureChannel(fields.channel);
        // 상품을 못 읽으면 이전 값을 그대로 두지 않고 미선택으로 만든다.
        // 예전에는 null 을 건너뛰어, 인식 실패한 캡처가 직전에 보던 기본
        // 상품(anr)에 그대로 귀속됐다.
        setCaptureProductId(fields.productId ?? "");
        if (fields.price !== null) setCapturePrice(String(fields.price));
        // 읽지 못한 값은 0 으로 밀어넣지 않는다. 비워 두면 사용자가 무엇을
        // 채워야 하는지 보인다.
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
        // OCR 실행 자산이 없으면 worker 를 만드는 단계에서 죽는다. 캡처
        // 문제와 구분되지 않으면, 자산을 복사하지 않은 개발 환경에서
        // 멀쩡한 캡처를 계속 의심하게 된다.
        const assetsMissing = !(await fetch("/ocr/worker.min.js", {
          method: "HEAD",
        })
          .then((response) => response.ok)
          .catch(() => false));
        setOcrMessage(
          assetsMissing
            ? "OCR 실행 자산을 불러오지 못했습니다. `npm run ocr:assets` 를 실행한 뒤 다시 시도해 주세요."
            : origin === "kakao"
              ? "자동 인식에 실패했습니다. 일회용 링크는 이미 삭제됐으며, 보이는 캡처를 참고해 아래 항목을 직접 입력할 수 있어요."
              : "자동 인식에 실패했습니다. 캡처는 전송되지 않았으며 아래 항목을 직접 확인할 수 있어요.",
        );
      } finally {
        if (worker) await worker.terminate();
      }
    },
    // 플래그가 바뀌면 자동 확정 판정이, 카테고리가 바뀌면 OCR 대조
    // 카탈로그가 달라지므로 둘 다 의존성에 포함한다.
    [flags.AUTO_CONFIRM_ENABLED, category],
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
    let restored: SavedPick[] | null = null;
    let blocked = false;
    // 자기 자신이 격리된 마운트에서는 되쓰지 않는다. 격리한 키를 바로
    // 덮어쓰면 손상 원문이 사라져 복구할 길이 없어진다.
    let primaryQuarantined = false;

    // 새 키를 먼저 읽고, 없을 때만 구 키를 읽기 전용으로 승격한다.
    // 구 번들이 새 키를 필터로 덮어쓰지 못하도록 쓰기는 새 키에만 한다.
    for (const key of [PICK_STORAGE_KEY, ...LEGACY_PICK_STORAGE_KEYS]) {
      const stored = readStorage(key);
      if (!stored) continue;

      const { picks, quarantined, blockedByNewerSchema } =
        normalizeStoredPicks(stored);

      if (quarantined !== null) {
        // 원문은 삭제하지 않고 격리한다. 그리고 return 하지 않고 다음 키로
        // 넘어간다 — 예전에는 한 키가 깨지면 즉시 return 이라, 구 키에 멀쩡한
        // 데이터가 있어도 사용자가 영구히 0개에 갇혔다.
        if (key === PICK_STORAGE_KEY) primaryQuarantined = true;
        writeStorage(
          PICK_QUARANTINE_KEY,
          JSON.stringify({ key, raw: quarantined }),
        );
        continue;
      }

      restored = picks;
      blocked = blockedByNewerSchema;

      // 이해하지 못하는 저장소는 덮어쓰지 않는다. 승격은 다음에 그 행이
      // 사라졌을 때 자연히 끝난다.
      if (!blockedByNewerSchema && !primaryQuarantined) {
        // 원문이 아니라 정규화 결과를 기록해야 schemaVersion·basis 가 영속된다.
        writeStorage(PICK_STORAGE_KEY, JSON.stringify(picks));
      }
      break;
    }

    // 미래 버전 행을 봤다는 사실은 읽기뿐 아니라 쓰기도 막아야 한다.
    // 읽기만 막으면 목록이 비어 보이고 저장 버튼이 열려, 클릭 한 번에
    // 그 행들이 전부 사라진다.
    const shouldBlock = blocked || primaryQuarantined;
    const picks = restored;
    const restoreTimer = window.setTimeout(() => {
      setStorageBlocked(shouldBlock);
      if (picks !== null) setSavedPicks(picks);
    }, 0);
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
  // 내 입력이 섞인 비교. 공개 비교와 **입력 공간을 나눠 갖는다** — 양쪽 다
  // 검수면 여기서 null 이고, 캡처가 하나도 없어도 null 이다. 값 하나가 두
  // 경로로 들어가면 어느 규칙을 따르는지 호출부마다 달라진다.
  const personalComparison = selectPersonalComparison(offers);
  const verifiedDutySourceCount = new Set(
    offers
      .filter((offer) => offer.verification === "verified" && offer.channel === "duty")
      .map((offer) => normalizeRetailerName(offer.source)),
  ).size;
  const verifiedRetailSourceCount = new Set(
    offers
      .filter((offer) => offer.verification === "verified" && offer.channel === "retail")
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
  const decisionThreshold = DECISION_THRESHOLD[category === "cosmetics" ? "cosmetics" : "liquor"];
  // 화장품 비교 카드도 헤드라인과 같은 규칙으로 판정한다. 부호만 보면
  // 임계값 안쪽 차이에서 두 문장이 서로를 부정한다.
  const cosmeticsVerdict =
    cosmeticsComparison === null
      ? null
      : verdictFor(
          cosmeticsComparison.savingsAtRetailVolume,
          DECISION_THRESHOLD.cosmetics,
        );
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
        ? `국내 최저 단위가보다 같은 용량 기준 ${formatMoney(liquorComparison.savingsAtRetailVolume, liquorComparison.duty.currency)} 낮습니다.`
        : liquorVerdictKind === "retail"
          ? `면세 최저 단위가보다 같은 용량 기준 ${formatMoney(Math.abs(liquorComparison.savingsAtRetailVolume), liquorComparison.duty.currency)} 낮습니다.`
          : `같은 용량 기준 차이가 ${formatMoney(Math.abs(liquorComparison.savingsAtRetailVolume), liquorComparison.duty.currency)}로 작습니다.`;
  // 비교가 없으면 결정도 없다. 예전에는 차이가 undefined여도 Math.abs가 NaN을
  // 만들어 "국내 우위" 쪽으로 조용히 기울었다.
  const decisionDifference =
    category === "cosmetics" ? equivalentSavings : liquorSaving;
  // 차이는 비교에서 나오고, 비교는 통화가 같을 때만 만들어진다. 그러니
  // 그 비교의 통화가 차이의 통화다. 비교가 없으면 표시할 차이도 없다.
  const decisionCurrency: Currency =
    (category === "cosmetics"
      ? cosmeticsComparison?.duty.currency
      : liquorComparison?.duty.currency) ?? "KRW";
  const selectedDecisionTitle =
    category === "cosmetics"
      ? `${product.brand} ${product.name}`
      : liquor.name;
  const savedPickCategory: SavedPickCategory =
    category === "cosmetics" ? "cosmetics" : "liquor";
  /**
   * 저장된 선택이 가리키는 것은 **그 병**이지 취향 슬롯이 아니다.
   *
   * 예전에는 여기에 `taste`("beginner")가 들어가서 identity가
   * `liquor:beginner`였다. 그러면 "처음 마셔요"의 추천 병을 바꾸는 순간
   * 이미 저장된 pick 전부가 사용자가 고른 적 없는 상품을 조용히 가리킨다.
   * 내 비교함은 지켜보는 상품의 목록이지 "지금 추천하는 것"의 별명이 아니다.
   *
   * 취향 키로 저장된 기존 pick은 그대로 둔다. 어느 병이었는지 되돌릴 수
   * 없으므로 — 되돌릴 수 없다는 것이 바로 이 결함이다 — 추측하지 않는다.
   * 그 병을 다시 저장하면 항목이 하나 더 생기는데, 눈에 보이는 중복이
   * 보이지 않는 재지정보다 낫다.
   */
  const savedPickProductId =
    category === "cosmetics" ? product.id : liquor.catalogId;
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
              ? `지금 확인된 가격 차이는 ${formatMoney(Math.abs(decisionDifference), decisionCurrency)}이에요`
              : `지금 확인된 가격으로는 ${decisionWinner === "duty" ? "온라인 면세점" : "국내몰"}이 ${formatMoney(Math.abs(decisionDifference), decisionCurrency)} 유리해요`,
            reason: priceGapIsSmall
              ? `가격 차이가 ${formatMoney(Math.abs(decisionDifference), decisionCurrency)}에 불과해 공항 수령보다 국내 배송·픽업이 편리합니다.`
              : decisionWinner === "duty"
                ? `동일 용량 기준 면세 가격이 ${formatMoney(Math.abs(decisionDifference), decisionCurrency)} 낮아 공항 수령을 감수할 가치가 있습니다.`
                : `동일 용량 기준 국내 가격이 ${formatMoney(Math.abs(decisionDifference), decisionCurrency)} 낮아 출국 전 받을 수 있다면 국내 구매가 낫습니다.`,
          };
        })();
  const savedPick = findExistingPick(savedPicks, savedPickIdentity);
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
            currency: itemComparison.duty.currency,
            verdict: verdictFor(
              itemComparison.savingsAtRetailVolume,
              DECISION_THRESHOLD.cosmetics,
            ),
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
    // 직접 입력 가격은 현재 화장품 비교에만 반영된다. 상품을 못 골랐거나
    // 카탈로그에 없으면 저장하지 않는다 — 예전에는 미인식 캡처가 기본
    // 상품(anr)으로 조용히 저장됐다.
    const selectedProduct = cosmetics.find((item) => item.id === productId);

    if (
      !selectedProduct ||
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
      setCaptureError(
        !selectedProduct
          ? "어떤 상품인지 골라주세요. 캡처에서 자동으로 찾지 못했습니다."
          : "판매처, 상품가, 용량을 확인해주세요.",
      );
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

  /**
   * 검수 비교 하나를 내 비교함에 저장한다.
   *
   * 비교를 **인자로 받는다**. 렌더 위치나 페이지 상태로 근거를 추론하지
   * 않는다 — 두 번째 비교면이 생기면 "지금 화면에 검수 비교가 있다"는
   * 사실은 "지금 저장하려는 게 그 비교다"를 뜻하지 않게 된다.
   * `PersonalComparison` 은 `VerifiedComparison` 에 대입되지 않으므로,
   * 내 입력 비교를 여기 넘기려는 시도는 타입 검사에서 걸린다.
   */
  const savePick = useCallback((comparison: VerifiedComparison<OfferView>) => {
    if (savedPick) {
      setStatusMessage("이미 내 비교함에 저장된 선택입니다.");
      return;
    }
    if (storageBlocked) {
      // 새로고침하라고 말하지 않는다. 원인이 저장소 내용이라 다시 읽어도
      // 같은 상태가 되고, 사용자는 풀리지 않는 안내를 반복해서 본다.
      setStatusMessage(
        "더 새로운 버전이 저장한 비교함이 있어, 이 화면에서는 읽지도 덧쓰지도 않습니다. 최신 버전에서 열어 주세요.",
      );
      return;
    }
    void comparison;

    // 저장 직전에 저장소를 다시 읽는다. 화면의 목록은 마운트 시점 스냅샷이라,
    // 그대로 덮어쓰면 다른 탭이 그 사이에 저장한 항목이 조용히 사라진다.
    const current = normalizeStoredPicks(readStorage(PICK_STORAGE_KEY));
    if (current.blockedByNewerSchema || current.quarantined !== null) {
      setStatusMessage(
        "저장소를 온전히 읽지 못해 저장할 수 없습니다. 페이지를 새로고침해 주세요.",
      );
      return;
    }

    // 저장소에서 막 읽은 목록에 새 pick 하나만 더한다. 화면 상태
    // (`savedPicks`)를 다시 섞어 넣으면, identity 를 만들 수 없는 legacy
    // 행이 저장할 때마다 배로 늘어난다.
    const next = appendPick(
      current.picks,
      createVerifiedPick({
        category: savedPickCategory,
        productId: savedPickProductId,
        title: selectedDecisionTitle,
        savedAt: Date.now(),
      }),
    );

    // 저장소가 실패하면 UI 도 저장됐다고 말하지 않는다.
    if (!writeStorage(PICK_STORAGE_KEY, JSON.stringify(next))) {
      setStatusMessage("저장 공간이 부족해 저장하지 못했습니다.");
      return;
    }
    setSavedPicks(next);
    setStatusMessage("내 비교함에 저장했습니다.");
    // `savedPicks` 는 더 이상 읽지 않는다. 저장 목록의 진실은 저장소이고,
    // 화면 상태는 그 스냅샷일 뿐이다.
  }, [
    savedPick,
    storageBlocked,
    savedPickCategory,
    savedPickProductId,
    selectedDecisionTitle,
  ]);

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
          {/* 저장한 선택이 있을 때만 링크를 보인다. 저장 요약은 체리픽
              블록 안에서만 렌더되므로, 비어 있을 때 링크를 두면 갈 곳이 없다. */}
          {/* 링크 대상(`#my-comparisons`)은 체리픽 블록 안에 있고, 그
              블록은 검수 비교가 성립할 때만 렌더된다. 비교가 없을 때
              링크로 두면 눌러도 아무 데도 가지 않는다. */}
          {savedPicks.length > 0 &&
            (quickDecision !== null ? (
              <a className="text-button" href="#my-comparisons">
                내 비교함 {savedPicks.length}
              </a>
            ) : (
              <span className="text-button" aria-disabled="true">
                내 비교함 {savedPicks.length}
              </span>
            ))}
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

      <div className="context-strip" role="group" aria-label="현재 가격 비교 기준">
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
                  <strong>{formatMoney(option.price, decisionCurrency)}</strong>
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
            {activeComparison !== null && (
              <button
                type="button"
                onClick={() => savePick(activeComparison)}
                disabled={savedPick !== undefined || storageBlocked}
              >
                {savedPick ? "저장 완료 ✓" : "이 선택 저장"}
              </button>
            )}
            {savedPicks.length > 0 && (
              <p>
                내 비교함 {savedPicks.length}개
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
                  <strong>{formatMoney(offer.finalPrice, offer.currency)}</strong>
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

      {category === "cosmetics" ? (
        <>
        {cosmeticsComparison ? (
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
                  </div>
                </div>
              </div>

              <div className="recommendation">
                <span className="recommendation-label">현재 비교 결론</span>
                <div>
                  <h3>
                    {cosmeticsVerdict === "duty"
                      ? "출국 예정이라면 온라인 면세"
                      : cosmeticsVerdict === "retail"
                        ? "이번에는 배송 리테일 구매"
                        : "가격 차이가 작아 수령 편의 우선"}
                  </h3>
                  <p>
                    같은 {cosmeticsComparison.comparisonVolume}
                    {cosmeticsComparison.retail.unit} 기준으로{" "}
                    {cosmeticsVerdict === "tie"
                      ? "차이가"
                      : cosmeticsVerdict === "duty"
                        ? "면세 환산가가"
                        : "국내 리테일가가"}{" "}
                    <strong>{formatMoney(Math.abs(cosmeticsComparison.savingsAtRetailVolume), cosmeticsComparison.duty.currency)}</strong>{" "}
                    {cosmeticsVerdict === "tie" ? "밖에 나지 않아요." : "낮아요."}
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
              <div className="basis-toggle" role="group" aria-label="가격 표시 기준">
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
                    <strong>{formatMoney(cosmeticsComparison.duty.total, cosmeticsComparison.duty.currency)}</strong>
                  </div>
                  <div className={basis === "unit" ? "focus" : ""}>
                    <span>단위 가격</span>
                    <strong>{formatMoney(cosmeticsComparison.duty.unitPrice, cosmeticsComparison.duty.currency)}/{cosmeticsComparison.duty.unit}</strong>
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
                    <strong>{formatMoney(cosmeticsComparison.retailPaidTotal, cosmeticsComparison.duty.currency)}</strong>
                  </div>
                  <div className={basis === "unit" ? "focus" : ""}>
                    <span>단위 가격</span>
                    <strong>{formatMoney(cosmeticsComparison.retail.unitPrice, cosmeticsComparison.duty.currency)}/{cosmeticsComparison.retail.unit}</strong>
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
                  면세 {formatMoney(cosmeticsComparison.dutyEquivalentAtRetailVolume, cosmeticsComparison.duty.currency)} · 리테일 {formatMoney(cosmeticsComparison.retailPaidTotal, cosmeticsComparison.duty.currency)}
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
                          {offer.verification === "captured" && (
                            <span className="captured-label">직접 등록</span>
                          )}
                          {offer.verification === "verified" && (
                            <span className="captured-label verified-label">
                              검수 가격
                            </span>
                          )}
                        </td>
                        <td>
                          {offer.volume}
                          {offer.unit}
                        </td>
                        <td>{formatMoney(offer.price, offer.currency)}</td>
                        <td>
                          {[
                            offer.shipping > 0
                              ? `배송 +${formatMoney(offer.shipping, offer.currency)}`
                              : "",
                            offer.discount > 0
                              ? `할인 −${formatMoney(offer.discount, offer.currency)}`
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" · ") || "0원"}
                        </td>
                        <td>{formatMoney(offer.total, offer.currency)}</td>
                        <td>
                          {formatMoney(offer.unitPrice, offer.currency)}/{offer.unit}
                        </td>
                        <td className="row-actions">
                          {/*
                            예전에는 `captured || verified` 로 감싸 예시
                            fixture 행을 걸러냈다. fixture 는 사라졌고
                            `verification` 은 두 값뿐이라 그 조건은 이제
                            언제나 참이다 — 아무것도 거르지 않으면서 무언가를
                            거르는 것처럼 읽히므로 없앤다.
                          */}
                          {offer.url && (
                            <a
                              href={offer.url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              열기 ↗
                            </a>
                          )}
                          {offer.verification === "captured" && (
                            <button
                              type="button"
                              onClick={() => removeCapturedOffer(offer.id)}
                            >
                              삭제
                            </button>
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
                  {offers.some((offer) => offer.verification === "verified")
                    ? "운영자 검수 가격 반영"
                    : "검수 가격 준비 중"}
                </strong>
                <p>
                  {offers.some((offer) => offer.verification === "verified")
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
        )}
        {personalComparison !== null && (
          <section
            className="personal-comparison"
            aria-label="내 입력을 포함한 비교"
          >
            <p className="section-kicker">MY INPUT</p>
            <h2>내 입력 포함 비교</h2>
            <p className="personal-comparison-warning">
              검수되지 않은 내 입력이 포함되어 추천 결론에는 쓰이지 않습니다.
            </p>
            <dl className="personal-comparison-figures">
              <div>
                <dt>
                  {personalComparison.duty.source}
                  {personalComparison.duty.verification === "captured" &&
                    " · 내 입력"}
                </dt>
                <dd>
                  내 입력 기준{" "}
                  {formatMoney(
                    sessionGapAmount(
                      personalComparison.dutyEquivalentAtRetailVolume,
                    ),
                    personalComparison.duty.currency,
                  )}
                </dd>
              </div>
              <div>
                <dt>
                  {personalComparison.retail.source}
                  {personalComparison.retail.verification === "captured" &&
                    " · 내 입력"}
                </dt>
                <dd>
                  내 입력 기준{" "}
                  {formatMoney(
                    sessionGapAmount(personalComparison.retailPaidTotal),
                    personalComparison.retail.currency,
                  )}
                </dd>
              </div>
            </dl>
            <p>
              {personalComparison.comparisonVolume}
              {personalComparison.retail.unit} 기준 차이 내 입력 기준{" "}
              {formatMoney(
                Math.abs(
                  sessionGapAmount(personalComparison.differenceAtRetailVolume),
                ),
                personalComparison.retail.currency,
              )}
            </p>
            <p className="personal-comparison-note">
              {offers.filter((offer) => offer.verification === "captured").length}
              개 가격이 이 비교에만 반영됨 · 이 비교는 저장되지 않습니다 ·
              새로고침하면 사라집니다
            </p>
          </section>
        )}
        </>
      ) : (
        <section className="liquor-section" aria-label="주류 취향과 가격 비교">
          <div className="liquor-intro">
            <div>
              <p className="section-kicker">TASTE FIRST</p>
              <h2>어떤 맛을 좋아하세요?</h2>
            </div>
            <p>취향을 먼저 고르면 가격과 함께 실패 확률이 낮은 한 병을 찾아드려요.</p>
          </div>

          <div className="taste-picker" role="group" aria-label="위스키 취향">
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
                <strong>{formatMoney(liquorComparison.duty.total, liquorComparison.duty.currency)}</strong>
                <b>
                  {formatMoney(liquorComparison.duty.unitPrice * 100, liquorComparison.duty.currency)}/100ml
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
                <strong>{formatMoney(liquorComparison.retailPaidTotal, liquorComparison.duty.currency)}</strong>
                <b>
                  {formatMoney(liquorComparison.retail.unitPrice * 100, liquorComparison.duty.currency)}/100ml
                </b>
                <small>
                  {`운영자 검수 · 국내 ${liquorRetailSourceCount}곳 비교 최저`}
                </small>
              </article>
              <div className="liquor-verdict">
                <span>
                  {liquorVerdictKind === "duty"
                    ? `면세 ${formatMoney(liquorComparison.savingsAtRetailVolume, liquorComparison.duty.currency)} 절약`
                    : liquorVerdictKind === "retail"
                      ? `국내 ${formatMoney(Math.abs(liquorComparison.savingsAtRetailVolume), liquorComparison.duty.currency)} 절약`
                      : `동일 용량 기준 차이 ${formatMoney(Math.abs(liquorComparison.savingsAtRetailVolume), liquorComparison.duty.currency)}`}
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
                {/*
                  주류 구매 링크는 플래그로 막는다. 가격 정보는 그대로
                  보여주되, 판매처로 내보내는 동작만 닫는다 — 주류 판매
                  관련 문구·경로는 법무 검토 전에 열지 않는다.
                  예전에는 이 플래그를 아무도 읽지 않아, 꺼둔 줄 알았던
                  경로가 계속 열려 있었다.
                */}
                {flags.ALCOHOL_COMMERCE_ENABLED &&
                  verifiedLiquorOffers
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
                      <strong>{offer.sourceName} · {formatMoney(offer.finalPrice, offer.currency)}</strong>
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
                <span>최신성 · 최대 {MAX_FRESHNESS_DAYS}일</span>
                <h3>출처에 따라 갱신</h3>
                <p>
                  {describeFreshnessPolicy()}을 기준으로 다시 확인합니다. 이
                  기간이 지난 값은 체리픽 근거에서 빠지고 참고가격으로만
                  남습니다.
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
            ({ item, saving, dutyEquivalent, currency, verdict }) => (
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
                  <b>면세 환산가 {formatMoney(dutyEquivalent, currency)}</b>
                </span>
                <em>
                  {verdict === "duty"
                    ? `면세 ${formatMoney(saving, currency)} 절약`
                    : verdict === "retail"
                      ? `국내 ${formatMoney(Math.abs(saving), currency)} 절약`
                      : `차이 ${formatMoney(Math.abs(saving), currency)}`}
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
            {/* 권리자·판매처가 연락할 곳이 없으면, 첫 조치가 우리에게 오는
                메일이 아니라 호스팅 신고가 된다. */}
            <a href="mailto:Tate_kwon@outlook.com">문의</a>
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
            ref={captureModalRef}
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
              {/* 라벨은 입력만 감싼다. 도움말·미리보기·진행 상태를 label 안에
                  두면 파일 입력의 이름이 그 문장 전체가 되고, OCR 진행률이
                  바뀔 때마다 이름이 갱신된다. 도움말은 aria-describedby 로만
                  연결한다. */}
              <div className="wide-field capture-file-field">
                <label className="capture-file-label">
                  <span>장바구니 캡처</span>
                  <input
                    autoFocus
                    accept="image/png,image/jpeg,image/webp"
                    type="file"
                    aria-describedby="capture-file-help"
                    onChange={(event) => void handleCaptureImage(event)}
                  />
                </label>
                <small id="capture-file-help">
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
              </div>
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
                  {/* 캡처에서 상품을 못 찾으면 값이 비어 이 항목이 선택된다.
                      사용자가 직접 골라야 함을 드러낸다. */}
                  <option value="">상품을 선택하세요</option>
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
