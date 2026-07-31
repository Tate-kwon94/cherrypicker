import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    brand: text("brand").notNull(),
    name: text("name").notNull(),
    category: text("category", { enum: ["cosmetics", "liquor"] }).notNull(),
    unit: text("unit", { enum: ["ml", "g", "개"] }).notNull(),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("products_active_category_idx").on(table.active, table.category),
  ],
);

export const priceOffers = sqliteTable(
  "price_offers",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url").notNull(),
    channel: text("channel", { enum: ["duty", "retail"] }).notNull(),
    listPrice: integer("list_price").notNull(),
    shipping: integer("shipping").notNull().default(0),
    instantDiscount: integer("instant_discount").notNull().default(0),
    finalPrice: integer("final_price").notNull(),
    volume: real("volume").notNull(),
    unit: text("unit", { enum: ["ml", "g", "개"] }).notNull(),
    status: text("status", {
      enum: ["draft", "approved", "rejected"],
    })
      .notNull()
      .default("draft"),
    observedAt: integer("observed_at").notNull(),
    expiresAt: integer("expires_at").notNull(),
    evidenceType: text("evidence_type", {
      enum: [
        "official_listing",
        "licensed_pickup",
        "receipt",
        "store_photo",
      ],
    })
      .notNull()
      .default("official_listing"),
    storeLocation: text("store_location").notNull().default(""),
    abv: real("abv"),
    barcode: text("barcode").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdBy: text("created_by").notNull(),
    approvedBy: text("approved_by"),
    approvedAt: integer("approved_at"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (table) => [
    index("price_offers_public_idx").on(
      table.status,
      table.expiresAt,
      table.productId,
    ),
    index("price_offers_product_idx").on(table.productId, table.observedAt),
  ],
);
