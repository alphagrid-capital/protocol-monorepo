import type { OpenAPIHono } from "@hono/zod-openapi";
import { absoluteUrl } from "./lib/base-url.js";

export const OPENAPI_DOCUMENT_CONFIG = {
  openapi: "3.1.0" as const,
  info: {
    title: "AlphaGrid API",
    version: "0.1.0",
    description:
      "AlphaGrid HTTP API. MCP tools mirror these operations at POST /mcp (Streamable HTTP). For LLM URL fetchers, use GET /vaults or GET /vaults?format=md — see /llms.txt.",
  },
  tags: [
    { name: "System", description: "Health, discovery, and operational endpoints" },
    { name: "Vaults", description: "Thematic ERC-4626 vault catalog" },
  ],
};

/** OpenAPI document with `servers` set to the request origin (required for Custom GPT Actions). */
export function openApiJsonResponse(app: OpenAPIHono, requestUrl: string) {
  const document = app.getOpenAPI31Document(OPENAPI_DOCUMENT_CONFIG);
  const origin = absoluteUrl(requestUrl, "/");

  return {
    ...document,
    servers: [{ url: origin, description: "Current deployment" }],
  };
}
