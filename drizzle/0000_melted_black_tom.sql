CREATE TABLE `price_offers` (
	`id` text PRIMARY KEY NOT NULL,
	`product_id` text NOT NULL,
	`source_name` text NOT NULL,
	`source_url` text NOT NULL,
	`channel` text NOT NULL,
	`list_price` integer NOT NULL,
	`shipping` integer DEFAULT 0 NOT NULL,
	`instant_discount` integer DEFAULT 0 NOT NULL,
	`final_price` integer NOT NULL,
	`volume` real NOT NULL,
	`unit` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`observed_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`approved_by` text,
	`approved_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `price_offers_public_idx` ON `price_offers` (`status`,`expires_at`,`product_id`);--> statement-breakpoint
CREATE INDEX `price_offers_product_idx` ON `price_offers` (`product_id`,`observed_at`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`brand` text NOT NULL,
	`name` text NOT NULL,
	`category` text NOT NULL,
	`unit` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `products_active_category_idx` ON `products` (`active`,`category`);