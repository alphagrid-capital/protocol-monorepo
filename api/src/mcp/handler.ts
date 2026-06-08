import { runWithWorkerEnv } from '../lib/worker-env.js'
import type { WorkerEnv } from '../types/worker-env.js'
import { runWithMcpRequest } from './request-context.js'
import {
  createMcpSession,
  getMcpSession,
  isMcpInitializationBody,
  rememberMcpSession,
} from './sessions.js'

function jsonRpcError(status: number, code: number, message: string): Response {
  return Response.json(
    { jsonrpc: '2.0', error: { code, message }, id: null },
    { status }
  )
}

/**
 * Workers cannot safely close SSE streams opened by prior requests on the same
 * in-memory transport (cross-request promise resolution). Return a short-lived
 * standalone SSE response instead of a hanging stream. Tool calls use POST JSON.
 */
function workersFriendlyMcpGetResponse(
  sessionId: string,
  request: Request
): Response {
  const accept = request.headers.get('accept') ?? ''
  if (!accept.includes('text/event-stream')) {
    return jsonRpcError(
      406,
      -32_000,
      'Not Acceptable: Client must accept text/event-stream'
    )
  }

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(': ok\n\n'))
      controller.close()
    },
  })

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'mcp-session-id': sessionId,
    },
  })
}

async function parseJsonBody(
  request: Request,
  parsedBody?: unknown
): Promise<unknown> {
  if (parsedBody !== undefined) {
    return parsedBody
  }
  const contentType = request.headers.get('content-type') ?? ''
  if (!contentType.includes('application/json')) {
    return undefined
  }
  return request.json().catch(() => undefined)
}

export async function handleMcpRequest(
  request: Request,
  env: WorkerEnv = {},
  parsedBody?: unknown
): Promise<Response> {
  return runWithWorkerEnv(env, () =>
    runWithMcpRequest(request, async () => {
      const body = await parseJsonBody(request, parsedBody)
      const sessionHeader = request.headers.get('mcp-session-id')

      if (request.method === 'POST' && isMcpInitializationBody(body)) {
        const session = await createMcpSession()
        const response = await session.transport.handleRequest(request, {
          parsedBody: body,
        })
        const sessionId = session.transport.sessionId
        if (sessionId) {
          rememberMcpSession(sessionId, session)
        }
        return response
      }

      if (!sessionHeader) {
        return jsonRpcError(
          400,
          -32_000,
          'Bad Request: Mcp-Session-Id header is required. Use an MCP client with POST /mcp (initialize); browser GET is not supported.'
        )
      }

      const session = getMcpSession(sessionHeader)
      if (!session) {
        return jsonRpcError(404, -32_001, 'Session not found')
      }

      if (request.method === 'GET') {
        return workersFriendlyMcpGetResponse(sessionHeader, request)
      }

      return session.transport.handleRequest(request, { parsedBody: body })
    })
  )
}
