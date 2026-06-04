import type { McpDiscovery } from '../lib/discovery-from-openapi.js'
import { ROUTE_PATHS } from '../constants/routes.js'
import { absoluteUrl } from '../lib/url-utils.js'
import { MCP_TOOL_NAME_LIST } from './constants.js'

export function mcpDiscovery(requestUrl: string): McpDiscovery {
  return {
    method: 'POST',
    url: absoluteUrl(requestUrl, ROUTE_PATHS.mcp),
    note: 'Streamable HTTP MCP (not in OpenAPI). Agent registration uses x402 on POST /agents/register.',
    tools: [...MCP_TOOL_NAME_LIST],
  }
}
