import { runWithWorkerEnv } from "../lib/worker-env.js";
import type { WorkerEnv } from "../types/worker-env.js";
import { runWithMcpRequest } from "./request-context.js";
import {
  createMcpSession,
  getMcpSession,
  isMcpInitializationBody,
  rememberMcpSession,
} from "./sessions.js";

function jsonRpcError(status: number, code: number, message: string): Response {
  return Response.json(
    { jsonrpc: "2.0", error: { code, message }, id: null },
    { status },
  );
}

async function parseJsonBody(
  request: Request,
  parsedBody?: unknown,
): Promise<unknown> {
  if (parsedBody !== undefined) return parsedBody;
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return undefined;
  return request.json().catch(() => undefined);
}

export async function handleMcpRequest(
  request: Request,
  env: WorkerEnv = {},
  parsedBody?: unknown,
): Promise<Response> {
  return runWithWorkerEnv(env, () =>
    runWithMcpRequest(request, async () => {
      const body = await parseJsonBody(request, parsedBody);
      const sessionHeader = request.headers.get("mcp-session-id");

      if (request.method === "POST" && isMcpInitializationBody(body)) {
        const session = await createMcpSession();
        const response = await session.transport.handleRequest(request, {
          parsedBody: body,
        });
        const sessionId = session.transport.sessionId;
        if (sessionId) rememberMcpSession(sessionId, session);
        return response;
      }

      if (!sessionHeader) {
        return jsonRpcError(
          400,
          -32_000,
          "Bad Request: Mcp-Session-Id header is required",
        );
      }

      const session = getMcpSession(sessionHeader);
      if (!session) {
        return jsonRpcError(404, -32_001, "Session not found");
      }

      if (request.method === "GET") {
        session.transport.closeStandaloneSSEStream();
      }

      return session.transport.handleRequest(request, { parsedBody: body });
    }),
  );
}
