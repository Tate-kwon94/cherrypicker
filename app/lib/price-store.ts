import { FEED_QUERY_RETENTION_MS, freshUntil } from "./freshness.ts";
import {
  calculateUnitPrice,
  type Channel,
  type Currency,
  type Unit,
} from "./pricing.ts";
import {
  describeProductConflicts,
  findProductConflicts,
  OfferValidationError,
  type OfferCategory,
  type OfferDraft,
  type OfferEvidenceType,
  type OfferStatus,
} from "./offer-input.ts";

export type PublishedOffer = {
  id: string;
  productId: string;
  brand: string;
  productName: string;
  category: OfferCategory;
  sourceName: string;
  sourceUrl: string;
  channel: Channel;
  listPrice: number;
  shipping: number;
  instantDiscount: number;
  finalPrice: number;
  currency: Currency;
  volume: number;
  unit: Unit;
  unitPrice: number;
  observedAt: number;
  expiresAt: number;
  evidenceType: OfferEvidenceType;
  storeLocation: string;
  abv: number | null;
  barcode: string;
  notes: string;
  reference: boolean;
};

export type AdminOffer = PublishedOffer & {
  status: OfferStatus;
  createdBy: string;
  approvedBy: string | null;
  approvedAt: number | null;
  createdAt: number;
  updatedAt: number;
  expired: boolean;
};

type OfferRow = {
  id: string;
  product_id: string;
  brand: string;
  product_name: string;
  category: OfferCategory;
  source_name: string;
  source_url: string;
  channel: Channel;
  list_price: number;
  shipping: number;
  instant_discount: number;
  final_price: number;
  currency: Currency;
  volume: number;
  unit: Unit;
  status: OfferStatus;
  observed_at: number;
  expires_at: number;
  evidence_type: OfferEvidenceType;
  store_location: string;
  abv: number | null;
  barcode: string;
  notes: string;
  created_by: string;
  approved_by: string | null;
  approved_at: number | null;
  created_at: number;
  updated_at: number;
};

async function getPriceDb(): Promise<D1Database> {
  const { env } = await import("cloudflare:workers");
  if (!env.DB) {
    throw new Error("가격 데이터베이스가 아직 연결되지 않았습니다.");
  }
  return env.DB;
}

const offerSelect = `
  SELECT
    o.id,
    o.product_id,
    p.brand,
    p.name AS product_name,
    p.category,
    o.source_name,
    o.source_url,
    o.channel,
    o.list_price,
    o.shipping,
    o.instant_discount,
    o.final_price,
    o.currency,
    o.volume,
    o.unit,
    o.status,
    o.observed_at,
    o.expires_at,
    o.evidence_type,
    o.store_location,
    o.abv,
    o.barcode,
    o.notes,
    o.created_by,
    o.approved_by,
    o.approved_at,
    o.created_at,
    o.updated_at
  FROM price_offers o
  INNER JOIN products p ON p.id = o.product_id
`;

export async function listPublishedOffers(
  now = Date.now(),
): Promise<PublishedOffer[]> {
  const referenceCutoff = now - FEED_QUERY_RETENTION_MS;
  const result = await (await getPriceDb())
    .prepare(
      `${offerSelect}
       WHERE p.active = 1
         AND o.status = 'approved'
         AND o.observed_at > ?
       ORDER BY o.observed_at DESC, o.final_price ASC
       LIMIT 100`,
    )
    .bind(referenceCutoff)
    .all<OfferRow>();

  return mapPublishedOffers(result.results ?? [], now).offers;
}

export async function listAdminOffers(
  now = Date.now(),
): Promise<AdminOffer[]> {
  const result = await (await getPriceDb())
    .prepare(
      `${offerSelect}
       ORDER BY
         CASE o.status
           WHEN 'draft' THEN 0
           WHEN 'approved' THEN 1
           ELSE 2
         END,
         o.updated_at DESC
       LIMIT 200`,
    )
    .all<OfferRow>();

  // 운영 화면은 변환할 수 없는 행도 보여야 한다. 공개 피드에서 제외되는
  // 행을 운영자도 못 보면 고칠 방법이 없다.
  return (result.results ?? []).map((row) => ({
    ...toLenientPublishedOffer(row, now),
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expired: effectiveFreshUntil(row) <= now,
  }));
}

export async function createDraftOffer(
  draft: OfferDraft,
  createdBy: string,
): Promise<AdminOffer> {
  const db = await getPriceDb();
  const now = Date.now();
  const offerId = `offer-${crypto.randomUUID()}`;

  // 가격 관측 등록이 상품 행을 바꾸지 않게 한다. 예전에는 여기서 무조건
  // UPDATE 를 걸어, 승인되지도 않은 draft 하나가 이미 승인된 모든 가격의
  // 브랜드 표시와 신선도 기준을 소급해 바꿨고 비활성 상품까지 되살렸다.
  const existing = await db
    .prepare(
      `SELECT brand, name, category, unit FROM products WHERE id = ? LIMIT 1`,
    )
    .bind(draft.productId)
    .first<{
      brand: string;
      name: string;
      category: OfferCategory;
      unit: Unit;
    }>();

  if (existing) {
    const conflicts = findProductConflicts(existing, {
      brand: draft.brand,
      name: draft.productName,
      category: draft.category,
      unit: draft.unit,
    });
    if (conflicts.length > 0) {
      throw new OfferValidationError(
        describeProductConflicts(draft.productId, conflicts),
      );
    }
  }

  await db.batch([
    db
      .prepare(
        `INSERT INTO products (
           id, brand, name, category, unit, active, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(id) DO NOTHING`,
      )
      .bind(
        draft.productId,
        draft.brand,
        draft.productName,
        draft.category,
        draft.unit,
        now,
        now,
      ),
    db
      .prepare(
        `INSERT INTO price_offers (
           id, product_id, source_name, source_url, channel,
           list_price, shipping, instant_discount, final_price, currency,
           volume, unit, status, observed_at, expires_at, notes,
           evidence_type, store_location, abv, barcode,
           created_by, approved_by, approved_at, created_at, updated_at
         ) VALUES (
           ?, ?, ?, ?, ?,
           ?, ?, ?, ?, ?,
           ?, ?, 'draft', ?, ?, ?,
           ?, ?, ?, ?,
           ?, NULL, NULL, ?, ?
         )`,
      )
      .bind(
        offerId,
        draft.productId,
        draft.sourceName,
        draft.sourceUrl,
        draft.channel,
        draft.listPrice,
        draft.shipping,
        draft.instantDiscount,
        draft.finalPrice,
        draft.currency,
        draft.volume,
        draft.unit,
        draft.observedAt,
        draft.expiresAt,
        draft.notes,
        draft.evidenceType,
        draft.storeLocation,
        draft.abv,
        draft.barcode,
        createdBy,
        now,
        now,
      ),
  ]);

  const offer = await getAdminOffer(offerId);
  if (!offer) throw new Error("등록한 가격을 다시 불러오지 못했습니다.");
  return offer;
}

