ALTER TABLE `agent_drafts` ADD `data_connections` text;--> statement-breakpoint
ALTER TABLE `agent_profiles` ADD `data_connections` text;--> statement-breakpoint
CREATE TABLE `signals_cache` (
	`cache_key` text PRIMARY KEY NOT NULL,
	`payload_json` text NOT NULL,
	`fetched_at` text NOT NULL
);
