"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { AdminOffer } from "../lib/price-store";
import type { OfferStatus } from "../lib/offer-input";
import {
  pilotProducts,
  pilotRequiredSourcesPerChannel,
} from "../lib/pilot-catalog";
import {
  conveniencePickupRetailers,
  dutyFreeRetailers,
  fulfillmentLabelForRetailer,
  normalizeRetailerName,
  priceRetailers,
} from "../lib/retailers";

type ApiPayload = {
  offers?: AdminOffer[];
  offer?: AdminOffer;
  error?: string;
};

const won = new Intl.NumberFormat("ko-KR");
const dateTime = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * 저장된 통화로 표시한다.
 *
 * 검수 화면에서 통화를 무시하면, 운영자가 승인 여부를 판단하는 바로 그
 * 숫자가 실제와 다른 단위로 보인다. 지금 등록 경로는 KRW 만 받지만 —
 * 통화 컬럼과 계약 검사는 다른 경로로 들어온 행을 위해 존재하므로,
 * 표시도 값을 따른다.
 */
function formatAdminMoney(value: number, currency: AdminOffer["currency"]) {
  const rounded = won.format(Math.round(value));
  return currency === "USD" ? `$${rounded}` : `${rounded}원`;
}

function formatOfferUnitPrice(offer: AdminOffer): string {
  if (offer.category === "liquor" && offer.unit === "ml") {
    return `${formatAdminMoney(offer.unitPrice * 100, offer.currency)}/100ml`;
  }
  return `${formatAdminMoney(offer.unitPrice, offer.currency)}/${offer.unit}`;
}

/** 비제어 폼의 칸 하나를 갱신한다. */
function setFieldValue(form: HTMLFormElement, name: string, value: string) {
  const field = form.elements.namedItem(name);
  if (
    field instanceof HTMLInputElement ||
    field instanceof HTMLSelectElement ||
    field instanceof HTMLTextAreaElement
  ) {
    field.value = value;
  }
}

function datetimeLocalValue(timestamp: number): string {
  const local = new Date(
    timestamp - new Date(timestamp).getTimezoneOffset() * 60_000,
  );
  return local.toISOString().slice(0, 16);
}

async function requestOffers(): Promise<AdminOffer[]> {
  const response = await fetch("/api/admin/offers", { cache: "no-store" });
  const payload = (await response.json()) as ApiPayload;
  if (!response.ok) {
    throw new Error(payload.error ?? "가격을 불러오지 못했습니다.");
  }
  return payload.offers ?? [];
}

