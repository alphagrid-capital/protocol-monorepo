import { swaggerUI } from "@hono/swagger-ui";
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { handleMcpRequest } from "./mcp/handler.js";
import { openApiJsonResponse } from "./openapi.js";
import { registerDiscoveryRoutes } from "./routes/discovery.js";
import { healthRoutes } from "./routes/health.js";
import { vaultRoutes } from "./routes/vaults.js";

export function createApp(): OpenAPIHono {
  const app = new OpenAPIHono();

  app.use(
    "*",
    cors({
      origin: "*",
      allowMethods: ["GET", "HEAD", "OPTIONS", "POST", "DELETE"],
      allowHeaders: [
        "Content-Type",
        "Accept",
        "MCP-Protocol-Version",
        "Mcp-Session-Id",
        "mcp-session-id",
        "Last-Event-ID",
      ],
      exposeHeaders: ["Mcp-Session-Id", "mcp-session-id", "MCP-Protocol-Version"],
    }),
  );

  app.route("/", healthRoutes);
  app.route("/", vaultRoutes);

  registerDiscoveryRoutes(app);

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
    const contentType = c.req.header("content-type") ?? "";
    let parsedBody: unknown;
    if (contentType.includes("application/json")) {
      parsedBody = await c.req.json().catch(() => undefined);
    }
    return handleMcpRequest(c.req.raw, parsedBody);
  });

  app.notFound((c) =>
    c.json({ error: "Not found", path: new URL(c.req.url).pathname }, 404),
  );

  return app;
}
