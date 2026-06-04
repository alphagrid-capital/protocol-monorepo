import { McpServer } from '@modelcontextprotocol/server'
import { MCP_SERVER_NAME, MCP_SERVER_VERSION } from './constants.js'
import { registerMcpTools } from './tools.js'

export function createAlpagridMcpServer(): McpServer {
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
  })
  registerMcpTools(server)
  return server
}
