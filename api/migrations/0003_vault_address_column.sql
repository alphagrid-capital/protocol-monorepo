ALTER TABLE `agent_drafts` ADD `vault_address` text;--> statement-breakpoint
UPDATE `agent_drafts` SET `vault_address` = json_extract(`wallet_json`, '$.vault') WHERE `wallet_json` IS NOT NULL;--> statement-breakpoint
ALTER TABLE `agent_drafts` DROP COLUMN `wallet_json`;
