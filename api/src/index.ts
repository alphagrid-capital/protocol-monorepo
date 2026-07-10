import { createApp } from './app.js'
import { runWithWorkerEnv } from './lib/worker-env.js'
import { AlphagridMcp } from './mcp/alphagrid-mcp-agent.js'
import { alphagridMcpHandler } from './mcp/handler.js'
import { handleScheduled } from './scheduled.js'
import './types/hono-env.js'
import type { McpWorkerEnv, WorkerEnv } from './types/worker-env.js'

export { AlphagridMcp }

const app = createApp()

function isMcpRequest(request: Request): boolean {
  const { pathname } = new URL(request.url)
  return pathname === '/mcp' || pathname.startsWith('/mcp/')
}

export default {
  fetch(
    request: Request,
    env: WorkerEnv,
    ctx: ExecutionContext
  ): Response | Promise<Response> {
    if (isMcpRequest(request)) {
      return alphagridMcpHandler.fetch(request, env as McpWorkerEnv, ctx)
    }
    return runWithWorkerEnv(env, () => app.fetch(request, env))
  },
  scheduled(
    _event: ScheduledEvent,
    env: WorkerEnv,
    ctx: ExecutionContext
  ): void {
    ctx.waitUntil(
      Promise.resolve(runWithWorkerEnv(env, () => handleScheduled(env)))
    )
  },
}
