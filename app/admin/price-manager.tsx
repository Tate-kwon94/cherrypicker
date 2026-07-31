"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { AdminOffer } from "../lib/price-store";
import type { OfferStatus } from "../lib/offer-input";

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
const formLoadedAt = Date.now();

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const initialObservedAt = useMemo(
    () => datetimeLocalValue(formLoadedAt),
    [],
  );
  const initialExpiresAt = useMemo(
    () => datetimeLocalValue(formLoadedAt + 7 * 24 * 60 * 60 * 1000),
    [],
  );

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

  return (
    <div className="admin-workspace">
      <section className="admin-form-card">
        <div className="admin-section-heading">
          <div>
            <span>STEP 1</span>
            <h2>확인한 가격 등록</h2>
          </div>
          <p>등록 후 바로 공개되지 않고 검수 대기 상태로 저장됩니다.</p>
        </div>

        <form className="admin-price-form" onSubmit={createOffer}>
          <label>
            브랜드
            <input name="brand" required maxLength={80} placeholder="예: 에스티 로더" />
          </label>
          <label className="field-wide">
            상품명
            <input
              name="productName"
              required
              maxLength={160}
              placeholder="예: 어드밴스드 나이트 리페어"
            />
          </label>
          <label>
            상품 ID <small>선택</small>
            <input name="productId" maxLength={100} placeholder="비우면 자동 생성" />
          </label>
          <label>
            카테고리
            <select name="category" defaultValue="cosmetics">
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
            <input name="sourceName" required maxLength={100} placeholder="예: 공식몰" />
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
              placeholder="예: 데일리샷 강남 픽업점 · 이마트 용산점"
            />
          </label>
          <label>
            주류 도수(%) <small>주류만 필수</small>
            <input name="abv" type="number" min="0.1" max="100" step="0.1" />
          </label>
          <label>
            바코드·상품코드 <small>권장</small>
            <input name="barcode" maxLength={40} inputMode="numeric" />
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
              />
              <select name="unit" defaultValue="ml" aria-label="비교 단위">
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
              defaultValue={initialObservedAt}
            />
          </label>
          <label>
            가격 만료 시각
            <input
              name="expiresAt"
              required
              type="datetime-local"
              defaultValue={initialExpiresAt}
            />
          </label>
          <label className="field-full">
            검수 메모 <small>선택</small>
            <textarea
              name="notes"
              maxLength={500}
              rows={3}
              placeholder="쿠폰 조건, 세트 구성, 수령 조건 등을 기록하세요."
            />
          </label>
          <button className="admin-submit" type="submit" disabled={saving}>
            {saving ? "처리 중…" : "검수 대기로 등록"}
          </button>
        </form>
      </section>

      <section className="admin-review-card">
        <div className="admin-section-heading">
          <div>
            <span>STEP 2</span>
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
                    {offer.channel === "duty" ? "온라인 면세" : "국내 리테일"}
                  </small>
                </div>
                <h3>
                  <small>{offer.brand}</small>
                  {offer.productName}
                </h3>
                <div className="admin-offer-price">
                  <strong>{won.format(offer.finalPrice)}원</strong>
                  <span>
                    {won.format(Math.round(offer.unitPrice))}원/{offer.unit}
                  </span>
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
