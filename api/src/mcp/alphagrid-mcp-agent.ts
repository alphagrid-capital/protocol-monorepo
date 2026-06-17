import type { Connection, ConnectionContext } from 'agents'
import { McpAgent } from 'agents/mcp'
import { runWithWorkerEnv } from '../lib/worker-env.js'
import type { McpWorkerEnv } from '../types/worker-env.js'
import { runWithMcpRequest } from './request-context.js'
import { createAlpagridMcpServer } from './server.js'

const MCP_HTTP_METHOD_HEADER = 'cf-mcp-method'

export class AlphagridMcp extends McpAgent<McpWorkerEnv> {
  server = createAlpagridMcpServer()

  async init(): Promise<void> {
    // Tools registered in createAlphagridMcpServer()
  }

  async onStart(props?: Record<string, unknown>): Promise<void> {
    void runWithWorkerEnv(this.env, () => undefined)
    await super.onStart(props)
  }

  async onConnect(conn: Connection, ctx: ConnectionContext): Promise<void> {
    void runWithWorkerEnv(this.env, () => undefined)
    const isStreamableMcpRequest =
      this.getTransportType() === 'streamable-http' &&
      (ctx.request.headers.get(MCP_HTTP_METHOD_HEADER) === 'POST' ||
        ctx.request.headers.get(MCP_HTTP_METHOD_HEADER) === 'GET')
    if (isStreamableMcpRequest) {
      await runWithMcpRequest(ctx.request, async () => {
        await super.onConnect(conn, ctx)
      })
      return
    }
    await super.onConnect(conn, ctx)
  }
}
