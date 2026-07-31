ALTER TABLE `price_offers` ADD `evidence_type` text DEFAULT 'official_listing' NOT NULL;
--> statement-breakpoint
ALTER TABLE `price_offers` ADD `store_location` text DEFAULT '' NOT NULL;
--> statement-breakpoint
ALTER TABLE `price_offers` ADD `abv` real;
--> statement-breakpoint
ALTER TABLE `price_offers` ADD `barcode` text DEFAULT '' NOT NULL;
