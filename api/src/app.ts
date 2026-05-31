import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  McpServer,
  WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/server";
import { healthRoutes } from "./routes/health.js";
import { vaultRoutes } from "./routes/vaults.js";
import { createAlpagridMcpServer } from "./mcp/server.js";

const API_TITLE = "AlphaGrid API";
const API_VERSION = "0.1.0";

export const mcpServer: McpServer = createAlpagridMcpServer();

const mcpTransport = new WebStandardStreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
  enableJsonResponse: true,
});

const mcpReady = mcpServer.connect(mcpTransport);

export function createApp(): OpenAPIHono {
  const app = new OpenAPIHono();

  app.route("/", healthRoutes);
  app.route("/", vaultRoutes);

  app.doc("/openapi.json", {
    openapi: "3.1.0",
    info: {
      title: API_TITLE,
      version: API_VERSION,
      description:
        "AlphaGrid HTTP API. MCP tools mirror these operations at POST /mcp (Streamable HTTP).",
    },
    tags: [
      { name: "System", description: "Health and operational endpoints" },
      { name: "Vaults", description: "Thematic ERC-4626 vault catalog" },
    ],
  });

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
