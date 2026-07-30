"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AdSlot } from "./components/ad-slot";
import { guideArticles } from "./guides/data";

type Category = "cosmetics" | "liquor";
type PriceBasis = "total" | "unit";
type Taste = "beginner" | "sweet" | "smoky";
type Channel = "duty" | "retail";
type Unit = "ml" | "g" | "개";

type Cosmetic = {
  id: string;
  brand: string;
  name: string;
  short: string;
  unit: Unit;
  dutyVolume: number;
  retailVolume: number;
  dutyPrice: number;
  retailBasePrice: number;
  shipping: number;
  dutyCondition: string;
  retailSource: string;
  retailCondition: string;
  match: number;
  freshness: string;
};

type Liquor = {
  taste: Taste;
  label: string;
  name: string;
  tags: string[];
  summary: string;
  sweet: number;
  smoke: number;
  body: number;
  dutyPrice: number;
  retailPrice: number;
  distance: string;
  verdict: string;
  reason: string;
};

type CapturedOffer = {
  id: string;
  productId: string;
  channel: Channel;
  source: string;
  url: string;
  price: number;
  shipping: number;
  discount: number;
  volume: number;
  unit: Unit;
  createdAt: number;
};

type OfferView = {
  id: string;
  channel: Channel;
  source: string;
  url: string;
  price: number;
  shipping: number;
  discount: number;
  volume: number;
  unit: Unit;
  total: number;
  unitPrice: number;
  condition: string;
  captured: boolean;
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

const storageKey = "salkka-captured-offers-v1";

const cosmetics: Cosmetic[] = [
  {
    id: "anr",
    brand: "에스티 로더",
    name: "어드밴스드 나이트 리페어",
    short: "ANR",
    unit: "ml",
    dutyVolume: 100,
    retailVolume: 50,
    dutyPrice: 138000,
    retailBasePrice: 86800,
    shipping: 3000,
    dutyCondition: "쿠폰 적용 · 출국장 수령",
    retailSource: "리테일몰 A",
    retailCondition: "일반배송 · 배송비 포함",
    match: 98,
    freshness: "12분 전",
  },
  {
    id: "skii",
    brand: "SK-II",
    name: "페이셜 트리트먼트 에센스",
    short: "SK",
    unit: "ml",
    dutyVolume: 230,
    retailVolume: 160,
    dutyPrice: 179000,
    retailBasePrice: 139000,
    shipping: 3000,
    dutyCondition: "회원 할인 적용 · 출국장 수령",
    retailSource: "공식 브랜드몰",
    retailCondition: "일반배송 · 배송비 포함",
    match: 97,
    freshness: "28분 전",
  },
  {
    id: "sulwhasoo",
    brand: "설화수",
    name: "자음생크림 클래식",
    short: "雪",
    unit: "ml",
    dutyVolume: 60,
    retailVolume: 50,
    dutyPrice: 139000,
    retailBasePrice: 128000,
    shipping: 0,
    dutyCondition: "적립금 적용 · 출국장 수령",
    retailSource: "쿠팡 공식판매자",
    retailCondition: "무료배송",
    match: 96,
    freshness: "35분 전",
  },
];

const liquors: Record<Taste, Liquor> = {
  beginner: {
    taste: "beginner",
    label: "입문자 추천",
    name: "발베니 12 더블우드",
    tags: ["꿀", "말린 과일", "오크"],
    summary:
      "향이 부드럽고 단맛과 나무 향의 균형이 좋아 처음 고르는 한 병으로 실패 확률이 낮아요.",
    sweet: 4,
    smoke: 1,
    body: 3,
    dutyPrice: 89000,
    retailPrice: 109900,
    distance: "1.8km",
    verdict: "여행 계획이 있다면 면세 구매 추천",
    reason: "가격 차이가 충분하고, 선물용으로도 무난한 스타일이에요.",
  },
  sweet: {
    taste: "sweet",
    label: "달콤한 취향",
    name: "글렌모렌지 라산타 12",
    tags: ["건포도", "초콜릿", "계피"],
    summary:
      "셰리 캐스크의 달콤한 과일과 초콜릿 느낌이 선명해 식후에 편하게 즐기기 좋아요.",
    sweet: 5,
    smoke: 1,
    body: 3,
    dutyPrice: 74000,
    retailPrice: 92000,
    distance: "2.4km",
    verdict: "달콤한 위스키를 찾는다면 면세 구매 추천",
    reason: "취향과 가격 우위가 모두 분명해 디저트 위스키로 잘 맞아요.",
  },
  smoky: {
    taste: "smoky",
    label: "강한 개성",
    name: "라프로익 10",
    tags: ["피트", "바다", "약초"],
    summary:
      "연기와 바다 향이 강한 전형적인 피트 위스키예요. 호불호가 커서 취향 확인이 먼저입니다.",
    sweet: 2,
    smoke: 5,
    body: 4,
    dutyPrice: 68000,
    retailPrice: 73900,
    distance: "1.2km",
    verdict: "가격 차이가 작아 가까운 국내 픽업 추천",
    reason: "공항 수령 번거로움보다 절감액이 작아 먼저 잔술로 취향을 확인해도 좋아요.",
  },
};

const won = new Intl.NumberFormat("ko-KR");

function formatWon(value: number) {
  return `${won.format(Math.round(value))}원`;
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
  const [alertActive, setAlertActive] = useState(false);
  const [captureOpen, setCaptureOpen] = useState(false);
  const [captureUrl, setCaptureUrl] = useState("");
  const [captureSource, setCaptureSource] = useState("");
  const [captureChannel, setCaptureChannel] = useState<Channel>("retail");
  const [capturedOffers, setCapturedOffers] = useState<CapturedOffer[]>([]);
  const [captureError, setCaptureError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return;
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        setCapturedOffers(parsed);
      }
    } catch {
      window.localStorage.removeItem(storageKey);
    }
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
        source: "온라인 면세 최저가",
        url: "",
        price: product.dutyPrice + 15000,
        shipping: 0,
        discount: 15000,
        volume: product.dutyVolume,
        unit: product.unit,
        total: product.dutyPrice,
        unitPrice: product.dutyPrice / product.dutyVolume,
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
        total: product.retailBasePrice + product.shipping,
        unitPrice:
          (product.retailBasePrice + product.shipping) / product.retailVolume,
        condition: product.retailCondition,
        captured: false,
      },
    ];

    const userOffers = capturedOffers
      .filter((offer) => offer.productId === product.id)
      .map<OfferView>((offer) => {
        const total = Math.max(
          0,
          offer.price + offer.shipping - offer.discount,
        );
        return {
          ...offer,
          total,
          unitPrice: total / offer.volume,
          condition:
            offer.channel === "duty"
              ? "직접 확인 · 출국장 수령"
              : `직접 확인 · 배송비 ${formatWon(offer.shipping)}`,
          captured: true,
        };
      });

    return [...baseOffers, ...userOffers];
  }, [capturedOffers, product]);

  const bestDuty =
    offers
      .filter((offer) => offer.channel === "duty")
      .sort((a, b) => a.total - b.total)[0] ?? offers[0];
  const bestRetail =
    offers
      .filter((offer) => offer.channel === "retail")
      .sort((a, b) => a.total - b.total)[0] ?? offers[1];
  const retailPrice = bestRetail.total;
  const dutyUnit = bestDuty.unitPrice;
  const retailUnit = bestRetail.unitPrice;
  const dutyEquivalent = dutyUnit * bestRetail.volume;
  const equivalentSavings = retailPrice - dutyEquivalent;
  const dutyWins = equivalentSavings > 0;
  const savingRate = Math.round(
    (Math.abs(equivalentSavings) / retailPrice) * 100,
  );
  const liquor = liquors[taste];
  const liquorSaving = liquor.retailPrice - liquor.dutyPrice;
  const spotlightItems = useMemo(
    () => [
      ...cosmetics.map((item) => {
        const retailTotal = item.retailBasePrice + item.shipping;
        const dutyUnitPrice = item.dutyPrice / item.dutyVolume;
        const retailUnitPrice = retailTotal / item.retailVolume;
        const equivalentSaving =
          retailTotal - dutyUnitPrice * item.retailVolume;

        return {
          key: `cosmetics-${item.id}`,
          category: "cosmetics" as Category,
          productId: item.id,
          taste: undefined,
          badge: equivalentSaving >= 15000 ? "면세 추천" : "가격 체크",
          eyebrow: "화장품",
          title: `${item.brand} ${item.name}`,
          decision:
            equivalentSaving > 0
              ? `같은 용량이면 면세가 ${formatWon(equivalentSaving)} 저렴`
              : "배송 리테일이 더 유리",
          dutyPrice: item.dutyPrice,
          retailPrice: retailTotal,
          dutyUnitPrice,
          retailUnitPrice,
          unitLabel: `/${item.unit}`,
          saving: equivalentSaving,
          freshness: item.freshness,
        };
      }),
      ...Object.values(liquors).map((item) => ({
        key: `liquor-${item.taste}`,
        category: "liquor" as Category,
        productId: undefined,
        taste: item.taste,
        badge:
          item.taste === "beginner"
            ? "입문 추천"
            : item.retailPrice - item.dutyPrice > 10000
              ? "면세 추천"
              : "국내 구매",
        eyebrow: "위스키",
        title: item.name,
        decision:
          item.retailPrice - item.dutyPrice > 10000
            ? `면세 구매 시 ${formatWon(item.retailPrice - item.dutyPrice)} 절약`
            : "가격 차이가 작아 국내 픽업 추천",
        dutyPrice: item.dutyPrice,
        retailPrice: item.retailPrice,
        dutyUnitPrice: item.dutyPrice / 7,
        retailUnitPrice: item.retailPrice / 7,
        unitLabel: "/100ml",
        saving: item.retailPrice - item.dutyPrice,
        freshness: "오늘 확인",
      })),
    ].sort((a, b) => b.saving - a.saving),
    [],
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
    const form = new FormData(event.currentTarget);
    const productId = String(form.get("productId") ?? "");
    const price = Number(form.get("price"));
    const shipping = Number(form.get("shipping") || 0);
    const discount = Number(form.get("discount") || 0);
    const volume = Number(form.get("volume"));
    const source = captureSource.trim();
    const selectedProduct =
      cosmetics.find((item) => item.id === productId) ?? cosmetics[0];

    if (!productId || !source || price <= 0 || volume <= 0) {
      setCaptureError("판매처, 상품가, 용량을 확인해주세요.");
      return;
    }

    if (captureUrl && !providerFromUrl(captureUrl)) {
      try {
        new URL(captureUrl);
      } catch {
        setCaptureError("판매처 URL 형식을 확인해주세요.");
        return;
      }
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

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = query.trim().toLowerCase();
    if (!normalized) return;

    if (
      ["주류", "위스키", "와인", "발베니", "라프로익", "글렌모렌지"].some(
        (keyword) => normalized.includes(keyword),
      )
    ) {
      setCategory("liquor");
      return;
    }

    const found = cosmetics.find((item) =>
      `${item.brand} ${item.name}`.toLowerCase().includes(normalized),
    );
    if (found) {
      setSelectedId(found.id);
      setCategory("cosmetics");
    }
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <a className="brand" href="#top" aria-label="살까 홈">
          살까<span>?</span>
        </a>
        <div className="top-actions">
          <a className="text-button" href="/guides">
            가격 가이드
          </a>
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
          <button className="avatar-button" type="button" aria-label="내 설정">
            MY
          </button>
        </div>
      </header>

      <aside className="affiliate-notice" aria-label="쿠팡 파트너스 제휴 안내">
        <div>
          <strong>쿠팡 파트너스 제휴 안내</strong>
          <p>
            이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의
            수수료를 제공받을 수 있습니다.
          </p>
        </div>
        <span>제휴 여부는 가격 순위와 추천 계산에 영향을 주지 않습니다.</span>
      </aside>

      <section className="hero" id="top">
        <div>
          <p className="eyebrow">면세와 리테일, 이제 같은 기준으로</p>
          <h1>
            총액으로 비교하고,
            <br />
            취향까지 추천받아요.
          </h1>
        </div>
        <p className="hero-copy">
          배송비·쿠폰·용량 차이를 반영한 실제 구매 판단
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
          placeholder="상품명, 브랜드 또는 링크를 입력하세요"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit">비교하기</button>
      </form>

      <p className="status-message" aria-live="polite">
        {statusMessage}
      </p>

      <div className="context-strip" aria-label="적용 중인 구매 조건">
        <span>
          <b>출국</b> 8월 18일 · 인천 T1
        </span>
        <span>
          <b>회원</b> 쿠팡 와우 · 코스트코
        </span>
        <button type="button">조건 변경 ↗</button>
      </div>

      <section className="discovery-section" aria-labelledby="discovery-title">
        <div className="discovery-heading">
          <div>
            <p className="section-kicker">AUTOMATIC PICKS</p>
            <h2 id="discovery-title">지금 살 만한 상품</h2>
            <p>
              검색하지 않아도 최근 확인가와 단위가격을 기준으로 먼저 골랐어요.
            </p>
          </div>
          <div className="feed-status">
            <span aria-hidden="true" />
            쿠팡·네이버 비교 구조 준비
          </div>
        </div>

        <div className="spotlight-grid">
          {spotlightItems.map((item, index) => (
            <button
              className="spotlight-card"
              type="button"
              key={item.key}
              onClick={() => {
                if (item.category === "cosmetics" && item.productId) {
                  setSelectedId(item.productId);
                  setCategory("cosmetics");
                }
                if (item.category === "liquor" && item.taste) {
                  setTaste(item.taste);
                  setCategory("liquor");
                }
                setStatusMessage(`${item.title} 상세 비교를 열었습니다.`);
                window.setTimeout(() => {
                  document
                    .getElementById("comparison-start")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 0);
              }}
            >
              <span className="spotlight-topline">
                <span className="spotlight-rank">{index + 1}</span>
                <span className="spotlight-category">{item.eyebrow}</span>
                <span className="spotlight-badge">{item.badge}</span>
              </span>
              <strong className="spotlight-title">{item.title}</strong>
              <span className="spotlight-decision">{item.decision}</span>
              <span className="spotlight-prices">
                <span>
                  <small>온라인 면세</small>
                  <b>{formatWon(item.dutyPrice)}</b>
                  <em>
                    {formatWon(item.dutyUnitPrice)}
                    {item.unitLabel}
                  </em>
                </span>
                <i aria-hidden="true">vs</i>
                <span>
                  <small>
                    {item.category === "liquor"
                      ? "국내 픽업"
                      : "리테일 최저가"}
                  </small>
                  <b>{formatWon(item.retailPrice)}</b>
                  <em>
                    {formatWon(item.retailUnitPrice)}
                    {item.unitLabel}
                  </em>
                </span>
              </span>
              <span className="spotlight-footer">
                <span>● {item.freshness}</span>
                <b>상세 비교 →</b>
              </span>
            </button>
          ))}
        </div>
        <p className="feed-note">
          현재는 프로토타입 예시 가격입니다. 실제 서비스에서는 승인된 API와
          브라우저 수집 가격이 자동 갱신됩니다.
        </p>
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

      {category === "cosmetics" ? (
        <section className="content-grid" aria-label="화장품 가격 비교">
          <div className="main-column">
            <article className="product-summary">
              <div className="product-identity">
                <div className="product-bottle" aria-hidden="true">
                  <span>{product.short}</span>
                </div>
                <div>
                  <p className="product-brand">{product.brand}</p>
                  <h2>{product.name}</h2>
                  <div className="meta-row">
                    <span>면세 {bestDuty.volume}{bestDuty.unit}</span>
                    <span>리테일 {bestRetail.volume}{bestRetail.unit}</span>
                    <span>매칭 {product.match}%</span>
                    {offers.some((offer) => offer.captured) && (
                      <span>직접 등록 가격 반영</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="recommendation">
                <span className="recommendation-label">오늘의 결론</span>
                <div>
                  <h3>
                    {dutyWins
                      ? "출국 예정이라면 온라인 면세"
                      : "이번에는 배송 리테일 구매"}
                  </h3>
                  <p>
                    용량을 맞춰 계산하면 {bestRetail.volume}
                    {bestRetail.unit} 환산가가{" "}
                    <strong>{formatWon(Math.abs(equivalentSavings))}</strong>{" "}
                    {dutyWins ? "낮아요." : "더 높아요."}
                  </p>
                </div>
                <div className="saving">
                  <strong>{savingRate}% {dutyWins ? "↓" : "↑"}</strong>
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
                  <span className="rank-badge">단위가 1위</span>
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
                  <span className="rank-badge neutral">총액 1위</span>
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
                        </td>
                        <td>
                          {offer.volume}
                          {offer.unit}
                        </td>
                        <td>{formatWon(offer.price)}</td>
                        <td>
                          {offer.shipping > 0
                            ? `+${formatWon(offer.shipping)}`
                            : offer.discount > 0
                              ? `−${formatWon(offer.discount)}`
                              : "0원"}
                        </td>
                        <td>{formatWon(offer.total)}</td>
                        <td>
                          {formatWon(offer.unitPrice)}/{offer.unit}
                        </td>
                        <td className="row-actions">
                          {offer.captured && (
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
                            <button
                              type="button"
                              onClick={() => removeCapturedOffer(offer.id)}
                            >
                              삭제
                            </button>
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
            <div className="alert-card">
              <p className="section-kicker">PRICE ALERT</p>
              <h3>조금 더 기다릴까요?</h3>
              <p>면세가가 130,000원 아래로 내려가면 알려드릴게요.</p>
              <button
                type="button"
                className={alertActive ? "active" : ""}
                onClick={() => setAlertActive((current) => !current)}
              >
                {alertActive ? "✓ 알림 설정됨" : "가격 알림 받기"}
              </button>
            </div>

            <div className="source-card">
              <span className="source-dot" aria-hidden="true" />
              <div>
                <strong>
                  {offers.some((offer) => offer.captured)
                    ? "직접 확인 가격 반영"
                    : "가격 신뢰도 높음"}
                </strong>
                <p>
                  {offers.filter((offer) => offer.captured).length
                    ? `${offers.filter((offer) => offer.captured).length}개 가격이 이 브라우저에 저장됨`
                    : `마지막 확인 ${product.freshness}`}
                </p>
              </div>
            </div>

            <div className="limit-card">
              <p className="section-kicker">MY TRIP</p>
              <h3>면세 한도 체크</h3>
              <div className="limit-row">
                <span>일반 물품</span>
                <strong>US$ 245 / 800</strong>
              </div>
              <div className="limit-track">
                <span style={{ width: "31%" }} />
              </div>
              <p>현재 장바구니 기준으로 한도 안이에요.</p>
            </div>
          </aside>
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
              <div className="whisky-bottle" aria-hidden="true">
                <span>12</span>
              </div>
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

            <div className="liquor-prices">
              <article className="liquor-offer best">
                <span>온라인 면세 · 700ml</span>
                <strong>{formatWon(liquor.dutyPrice)}</strong>
                <b>{formatWon(liquor.dutyPrice / 7)}/100ml</b>
                <small>출국장 수령 · 면세 한도 1병 사용</small>
              </article>
              <article className="liquor-offer">
                <span>국내 픽업 최저가 · 700ml</span>
                <strong>{formatWon(liquor.retailPrice)}</strong>
                <b>{formatWon(liquor.retailPrice / 7)}/100ml</b>
                <small>가까운 픽업 매장 {liquor.distance}</small>
              </article>
              <div className="liquor-verdict">
                <span>
                  면세 {formatWon(liquorSaving)} {liquorSaving > 10000 ? "절약" : "차이"}
                </span>
                <h3>{liquor.verdict}</h3>
                <p>{liquor.reason}</p>
              </div>
            </div>
          </div>

          <div className="alcohol-note">
            <strong>주류 비교 기준</strong>
            <span>
              일반 주류는 택배가 아닌 국내 픽업 최저가와 비교합니다. 구매 시
              판매처의 성인 인증과 수령 규정을 확인하세요.
            </span>
          </div>
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

      <section className="more-products">
        <div className="section-heading">
          <div>
            <p className="section-kicker">POPULAR CHECKS</p>
            <h2>많이 비교하는 화장품</h2>
          </div>
          <span>실구매가 기준</span>
        </div>
        <div className="product-list">
          {cosmetics.map((item) => {
            const itemRetail = item.retailBasePrice + item.shipping;
            const itemDutyEquivalent =
              (item.dutyPrice / item.dutyVolume) * item.retailVolume;
            const itemSaving = itemRetail - itemDutyEquivalent;
            return (
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
                <span className="mini-bottle" aria-hidden="true">
                  {item.short}
                </span>
                <span>
                  <small>{item.brand}</small>
                  <strong>{item.name}</strong>
                  <b>면세 환산가 {formatWon(itemDutyEquivalent)}</b>
                </span>
                <em>{formatWon(itemSaving)} 절약</em>
              </button>
            );
          })}
        </div>
      </section>

      <section className="guide-preview" aria-labelledby="guide-preview-title">
        <div className="guide-preview-heading">
          <div>
            <p className="section-kicker">ORIGINAL PRICE GUIDES</p>
            <h2 id="guide-preview-title">가격표보다 먼저 볼 것들</h2>
          </div>
          <a href="/guides">모든 가이드 보기 →</a>
        </div>
        <div className="guide-preview-grid">
          {guideArticles.map((article) => (
            <a href={`/guides/${article.slug}`} key={article.slug}>
              <span>{article.category}</span>
              <small>{article.brand}</small>
              <strong>{article.title}</strong>
              <p>{article.verdict}</p>
              <b>읽어보기 →</b>
            </a>
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
            살까?는 판매처가 아니라 구매 판단을 돕는 가격 비교 서비스입니다.
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
              가격에는 확인 시각과 조건을 함께 표시합니다. 현재 화면의 가격은
              서비스 검증용 예시이며 실제 구매 전 재확인이 필요합니다.
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
            살까<span>?</span>
          </div>
          <small>면세·리테일 실구매가 비교 서비스</small>
        </div>
        <div className="footer-copy">
          <nav aria-label="사이트 정책">
            <a href="/about">서비스 소개</a>
            <a href="/guides">가격 가이드</a>
            <a href="/privacy">개인정보처리방침</a>
            <a href="/terms">이용약관</a>
            <a href="/advertising">광고·제휴 원칙</a>
          </nav>
          <p>
            이 페이지는 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의
            수수료를 제공받을 수 있습니다.
          </p>
          <p>
            표시 가격은 프로토타입용 예시입니다. 실제 결제 전 판매처의 가격과
            조건을 다시 확인하세요.
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
