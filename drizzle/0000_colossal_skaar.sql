CREATE TABLE `elders` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`relationship` text NOT NULL,
	`birth_year` text DEFAULT '' NOT NULL,
	`birth_place` text DEFAULT '' NOT NULL,
	`personality` text DEFAULT '' NOT NULL,
	`boundaries` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `interviews` (
	`id` text PRIMARY KEY NOT NULL,
	`elder_id` text NOT NULL,
	`theme` text NOT NULL,
	`duration_minutes` integer DEFAULT 20 NOT NULL,
	`questions_json` text DEFAULT '[]' NOT NULL,
	`transcript` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`audio_key` text DEFAULT '' NOT NULL,
	`audio_type` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`confirmed_at` text
);
--> statement-breakpoint
CREATE TABLE `stories` (
	`id` text PRIMARY KEY NOT NULL,
	`interview_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`time_label` text DEFAULT '时间待确认' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`people` text DEFAULT '' NOT NULL,
	`quote` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
