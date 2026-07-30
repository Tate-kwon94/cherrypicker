"use client";

import { FormEvent, useMemo, useState } from "react";

type Category = "cosmetics" | "liquor";
type PriceBasis = "total" | "unit";
type Taste = "beginner" | "sweet" | "smoky";

type Cosmetic = {
  id: string;
  brand: string;
  name: string;
  short: string;
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

const cosmetics: Cosmetic[] = [
  {
    id: "anr",
    brand: "에스티 로더",
    name: "어드밴스드 나이트 리페어",
    short: "ANR",
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

export default function Home() {
  const [category, setCategory] = useState<Category>("cosmetics");
  const [basis, setBasis] = useState<PriceBasis>("total");
  const [selectedId, setSelectedId] = useState("anr");
  const [taste, setTaste] = useState<Taste>("beginner");
  const [query, setQuery] = useState("");
  const [alertActive, setAlertActive] = useState(false);

  const product = useMemo(
    () => cosmetics.find((item) => item.id === selectedId) ?? cosmetics[0],
    [selectedId],
  );

  const retailPrice = product.retailBasePrice + product.shipping;
  const dutyUnit = product.dutyPrice / product.dutyVolume;
  const retailUnit = retailPrice / product.retailVolume;
  const dutyEquivalent = dutyUnit * product.retailVolume;
  const equivalentSavings = retailPrice - dutyEquivalent;
  const savingRate = Math.max(0, Math.round((equivalentSavings / retailPrice) * 100));
  const liquor = liquors[taste];
  const liquorSaving = liquor.retailPrice - liquor.dutyPrice;

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
          <button className="text-button" type="button">
            가격 알림
          </button>
          <button className="avatar-button" type="button" aria-label="내 설정">
            MY
          </button>
        </div>
      </header>

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

      <div className="context-strip" aria-label="적용 중인 구매 조건">
        <span>
          <b>출국</b> 8월 18일 · 인천 T1
        </span>
        <span>
          <b>회원</b> 쿠팡 와우 · 코스트코
        </span>
        <button type="button">조건 변경 ↗</button>
      </div>

      <nav className="category-tabs" aria-label="상품 카테고리">
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
                    <span>면세 {product.dutyVolume}ml</span>
                    <span>리테일 {product.retailVolume}ml</span>
                    <span>매칭 {product.match}%</span>
                  </div>
                </div>
              </div>

              <div className="recommendation">
                <span className="recommendation-label">오늘의 결론</span>
                <div>
                  <h3>출국 예정이라면 온라인 면세</h3>
                  <p>
                    더 큰 용량이지만 {product.retailVolume}ml 환산가도{" "}
                    <strong>{formatWon(equivalentSavings)}</strong> 낮아요.
                  </p>
                </div>
                <div className="saving">
                  <strong>{savingRate}%↓</strong>
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
                  <h3>온라인 면세 최저가</h3>
                  <p>
                    {product.dutyVolume}ml · {product.dutyCondition}
                  </p>
                </div>
                <div className="offer-values">
                  <div className={basis === "total" ? "focus" : ""}>
                    <span>총 결제가</span>
                    <strong>{formatWon(product.dutyPrice)}</strong>
                  </div>
                  <div className={basis === "unit" ? "focus" : ""}>
                    <span>단위 가격</span>
                    <strong>{formatWon(dutyUnit)}/ml</strong>
                  </div>
                </div>
              </article>

              <article className="offer-card">
                <div>
                  <span className="rank-badge neutral">총액 1위</span>
                  <h3>{product.retailSource}</h3>
                  <p>
                    {product.retailVolume}ml · {product.retailCondition}
                  </p>
                </div>
                <div className="offer-values">
                  <div className={basis === "total" ? "focus" : ""}>
                    <span>배송비 포함</span>
                    <strong>{formatWon(retailPrice)}</strong>
                  </div>
                  <div className={basis === "unit" ? "focus" : ""}>
                    <span>단위 가격</span>
                    <strong>{formatWon(retailUnit)}/ml</strong>
                  </div>
                </div>
              </article>
            </div>

            <div className="equivalent-card">
              <div>
                <span>동일 {product.retailVolume}ml로 환산</span>
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
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>온라인 면세</td>
                      <td>{product.dutyVolume}ml</td>
                      <td>{formatWon(product.dutyPrice + 15000)}</td>
                      <td>−15,000원</td>
                      <td>{formatWon(product.dutyPrice)}</td>
                      <td>{formatWon(dutyUnit)}/ml</td>
                    </tr>
                    <tr>
                      <td>{product.retailSource}</td>
                      <td>{product.retailVolume}ml</td>
                      <td>{formatWon(product.retailBasePrice)}</td>
                      <td>+{formatWon(product.shipping)}</td>
                      <td>{formatWon(retailPrice)}</td>
                      <td>{formatWon(retailUnit)}/ml</td>
                    </tr>
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
                <strong>가격 신뢰도 높음</strong>
                <p>마지막 확인 {product.freshness}</p>
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

      <footer>
        <div className="brand footer-brand">
          살까<span>?</span>
        </div>
        <p>
          표시 가격은 프로토타입용 예시입니다. 실제 결제 전 판매처의 가격과
          조건을 다시 확인하세요.
        </p>
      </footer>
    </main>
  );
}
