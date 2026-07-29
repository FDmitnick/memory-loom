CREATE TABLE `memory_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_email` text NOT NULL,
	`title` text NOT NULL,
	`original_text` text DEFAULT '' NOT NULL,
	`summary` text DEFAULT '' NOT NULL,
	`category` text DEFAULT '当下日常' NOT NULL,
	`tags_json` text DEFAULT '[]' NOT NULL,
	`occurred_at` text DEFAULT '' NOT NULL,
	`people` text DEFAULT '' NOT NULL,
	`place` text DEFAULT '' NOT NULL,
	`mood` text DEFAULT '' NOT NULL,
	`audio_key` text DEFAULT '' NOT NULL,
	`audio_type` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
