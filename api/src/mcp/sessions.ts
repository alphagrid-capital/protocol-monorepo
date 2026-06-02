import {
  isInitializeRequest,
  McpServer,
  WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/server";
import { createAlpagridMcpServer } from "./server.js";

export type McpSession = {
  server: McpServer;
  transport: WebStandardStreamableHTTPServerTransport;
};

/** In-memory MCP sessions (same Worker isolate). Use Durable Objects for multi-instance SSE. */
const sessions = new Map<string, McpSession>();

export async function disposeMcpSession(sessionId: string): Promise<void> {
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

export function isMcpInitializationBody(body: unknown): boolean {
  if (body === undefined || body === null) return false;
  const messages = Array.isArray(body) ? body : [body];
  return messages.some(
    (message) =>
      typeof message === "object" &&
      message !== null &&
      isInitializeRequest(message),
  );
}

export async function createMcpSession(): Promise<McpSession> {
  const server = createAlpagridMcpServer();

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => crypto.randomUUID(),
    enableJsonResponse: false,
    onsessioninitialized: (sessionId) => {
      sessions.set(sessionId, { server, transport });
    },
    onsessionclosed: (sessionId) => {
      void disposeMcpSession(sessionId);
    },
  });

  await server.connect(transport);
  return { server, transport };
}

export function getMcpSession(sessionId: string): McpSession | undefined {
  return sessions.get(sessionId);
}

export function rememberMcpSession(sessionId: string, session: McpSession): void {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, session);
  }
}
