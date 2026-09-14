CREATE TABLE `approvals` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`user_id` text NOT NULL,
	`pr_number` integer,
	`head_sha` text,
	`created_at` text NOT NULL,
	`invalidated_at` text,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `attachments` (
	`id` text PRIMARY KEY NOT NULL,
	`comment_id` text NOT NULL,
	`filename` text NOT NULL,
	`mime` text NOT NULL,
	`size` integer NOT NULL,
	`sha256` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `board_members` (
	`board_id` text NOT NULL,
	`user_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`board_id`, `user_id`),
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `boards` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`repo_url` text,
	`provider` text DEFAULT 'claude' NOT NULL,
	`preview_mode` text DEFAULT 'external' NOT NULL,
	`agent_image` text,
	`max_concurrent_sessions` integer DEFAULT 3 NOT NULL,
	`prompt_append` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `boards_slug_unique` ON `boards` (`slug`);--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`priority` text DEFAULT 'none' NOT NULL,
	`column` text DEFAULT 'inbox' NOT NULL,
	`position` real DEFAULT 0 NOT NULL,
	`creator_kind` text DEFAULT 'user' NOT NULL,
	`creator_id` text,
	`parent_card_id` text,
	`revision` integer DEFAULT 0 NOT NULL,
	`branch` text,
	`pr_url` text,
	`pr_number` integer,
	`preview_url` text,
	`pending_rerun` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cards_board_column_idx` ON `cards` (`board_id`,`column`);--> statement-breakpoint
CREATE TABLE `comment_revisions` (
	`id` text PRIMARY KEY NOT NULL,
	`comment_id` text NOT NULL,
	`body` text NOT NULL,
	`replaced_at` text NOT NULL,
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`card_id` text NOT NULL,
	`author_kind` text NOT NULL,
	`author_id` text,
	`session_id` text,
	`body` text NOT NULL,
	`edited_at` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`card_id`) REFERENCES `cards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `comments_card_idx` ON `comments` (`card_id`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`card_id` text,
	`actor_kind` text NOT NULL,
	`actor_id` text,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `events_card_idx` ON `events` (`card_id`);--> statement-breakpoint
CREATE INDEX `events_board_idx` ON `events` (`board_id`);--> statement-breakpoint
CREATE TABLE `mentions` (
	`comment_id` text NOT NULL,
	`user_id` text NOT NULL,
	`notified_at` text,
	PRIMARY KEY(`comment_id`, `user_id`),
	FOREIGN KEY (`comment_id`) REFERENCES `comments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `outbound_emails` (
	`id` text PRIMARY KEY NOT NULL,
	`to_user_id` text NOT NULL,
	`subject` text NOT NULL,
	`html` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`error` text,
	`created_at` text NOT NULL,
	`sent_at` text
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`card_id` text,
	`kind` text DEFAULT 'card' NOT NULL,
	`provider` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`intent` text,
	`branch` text,
	`container_id` text,
	`token_hash` text,
	`started_at` text,
	`ended_at` text,
	`outcome_summary` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`board_id`) REFERENCES `boards`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_board_status_idx` ON `sessions` (`board_id`,`status`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `triggers` (
	`id` text PRIMARY KEY NOT NULL,
	`board_id` text NOT NULL,
	`card_id` text NOT NULL,
	`kind` text NOT NULL,
	`actor_user_id` text,
	`payload` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`session_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `triggers_card_status_idx` ON `triggers` (`card_id`,`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`handle` text NOT NULL,
	`name` text NOT NULL,
	`avatar_url` text,
	`role` text DEFAULT 'member' NOT NULL,
	`status` text DEFAULT 'invited' NOT NULL,
	`clerk_user_id` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_handle_unique` ON `users` (`handle`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_clerk_user_id_unique` ON `users` (`clerk_user_id`);