export const MCP_SERVER_NAME = 'alphagrid-mcp-server'
export const MCP_SERVER_VERSION = '0.1.0'

/** Single source of truth for MCP tool names (discovery + server registration). */
export const MCP_TOOL_NAMES = {
  listVaults: 'alphagrid_list_vaults',
  listTokens: 'alphagrid_list_tokens',
  listVaultTokens: 'alphagrid_list_vault_tokens',
  getPrices: 'alphagrid_get_prices',
  getAgent: 'alphagrid_get_agent',
  getAgentByErc8004: 'alphagrid_get_agent_by_erc8004',
  linkAgentErc8004: 'alphagrid_link_agent_erc8004',
  getAgentRegistrationQuote: 'alphagrid_get_agent_registration_quote',
  registerAgent: 'alphagrid_register_agent',
  submitTradeIntent: 'alphagrid_submit_trade_intent',
  getAddIntentQuote: 'alphagrid_get_add_intent_quote',
  submitAddIntent: 'alphagrid_submit_add_intent',
  getReduceIntentQuote: 'alphagrid_get_reduce_intent_quote',
  submitReduceIntent: 'alphagrid_submit_reduce_intent',
  getExitLadderIntentQuote: 'alphagrid_get_exit_ladder_intent_quote',
  submitExitLadderIntent: 'alphagrid_submit_exit_ladder_intent',
  getAgentPositions: 'alphagrid_get_agent_positions',
  getTradeHistory: 'alphagrid_get_trade_history',
  getRiskState: 'alphagrid_get_risk_state',
  getIntentStatus: 'alphagrid_get_intent_status',
} as const

export const MCP_TOOL_NAME_LIST = Object.values(MCP_TOOL_NAMES)

export const READ_ONLY_TOOL_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const

export const WRITE_TOOL_ANNOTATIONS = {
  readOnlyHint: false,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const
