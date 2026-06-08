export const ROUTE_PATHS = {
  discovery: '/',
  docs: '/docs',
  swaggerJson: '/docs/swagger.json',
  llmsTxt: '/llms.txt',
  mcp: '/mcp',
  vaults: '/vaults',
  vaultById: '/vaults/{id}',
  vaultTokens: '/vaults/{id}/tokens',
  tokens: '/tokens',
  prices: '/prices',
  pricesRefresh: '/prices/refresh',
  agentById: '/agents/{agentId}',
  agentByErc8004: '/agents/by-erc8004/{erc8004AgentId}',
  agentLinkErc8004: '/agents/{agentId}/erc8004/link',
  agentRegister: '/agents/register',
  agentRegisterQuote: '/agents/register/quote',
  agentTradeIntents: '/agents/{agentId}/trade-intents',
  agentTradeIntentsQuote: '/agents/{agentId}/trade-intents/quote',
  agentTrades: '/agents/{agentId}/trades',
  agentPositions: '/agents/{agentId}/positions',
  agentRiskState: '/agents/{agentId}/risk-state',
  intentsTrade: '/intents/trade',
  intentById: '/intents/{intentId}',
} as const

export const HTTP_ROUTES = {
  agentRegister: `POST ${ROUTE_PATHS.agentRegister}`,
} as const
