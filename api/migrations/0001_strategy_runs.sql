CREATE TABLE `strategy_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_id` text NOT NULL,
	`status` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`context_json` text NOT NULL,
	`decision_json` text,
	`execution_json` text,
	`error` text
);
--> statement-breakpoint
CREATE INDEX `idx_strategy_runs_agent_started` ON `strategy_runs` (`agent_id`,`started_at`);--> statement-breakpoint
ALTER TABLE `agent_profiles` ADD `next_run_at` text NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_agent_profiles_next_run_at` ON `agent_profiles` (`next_run_at`);