export function AdminPriceManager() {
  const [offers, setOffers] = useState<AdminOffer[]>([]);
  const [selectedPilotId, setSelectedPilotId] = useState(pilotProducts[0].id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [importText, setImportText] = useState("");
  const [importResults, setImportResults] = useState<
    Array<{ ok: boolean; productId: string; error?: string }>
  >([]);
  const formRef = useRef<HTMLFormElement>(null);

  // 확인 시각 기본값은 모듈이 평가된 시점이 아니라 폼을 여는 시점이어야
  // 한다. Worker 는 isolate 당 한 번만 모듈을 평가하므로, 모듈 스코프에서
  // 굳히면 며칠 전 시각이 기본값으로 남고 SSR·수화 결과도 어긋난다.
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const now = Date.now();
    setFieldValue(form, "observedAt", datetimeLocalValue(now));
    setFieldValue(form, "expiresAt", datetimeLocalValue(now + 24 * 60 * 60 * 1000));
  }, []);

  /**
   * 파일럿 상품을 바꾸면 그 상품에서 오는 칸만 갱신한다.
   *
   * 예전에는 `<form key={selectedPilotId}>` 로 폼 전체를 remount 해서,
   * 이미 입력한 가격·출처·시각이 사라지고 포커스도 select 로 끌려갔다.
   */
  function applyPilotProduct(pilotId: string) {
    setSelectedPilotId(pilotId);
    const form = formRef.current;
    const product = pilotProducts.find((item) => item.id === pilotId);
    if (!form || !product) return;

    setFieldValue(form, "brand", product.brand);
    setFieldValue(form, "productName", product.name);
    setFieldValue(form, "productId", product.id);
    setFieldValue(form, "category", product.category);
    setFieldValue(form, "volume", String(product.defaultVolume));
    setFieldValue(form, "unit", product.unit);
  }

  const loadOffers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setOffers(await requestOffers());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "가격을 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void requestOffers()
      .then((result) => {
        if (!cancelled) setOffers(result);
      })
      .catch((loadError: unknown) => {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "가격을 불러오지 못했습니다.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function createOffer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    const form = event.currentTarget;
    const data = new FormData(form);
    const payload = {
      action: "create",
      productId: data.get("productId"),
      brand: data.get("brand"),
      productName: data.get("productName"),
      category: data.get("category"),
      sourceName: data.get("sourceName"),
      sourceUrl: data.get("sourceUrl"),
      channel: data.get("channel"),
      listPrice: Number(data.get("listPrice")),
      shipping: Number(data.get("shipping")),
      instantDiscount: Number(data.get("instantDiscount")),
      currency: data.get("currency"),
      volume: Number(data.get("volume")),
      unit: data.get("unit"),
      observedAt: new Date(String(data.get("observedAt"))).getTime(),
      expiresAt: new Date(String(data.get("expiresAt"))).getTime(),
      evidenceType: data.get("evidenceType"),
      storeLocation: data.get("storeLocation"),
      abv: data.get("abv"),
      barcode: data.get("barcode"),
      notes: data.get("notes"),
    };

    try {
      const response = await fetch("/api/admin/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as ApiPayload;
      if (!response.ok) throw new Error(result.error ?? "가격을 등록하지 못했습니다.");
      setMessage("검수 대기 가격으로 등록했습니다.");
      form.reset();
      await loadOffers();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "가격을 등록하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function importDrafts() {
    setError("");
    setMessage("");
    setImportResults([]);

    // 붙여넣은 입력의 해석은 서버 호출과 분리해서 실패시킨다 — 서버가
    // JSON 아닌 응답(플래그 꺼짐의 평문 404 등)을 돌려줄 때 사용자의
    // 멀쩡한 입력을 탓하지 않기 위해서다.
    let drafts: unknown[];
    try {
      // 스크립트 출력 파일 전체({ drafts: [...] })든 drafts 배열만이든 받는다.
      const parsed = JSON.parse(importText) as unknown;
      const found = Array.isArray(parsed)
        ? parsed
        : (parsed as { drafts?: unknown[] })?.drafts;
      if (!Array.isArray(found) || found.length === 0) {
        throw new Error("drafts 배열을 찾지 못했습니다.");
      }
      drafts = found;
    } catch (parseError) {
      setError(
        parseError instanceof SyntaxError
          ? "JSON 을 해석하지 못했습니다. 스크립트 출력 파일 내용을 그대로 붙여넣으세요."
          : parseError instanceof Error
            ? parseError.message
            : "입력을 해석하지 못했습니다.",
      );
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/admin/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "import", drafts }),
      });
      const result = (await response.json().catch(() => ({}))) as ApiPayload & {
        results?: Array<{ ok: boolean; productId: string; error?: string }>;
        created?: number;
        failed?: number;
      };
      // 중단 응답에도 부분 결과가 실려 온다. 이미 등록된 건을 보여 줘야
      // 재시도할 때 무엇을 빼야 하는지 알 수 있다.
      if (result.results) setImportResults(result.results);
      if (!response.ok) throw new Error(result.error ?? "일괄 등록에 실패했습니다.");
      setMessage(
        `일괄 등록: ${result.created ?? 0}건 검수 대기로 등록, ${result.failed ?? 0}건 제외.`,
      );
      if ((result.created ?? 0) > 0) setImportText("");
      await loadOffers();
    } catch (importError) {
      setError(
        importError instanceof Error
          ? importError.message
          : "일괄 등록에 실패했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function updateStatus(id: string, status: OfferStatus) {
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await fetch("/api/admin/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", id, status }),
      });
      const result = (await response.json()) as ApiPayload;
      if (!response.ok) throw new Error(result.error ?? "상태를 변경하지 못했습니다.");
      setOffers((current) =>
        current.map((offer) => (offer.id === id && result.offer ? result.offer : offer)),
      );
      setMessage(
        status === "approved"
          ? "가격을 승인해 소비자 화면에 공개했습니다."
          : status === "rejected"
            ? "가격을 반려했습니다."
            : "가격을 검수 대기로 돌렸습니다.",
      );
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : "상태를 변경하지 못했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  const metrics = useMemo(
    () => ({
      draft: offers.filter((offer) => offer.status === "draft").length,
      active: offers.filter(
        (offer) => offer.status === "approved" && !offer.expired,
      ).length,
      expired: offers.filter((offer) => offer.expired).length,
    }),
    [offers],
  );
  const selectedPilotProduct =
    pilotProducts.find((item) => item.id === selectedPilotId) ?? null;
  const pilotCoverage = useMemo(
    () =>
      pilotProducts.map((product) => {
        const activeOffers = offers.filter(
          (offer) =>
            offer.productId === product.id &&
            offer.status === "approved" &&
            !offer.expired,
        );
        const dutySources = new Set(
          activeOffers
            .filter((offer) => offer.channel === "duty")
            .map((offer) => normalizeRetailerName(offer.sourceName)),
        );
        const retailSources = new Set(
          activeOffers
            .filter((offer) => offer.channel === "retail")
            .map((offer) => normalizeRetailerName(offer.sourceName)),
        );
        return {
          product,
          dutySourceCount: dutySources.size,
          retailSourceCount: retailSources.size,
          hasDuty: dutySources.size >= pilotRequiredSourcesPerChannel,
          hasRetail: retailSources.size >= pilotRequiredSourcesPerChannel,
        };
      }),
    [offers],
  );
  const pilotReadyProducts = pilotCoverage.filter(
    (item) => item.hasDuty && item.hasRetail,
  ).length;
  const pilotRequiredPriceCount =
    pilotProducts.length * pilotRequiredSourcesPerChannel * 2;
  const pilotPricesCovered = pilotCoverage.reduce(
    (count, item) =>
      count +
      Math.min(item.dutySourceCount, pilotRequiredSourcesPerChannel) +
      Math.min(item.retailSourceCount, pilotRequiredSourcesPerChannel),
    0,
  );

  return (
    <div className="admin-workspace">
      <section className="admin-pilot-card">
        <div className="admin-section-heading">
          <div>
            <span>PILOT 15</span>
            <h2>초기 가격 커버리지</h2>
          </div>
          <p>
            롯데·신라·신세계·현대를 조회하고, 상품마다 서로 다른 면세 2곳과
            국내 2곳의 가격을 확보합니다.
          </p>
        </div>
        <div className="admin-pilot-summary">
          <div>
            <strong>{pilotReadyProducts}/15</strong>
            <span>면세 2곳·국내 2곳 확보</span>
          </div>
          <div>
            <strong>{pilotPricesCovered}/{pilotRequiredPriceCount}</strong>
            <span>최소 유효 가격</span>
          </div>
          <div className="admin-pilot-progress" aria-label="파일럿 수집 진행률">
            <i
              style={{
                width: `${Math.round((pilotPricesCovered / pilotRequiredPriceCount) * 100)}%`,
              }}
            />
          </div>
        </div>
        <div className="admin-pilot-grid">
          {pilotCoverage.map(
            ({
              product,
              dutySourceCount,
              retailSourceCount,
              hasDuty,
              hasRetail,
            }) => (
              <article key={product.id}>
                <div>
                  <small>
                    {product.category === "cosmetics" ? "화장품" : "주류"} ·{" "}
                    {product.segment}
                  </small>
                  <strong>
                    {product.brand} {product.name}
                  </strong>
                </div>
                <p>
                  <span className={hasDuty ? "covered" : ""}>
                    {hasDuty ? "✓" : "○"} 면세 {dutySourceCount}/
                    {pilotRequiredSourcesPerChannel}
                  </span>
                  <span className={hasRetail ? "covered" : ""}>
                    {hasRetail ? "✓" : "○"} 국내 {retailSourceCount}/
                    {pilotRequiredSourcesPerChannel}
                  </span>
                </p>
              </article>
            ),
          )}
        </div>
      </section>

      <section className="admin-form-card">
        <div className="admin-section-heading">
          <div>
            <span>STEP 2</span>
            <h2>확인한 가격 등록</h2>
          </div>
          <p>등록 후 바로 공개되지 않고 검수 대기 상태로 저장됩니다.</p>
        </div>

        <form
          ref={formRef}
          className="admin-price-form"
          onSubmit={createOffer}
        >
          <label className="field-full">
            파일럿 상품 불러오기
            <select
              value={selectedPilotId}
              onChange={(event) => applyPilotProduct(event.target.value)}
            >
              <option value="">직접 입력</option>
              {pilotProducts.map((item) => (
                <option key={item.id} value={item.id}>
                  [{item.category === "cosmetics" ? "화장품" : "주류"}]{" "}
                  {item.brand} {item.name}
                </option>
              ))}
            </select>
          </label>
          {selectedPilotProduct && (
            <p className="field-full admin-template-note">
              권장 출처: {selectedPilotProduct.sourceTargets.join(" · ")} ·{" "}
              {selectedPilotProduct.comparisonMode === "same_product"
                ? "같은 상품 가격 비교"
                : "단위 가성비 비교"}
            </p>
          )}
          <p className="field-full admin-template-note">
            면세 조회 대상:{" "}
            {dutyFreeRetailers.map((retailer) => retailer.name).join(" · ")}
          </p>
          <p className="field-full admin-template-note">
            편의점 픽업 대상:{" "}
            {conveniencePickupRetailers
              .map((retailer) => retailer.name)
              .join(" · ")}
            {" · "}가격마다 수령 지점과 재고 확인 시각 기록
          </p>
          <label>
            브랜드
            <input
              name="brand"
              required
              maxLength={80}
              placeholder="예: 에스티 로더"
              defaultValue={selectedPilotProduct?.brand}
            />
          </label>
          <label className="field-wide">
            상품명
            <input
              name="productName"
              required
              maxLength={160}
              placeholder="예: 어드밴스드 나이트 리페어"
              defaultValue={selectedPilotProduct?.name}
            />
          </label>
          <label>
            상품 ID <small>선택</small>
            <input
              name="productId"
              maxLength={100}
              placeholder="비우면 자동 생성"
              defaultValue={selectedPilotProduct?.id}
            />
          </label>
          <label>
            카테고리
            <select
              name="category"
              defaultValue={selectedPilotProduct?.category ?? "cosmetics"}
            >
              <option value="cosmetics">화장품</option>
              <option value="liquor">주류</option>
            </select>
          </label>
          <label>
            판매 채널
            <select name="channel" defaultValue="retail">
              <option value="retail">국내 리테일</option>
              <option value="duty">온라인 면세</option>
            </select>
          </label>
          <label>
            판매처
            <input
              name="sourceName"
              required
              maxLength={100}
              list="price-retailer-options"
              placeholder="예: 롯데면세점"
            />
            <datalist id="price-retailer-options">
              {priceRetailers.map((retailer) => (
                <option
                  key={retailer.id}
                  value={retailer.name}
                  label={fulfillmentLabelForRetailer(
                    retailer.name,
                    retailer.channel,
                  )}
                />
              ))}
            </datalist>
          </label>
          <label>
            가격 증거
            <select name="evidenceType" defaultValue="official_listing">
              <option value="official_listing">공식 상품 페이지</option>
              <option value="licensed_pickup">성인 인증 픽업 페이지</option>
              <option value="receipt">구매 영수증</option>
              <option value="store_photo">매장 가격표 사진</option>
            </select>
          </label>
          <label className="field-wide">
            원본 상품 URL
            <input
              name="sourceUrl"
              required
              type="url"
              inputMode="url"
              placeholder="https://..."
            />
          </label>
          <label className="field-wide">
            매장·픽업 지점 <small>주류 픽업·영수증은 필수</small>
            <input
              name="storeLocation"
              maxLength={160}
              placeholder="예: 이마트24 보틀오더 · 수령점 선택 필요"
            />
          </label>
          <label>
            주류 도수(%) <small>선택 · 비교 참고값</small>
            <input name="abv" type="number" min="0.1" max="100" step="0.1" />
          </label>
          <label>
            바코드·상품코드 <small>권장</small>
            <input name="barcode" maxLength={40} inputMode="numeric" />
          </label>
          <label>
            통화
            <select name="currency" defaultValue="KRW">
              <option value="KRW">KRW · 원</option>
              {/*
                고를 수 있게 두면 안 된다 — 등록 검증이 USD 를 언제나
                거부하므로, 선택 가능한 옵션은 제출 후에야 실패하는 막다른
                길이 된다.
              */}
              <option value="USD" disabled>
                USD · 달러 (아직 등록 불가)
              </option>
            </select>
            <small>
              지금은 원화 가격만 등록할 수 있습니다. 금액을 최소 단위로 저장하기
              전에는 $89.50 같은 값을 담을 수 없어, 절사해 넣으면 더 찾기 어려운
              오류가 됩니다. 판매처가 달러로 표시하면 등록하지 말고 남겨 주세요.
            </small>
          </label>
          <label>
            상품가
            <input name="listPrice" required type="number" min="1" step="1" />
          </label>
          <label>
            배송비
            <input name="shipping" required type="number" min="0" step="1" defaultValue="0" />
          </label>
          <label>
            즉시할인
            <input
              name="instantDiscount"
              required
              type="number"
              min="0"
              step="1"
              defaultValue="0"
            />
          </label>
          <label>
            용량·수량
            <span className="field-combo">
              <input
                name="volume"
                required
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={selectedPilotProduct?.defaultVolume}
              />
              <select
                name="unit"
                defaultValue={selectedPilotProduct?.unit ?? "ml"}
                aria-label="비교 단위"
              >
                <option value="ml">ml</option>
                <option value="g">g</option>
                <option value="개">개</option>
              </select>
            </span>
          </label>
          <label>
            가격 확인 시각
            <input
              name="observedAt"
              required
              type="datetime-local"
            />
          </label>
          <label>
            가격 만료 시각
            <input
              name="expiresAt"
              required
              type="datetime-local"
            />
          </label>
          <label className="field-full">
            공개 조건·재고 메모 <small>선택</small>
            <textarea
              name="notes"
              maxLength={500}
              rows={3}
              placeholder="예: 재고 있음 · 앱 결제 후 선택한 점포에서 성인 확인 후 수령"
            />
          </label>
          <button className="admin-submit" type="submit" disabled={saving}>
            {saving ? "처리 중…" : "검수 대기로 등록"}
          </button>
        </form>

        <details className="admin-import">
          <summary>일괄 등록(JSON) — sync-coupang-products 출력 붙여넣기</summary>
          <p>
            등록안은 전부 <strong>검수 대기</strong>로 들어갑니다. 승인은 아래
            검수 단계에서 한 건씩 합니다.
          </p>
          <textarea
            rows={6}
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder='{"drafts": [...]} 또는 drafts 배열'
            aria-label="일괄 등록 JSON"
          />
          <button
            type="button"
            className="admin-submit"
            onClick={() => void importDrafts()}
            disabled={saving || importText.trim() === ""}
          >
            {saving ? "처리 중…" : "일괄 등록"}
          </button>
          {importResults.length > 0 && (
            <ul className="admin-import-results">
              {importResults.map((item, index) => (
                <li key={`${item.productId}-${index}`}>
                  {item.ok
                    ? `✓ ${item.productId} 등록됨`
                    : `✗ ${item.productId}: ${item.error}`}
                </li>
              ))}
            </ul>
          )}
        </details>
      </section>

      <section className="admin-review-card">
        <div className="admin-section-heading">
          <div>
            <span>STEP 3</span>
            <h2>가격 검수</h2>
          </div>
          <button type="button" onClick={() => void loadOffers()} disabled={loading}>
            새로고침
          </button>
        </div>

        <div className="admin-metrics" aria-label="가격 검수 현황">
          <span>
            <small>검수 대기</small>
            <strong>{metrics.draft}</strong>
          </span>
          <span>
            <small>공개 중</small>
            <strong>{metrics.active}</strong>
          </span>
          <span>
            <small>만료</small>
            <strong>{metrics.expired}</strong>
          </span>
        </div>

        {(message || error) && (
          <p className={error ? "admin-alert error" : "admin-alert"} role="status">
            {error || message}
          </p>
        )}

        {loading ? (
          <p className="admin-empty">가격 목록을 불러오는 중입니다.</p>
        ) : offers.length === 0 ? (
          <p className="admin-empty">
            등록된 가격이 없습니다. 첫 가격을 등록해 검수 흐름을 시작하세요.
          </p>
        ) : (
          <div className="admin-offer-list">
            {offers.map((offer) => (
              <article key={offer.id}>
                <div className="admin-offer-topline">
                  <span className={`status-${offer.expired ? "expired" : offer.status}`}>
                    {offer.expired
                      ? "만료"
                      : offer.status === "draft"
                        ? "검수 대기"
                        : offer.status === "approved"
                          ? "공개"
                          : "반려"}
                  </span>
                  <small>
                    {fulfillmentLabelForRetailer(
                      offer.sourceName,
                      offer.channel,
                      offer.evidenceType === "licensed_pickup",
                    )}
                  </small>
                </div>
                <h3>
                  <small>{offer.brand}</small>
                  {offer.productName}
                </h3>
                <div className="admin-offer-price">
                  <strong>
                    {formatAdminMoney(offer.finalPrice, offer.currency)}
                  </strong>
                  <span>{formatOfferUnitPrice(offer)}</span>
                </div>
                <dl>
                  <div>
                    <dt>판매처</dt>
                    <dd>
                      <a href={offer.sourceUrl} target="_blank" rel="noreferrer">
                        {offer.sourceName} ↗
                      </a>
                    </dd>
                  </div>
                  <div>
                    <dt>검증</dt>
                    <dd>
                      {offer.evidenceType === "official_listing"
                        ? "공식 페이지"
                        : offer.evidenceType === "licensed_pickup"
                          ? "성인 인증 픽업"
                          : offer.evidenceType === "receipt"
                            ? "영수증"
                            : "매장 가격표"}
                    </dd>
                  </div>
                  {offer.storeLocation && (
                    <div>
                      <dt>지점</dt>
                      <dd>{offer.storeLocation}</dd>
                    </div>
                  )}
                  <div>
                    <dt>구성</dt>
                    <dd>
                      {offer.volume}
                      {offer.unit}
                      {offer.abv !== null && ` · 도수 ${offer.abv}%`}
                    </dd>
                  </div>
                  <div>
                    <dt>확인</dt>
                    <dd>{dateTime.format(offer.observedAt)}</dd>
                  </div>
                  <div>
                    <dt>만료</dt>
                    <dd>{dateTime.format(offer.expiresAt)}</dd>
                  </div>
                </dl>
                {offer.notes && <p>{offer.notes}</p>}
                <div className="admin-review-actions">
                  {!offer.expired && offer.status !== "approved" && (
                    <button
                      type="button"
                      onClick={() => void updateStatus(offer.id, "approved")}
                      disabled={saving}
                    >
                      승인·공개
                    </button>
                  )}
                  {offer.status !== "rejected" && (
                    <button
                      type="button"
                      onClick={() => void updateStatus(offer.id, "rejected")}
                      disabled={saving}
                    >
                      반려
                    </button>
                  )}
                  {offer.status !== "draft" && !offer.expired && (
                    <button
                      type="button"
                      onClick={() => void updateStatus(offer.id, "draft")}
                      disabled={saving}
                    >
                      대기로 전환
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
