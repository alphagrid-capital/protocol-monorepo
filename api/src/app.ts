import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import {
  McpServer,
  WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/server";
import { createAlpagridMcpServer } from "./mcp/server.js";
import { openApiJsonResponse } from "./openapi.js";
import { discoveryRoutes } from "./routes/discovery.js";
import { healthRoutes } from "./routes/health.js";
import { vaultRoutes } from "./routes/vaults.js";

export const mcpServer: McpServer = createAlpagridMcpServer();

const mcpTransport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
  enableJsonResponse: true,
});

const mcpReady = mcpServer.connect(mcpTransport);

export function createApp(): OpenAPIHono {
  const app = new OpenAPIHono();

  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "HEAD", "OPTIONS", "POST"],
      allowHeaders: ["Content-Type", "Accept", "MCP-Protocol-Version"],
    }),
  );

  app.route("/", discoveryRoutes);
  app.route("/", healthRoutes);
  app.route("/", vaultRoutes);

  app.get("/openapi.json", (c) =>
    c.json(openApiJsonResponse(app, c.req.url), 200, {
      "Cache-Control": "public, max-age=300",
    }),
  );

  app.get(
    "/docs",
    swaggerUI({
      url: "/openapi.json",
    }),
  );

  app.all("/mcp", async (c) => {
    await mcpReady;
    const contentType = c.req.header("content-type") ?? "";
    let parsedBody: unknown;
    if (contentType.includes("application/json")) {
      parsedBody = await c.req.json().catch(() => undefined);
    }
    return mcpTransport.handleRequest(c.req.raw, { parsedBody });
  });

  app.notFound((c) =>
    c.json({ error: "Not found", path: new URL(c.req.url).pathname }, 404),
  );

  return app;
}
