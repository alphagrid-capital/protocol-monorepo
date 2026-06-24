DROP INDEX `idx_agent_profiles_handle`;--> statement-breakpoint
ALTER TABLE `agent_profiles` ADD `archived_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `idx_agent_profiles_handle_active` ON `agent_profiles` (`handle`) WHERE archived_at IS NULL;