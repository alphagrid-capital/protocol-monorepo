import { AlphagridMcp } from './alphagrid-mcp-agent.js'

/** Shared McpAgent.serve handler for POST/GET/DELETE /mcp. */
export const alphagridMcpHandler = AlphagridMcp.serve('/mcp')
