import {
  calculateUnitPrice,
  type Channel,
  type Unit,
} from "./pricing";
import type { OfferCategory, OfferDraft, OfferStatus } from "./offer-input";

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
  volume: number;
  unit: Unit;
  unitPrice: number;
  observedAt: number;
  expiresAt: number;
};

export type AdminOffer = PublishedOffer & {
  status: OfferStatus;
  notes: string;
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
  volume: number;
  unit: Unit;
  status: OfferStatus;
  observed_at: number;
  expires_at: number;
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
    o.volume,
    o.unit,
    o.status,
    o.observed_at,
    o.expires_at,
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
  const result = await (await getPriceDb())
    .prepare(
      `${offerSelect}
       WHERE p.active = 1
         AND o.status = 'approved'
         AND o.expires_at > ?
       ORDER BY o.observed_at DESC, o.final_price ASC
       LIMIT 100`,
    )
    .bind(now)
    .all<OfferRow>();

  return (result.results ?? []).map(toPublishedOffer);
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

  return (result.results ?? []).map((row) => ({
    ...toPublishedOffer(row),
    status: row.status,
    notes: row.notes,
    createdBy: row.created_by,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expired: row.expires_at <= now,
  }));
}

export async function createDraftOffer(
  draft: OfferDraft,
  createdBy: string,
): Promise<AdminOffer> {
  const db = await getPriceDb();
  const now = Date.now();
  const offerId = `offer-${crypto.randomUUID()}`;

  await db.batch([
    db
      .prepare(
        `INSERT INTO products (
           id, brand, name, category, unit, active, created_at, updated_at
         ) VALUES (?, ?, ?, ?, ?, 1, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           brand = excluded.brand,
           name = excluded.name,
           category = excluded.category,
           unit = excluded.unit,
           active = 1,
           updated_at = excluded.updated_at`,
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
           list_price, shipping, instant_discount, final_price,
           volume, unit, status, observed_at, expires_at, notes,
           created_by, approved_by, approved_at, created_at, updated_at
         ) VALUES (
           ?, ?, ?, ?, ?,
           ?, ?, ?, ?,
           ?, ?, 'draft', ?, ?, ?,
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
        draft.volume,
        draft.unit,
        draft.observedAt,
        draft.expiresAt,
        draft.notes,
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
  const result = await (await getPriceDb())
    .prepare(
      `UPDATE price_offers
       SET status = ?,
           approved_by = ?,
           approved_at = ?,
           updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      status,
      approved ? adminEmail : null,
      approved ? now : null,
      now,
      id,
    )
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
    expired: row.expires_at <= Date.now(),
  };
}

function toPublishedOffer(row: OfferRow): PublishedOffer {
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
    volume: row.volume,
    unit: row.unit,
    unitPrice: calculateUnitPrice(row.final_price, row.volume),
    observedAt: row.observed_at,
    expiresAt: row.expires_at,
  };
}
