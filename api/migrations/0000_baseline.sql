CREATE TABLE `agent_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_address` text NOT NULL,
	`handle` text,
	`identity_json` text,
	`wallet_json` text,
	`strategy` text,
	`bot_frequency` text,
	`pricing_tier` text,
	`signer_address` text,
	`encrypted_signer_key` text,
	`key_version` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`launched_agent_id` text,
	`launch_tx_hash` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_agent_drafts_owner` ON `agent_drafts` (`owner_address`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_agent_drafts_handle_active` ON `agent_drafts` (`handle`) WHERE status = 'draft' AND handle IS NOT NULL;--> statement-breakpoint
CREATE TABLE `agent_profiles` (
	`agent_id` text PRIMARY KEY NOT NULL,
	`owner_address` text NOT NULL,
	`handle` text NOT NULL,
	`strategy` text NOT NULL,
	`bot_frequency` text DEFAULT '1h' NOT NULL,
	`pricing_tier` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_agent_profiles_owner` ON `agent_profiles` (`owner_address`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_agent_profiles_handle` ON `agent_profiles` (`handle`);--> statement-breakpoint
CREATE TABLE `agent_signers` (
	`agent_id` text PRIMARY KEY NOT NULL,
	`owner_address` text NOT NULL,
	`signer_address` text NOT NULL,
	`encrypted_signer_key` text NOT NULL,
	`key_version` integer DEFAULT 1 NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_agent_signers_owner` ON `agent_signers` (`owner_address`);--> statement-breakpoint
CREATE TABLE `users` (
	`address` text PRIMARY KEY NOT NULL,
	`display_name` text,
	`preferred_currency` text DEFAULT 'USD' NOT NULL,
	`registered_at` text NOT NULL,
	`registered_ip` text,
	`last_login_at` text NOT NULL,
	`last_login_ip` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_users_last_login_at` ON `users` (`last_login_at`);