export async function changeOfferStatus(
  id: string,
  status: OfferStatus,
  adminEmail: string,
): Promise<AdminOffer> {
  const now = Date.now();
  const approved = status === "approved";
  // 승인 취소·반려는 검수 이력을 지우지 않는다. 예전에는 approved_by 와
  // approved_at 을 NULL 로 덮어써, 누가 언제 승인했는지가 영구히 사라졌다.
  const result = await (await getPriceDb())
    .prepare(
      approved
        ? `UPDATE price_offers
             SET status = ?,
                 approved_by = ?,
                 approved_at = ?,
                 updated_at = ?
           WHERE id = ?`
        : `UPDATE price_offers
             SET status = ?,
                 updated_at = ?
           WHERE id = ?`,
    )
    .bind(...(approved ? [status, adminEmail, now, now, id] : [status, now, id]))
    .run();

  if (!result.meta.changes) throw new Error("가격 정보를 찾지 못했습니다.");
  const offer = await getAdminOffer(id);
  if (!offer) throw new Error("수정한 가격을 다시 불러오지 못했습니다.");
  return offer;
}

async function getAdminOffer(id: string): Promise<AdminOffer | null> {
  const row = await (await getPriceDb())
    .prepare(`${offerSelect} WHERE o.id = ? LIMIT 1`)
    .bind(id)
    .first<OfferRow>();
  if (!row) return null;

  return {
    ...toPublishedOffer(row),
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expired: effectiveFreshUntil(row) <= Date.now(),
  };
}

function effectiveFreshUntil(row: OfferRow): number {
  return freshUntil({
    category: row.category,
    evidenceType: row.evidence_type,
    observedAt: row.observed_at,
    expiresAt: row.expires_at,
  });
}

/**
 * 공개 피드용 변환. 변환할 수 없는 행은 그 행만 제외한다.
 *
 * 예전에는 `map` 안에서 그대로 던져, 승인된 불량 행 **한 건**이 검수 피드
 * 전체를 503 으로 만들고 사이트를 "준비 중" 으로 떨어뜨렸다. 한 행의
 * 문제는 그 행만 빠지는 것으로 끝나야 한다. 제외 건수는 로그에 남긴다 —
 * 조용히 사라지면 원인을 찾을 수 없다.
 */
export function mapPublishedOffers(
  rows: readonly OfferRow[],
  now: number,
): { offers: PublishedOffer[]; excluded: string[] } {
  const offers: PublishedOffer[] = [];
  const excluded: string[] = [];

  for (const row of rows) {
    try {
      offers.push(toPublishedOffer(row, now));
    } catch {
      excluded.push(row.id);
    }
  }

  if (excluded.length > 0) {
    console.warn(
      `[price-store] 변환할 수 없는 가격 행 ${excluded.length}건을 공개 피드에서 제외했습니다: ${excluded.join(", ")}`,
    );
  }

  return { offers, excluded };
}

/**
 * 운영 화면용 변환. 단위가격을 계산할 수 없어도 행을 살려 둔다.
 *
 * `unitPrice: 0` 은 공개 비교 계약(`checkComparablePair`)의 유효 금액
 * 검사에 걸려 추천 후보가 되지 못하므로, 보이되 쓰이지는 않는다.
 */
function toLenientPublishedOffer(row: OfferRow, now: number): PublishedOffer {
  try {
    return toPublishedOffer(row, now);
  } catch {
    return { ...toPublishedOffer({ ...row, final_price: 1, volume: 1 }, now),
      finalPrice: row.final_price,
      volume: row.volume,
      unitPrice: 0,
    };
  }
}

function toPublishedOffer(
  row: OfferRow,
  now = Date.now(),
): PublishedOffer {
  return {
    id: row.id,
    productId: row.product_id,
    brand: row.brand,
    productName: row.product_name,
    category: row.category,
    sourceName: row.source_name,
    sourceUrl: row.source_url,
    channel: row.channel,
    listPrice: row.list_price,
    shipping: row.shipping,
    instantDiscount: row.instant_discount,
    finalPrice: row.final_price,
    currency: row.currency,
    volume: row.volume,
    unit: row.unit,
    unitPrice: calculateUnitPrice(row.final_price, row.volume),
    observedAt: row.observed_at,
    expiresAt: row.expires_at,
    evidenceType: row.evidence_type,
    storeLocation: row.store_location,
    abv: row.abv,
    barcode: row.barcode,
    notes: row.notes,
    reference: effectiveFreshUntil(row) <= now,
  };
}
