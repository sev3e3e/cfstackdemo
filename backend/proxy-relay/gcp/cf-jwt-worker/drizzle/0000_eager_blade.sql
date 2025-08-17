CREATE TABLE `http_relay_jwt_cache` (
	`id` integer PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `jwt_key_idx` ON `http_relay_jwt_cache` (`key`);