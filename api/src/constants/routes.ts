export const ROUTE_PATHS = {
  discovery: '/',
  docs: '/docs',
  swaggerJson: '/docs/swagger.json',
  llmsTxt: '/llms.txt',
  mcp: '/mcp',
  vaults: '/vaults',
  vaultById: '/vaults/{id}',
  agentById: '/agents/{agentId}',
  agentRegister: '/agents/register',
  agentRegisterQuote: '/agents/register/quote',
} as const

export const HTTP_ROUTES = {
  agentRegister: `POST ${ROUTE_PATHS.agentRegister}`,
} as const
