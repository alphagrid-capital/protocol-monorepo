import {
  isInitializeRequest,
  McpServer,
  WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/server";
import { createAlpagridMcpServer } from "./server.js";
import { runWithMcpRequest } from "./request-context.js";
import { runWithWorkerEnv } from "../lib/worker-env.js";
import type { WorkerEnv } from "../types/worker-env.js";

type McpSession = {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
};

/** In-memory MCP sessions (same Worker isolate). Use Durable Objects for multi-instance SSE. */
const sessions = new Map<string, McpSession>();

async function disposeSession(sessionId: string): Promise<void> {
  const entry = sessions.get(sessionId);
  if (!entry) return;
  sessions.delete(sessionId);
  try {
    await entry.transport.close();
  } catch {
    // ignore
  }
  try {
    await entry.server.close();
  } catch {
    // ignore
  }
}

function isInitializationBody(body: unknown): boolean {
  if (body === undefined || body === null) return false;
  const messages = Array.isArray(body) ? body : [body];
  return messages.some(
    (message) =>
      typeof message === "object" &&
      message !== null &&
      isInitializeRequest(message),
  );
}

async function createSession(): Promise<McpSession> {
  const server = createAlpagridMcpServer();

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    enableJsonResponse: false,
    onsessioninitialized: (sessionId) => {
      sessions.set(sessionId, { server, transport });
    },
    onsessionclosed: (sessionId) => {
      void disposeSession(sessionId);
    },
  });

  await server.connect(transport);
  return { server, transport };
}

function jsonRpcError(status: number, code: number, message: string): Response {
  return Response.json(
    { jsonrpc: "2.0", error: { code, message }, id: null },
    { status },
  );
}

export async function handleMcpRequest(
  request: Request,
  parsedBody?: unknown,
  env: WorkerEnv = {},
): Promise<Response> {
  return runWithWorkerEnv(env, () => runWithMcpRequest(request, async () => {
    const sessionHeader = request.headers.get("mcp-session-id");

    if (request.method === "POST" && isInitializationBody(parsedBody)) {
      const session = await createSession();
      const response = await session.transport.handleRequest(request, {
        parsedBody,
      });
      const sessionId = session.transport.sessionId;
      if (sessionId && !sessions.has(sessionId)) {
        sessions.set(sessionId, session);
      }
      return response;
    }

    if (!sessionHeader) {
      return jsonRpcError(
        400,
        -32_000,
        "Bad Request: Mcp-Session-Id header is required",
      );
    }

    const session = sessions.get(sessionHeader);
    if (!session) {
      return jsonRpcError(404, -32_001, "Session not found");
    }

    if (request.method === "GET") {
      session.transport.closeStandaloneSSEStream();
    }

    return session.transport.handleRequest(request, { parsedBody });
  }));
}
