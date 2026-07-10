import { sql } from 'drizzle-orm'
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

export const users = sqliteTable(
  'users',
  {
    address: text('address').primaryKey(),
    displayName: text('display_name'),
    email: text('email'),
    preferredCurrency: text('preferred_currency').notNull().default('USD'),
    registeredAt: text('registered_at').notNull(),
    registeredIp: text('registered_ip'),
    lastLoginAt: text('last_login_at').notNull(),
    lastLoginIp: text('last_login_ip'),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [index('idx_users_last_login_at').on(table.lastLoginAt)]
)

export const agentDrafts = sqliteTable(
  'agent_drafts',
  {
    id: text('id').primaryKey(),
    ownerAddress: text('owner_address').notNull(),
    handle: text('handle'),
    identityJson: text('identity_json'),
    vaultAddress: text('vault_address'),
    strategy: text('strategy'),
    botFrequency: text('bot_frequency'),
    pricingTier: text('pricing_tier'),
    signerAddress: text('signer_address'),
    encryptedSignerKey: text('encrypted_signer_key'),
    keyVersion: integer('key_version').notNull().default(1),
    status: text('status').notNull().default('draft'),
    launchedAgentId: text('launched_agent_id'),
    launchTxHash: text('launch_tx_hash'),
    createdAt: text('created_at').notNull(),
    updatedAt: text('updated_at').notNull(),
  },
  (table) => [
    index('idx_agent_drafts_owner').on(table.ownerAddress),
    uniqueIndex('idx_agent_drafts_handle_active')
      .on(table.handle)
      .where(sql`status = 'draft' AND handle IS NOT NULL`),
  ]
)

export const agentSigners = sqliteTable(
  'agent_signers',
  {
    agentId: text('agent_id').primaryKey(),
    ownerAddress: text('owner_address').notNull(),
    signerAddress: text('signer_address').notNull(),
    encryptedSignerKey: text('encrypted_signer_key').notNull(),
    keyVersion: integer('key_version').notNull().default(1),
    createdAt: text('created_at').notNull(),
  },
  (table) => [index('idx_agent_signers_owner').on(table.ownerAddress)]
)

export const agentProfiles = sqliteTable(
  'agent_profiles',
  {
    agentId: text('agent_id').primaryKey(),
    ownerAddress: text('owner_address').notNull(),
    handle: text('handle').notNull(),
    strategy: text('strategy').notNull(),
    botFrequency: text('bot_frequency').notNull().default('1h'),
    pricingTier: text('pricing_tier').notNull(),
    nextRunAt: text('next_run_at').notNull(),
    archivedAt: text('archived_at'),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    index('idx_agent_profiles_owner').on(table.ownerAddress),
    index('idx_agent_profiles_next_run_at').on(table.nextRunAt),
    uniqueIndex('idx_agent_profiles_handle_active')
      .on(table.handle)
      .where(sql`archived_at IS NULL`),
  ]
)

export const strategyRuns = sqliteTable(
  'strategy_runs',
  {
    id: text('id').primaryKey(),
    agentId: text('agent_id').notNull(),
    status: text('status').notNull(),
    startedAt: text('started_at').notNull(),
    completedAt: text('completed_at'),
    contextJson: text('context_json').notNull(),
    decisionJson: text('decision_json'),
    executionJson: text('execution_json'),
    error: text('error'),
  },
  (table) => [
    index('idx_strategy_runs_agent_started').on(table.agentId, table.startedAt),
  ]
)
