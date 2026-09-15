CREATE TABLE `preview_codes` (
	`code` text PRIMARY KEY NOT NULL,
	`preview_id` text NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`preview_id`) REFERENCES `previews`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `previews` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`card_id` text NOT NULL,
	`host` text NOT NULL,
	`status` text DEFAULT 'building' NOT NULL,
	`branch` text NOT NULL,
	`port` integer DEFAULT 3000 NOT NULL,
	`container_id` text,
	`target` text,
	`error` text,
	`last_access_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `previews_card_id_unique` ON `previews` (`card_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `previews_host_unique` ON `previews` (`host`);--> statement-breakpoint
CREATE INDEX `previews_board_idx` ON `previews` (`board_id`);--> statement-breakpoint
ALTER TABLE `boards` ADD `preview_epoch` integer DEFAULT 1 NOT NULL;