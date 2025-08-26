CREATE TABLE `items` (
	`id` integer PRIMARY KEY NOT NULL,
	`site_id` integer NOT NULL,
	`site_specific_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`description` text NOT NULL,
	`thumb_url` text,
	`avg_rating` integer,
	`review_count` integer,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `items_site_id_site_specific_id_unique` ON `items` (`site_id`,`site_specific_id`);--> statement-breakpoint
CREATE TABLE `reviewers` (
	`id` integer PRIMARY KEY NOT NULL,
	`reviewer_id` text,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` integer PRIMARY KEY NOT NULL,
	`item_id` integer NOT NULL,
	`site_id` integer NOT NULL,
	`review_id` text NOT NULL,
	`reviewer_id` integer,
	`title` text,
	`body` text,
	`rating` integer,
	`created_at` text,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`site_id`) REFERENCES `sites`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`reviewer_id`) REFERENCES `reviewers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `samples` (
	`item_id` integer,
	`url` text NOT NULL,
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sites` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL
);
