CREATE TABLE `kakao_cart_imports` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`encrypted_url` text NOT NULL,
	`encryption_iv` text NOT NULL,
	`bot_user_hash` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer
);
--> statement-breakpoint
CREATE INDEX `kakao_cart_imports_expiry_idx` ON `kakao_cart_imports` (`expires_at`);--> statement-breakpoint
CREATE INDEX `kakao_cart_imports_user_idx` ON `kakao_cart_imports` (`bot_user_hash`,`created_at`);