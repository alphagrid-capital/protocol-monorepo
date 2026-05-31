import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import { absoluteUrl } from "../lib/base-url.js";

const DiscoverySchema = z
  .object({
    name: z.string(),
    version: z.string(),
    description: z.string(),
    baseUrl: z.string().url(),
    documentation: z.object({
      openapi: z.string().url(),
      swaggerUi: z.string().url(),
      llmsTxt: z.string().url(),
    }),
    dataEndpoints: z.array(
      z.object({
        method: z.string(),
        path: z.string(),
        url: z.string().url(),
        description: z.string(),
        formats: z.array(z.string()),
      }),
    ),
    mcp: z.object({
      method: z.string(),
      url: z.string().url(),
      note: z.string(),
      tools: z.array(z.string()),
    }),
    hints: z.object({
      forChatGptBrowsing: z.string(),
      forCustomGptActions: z.string(),
      forMcpClients: z.string(),
    }),
  })
  .openapi("ApiDiscovery");

const discoveryRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["System"],
  summary: "API discovery",
  description:
    "Machine-readable index of public endpoints. Paste the `dataEndpoints[].url` values (not /docs) into tools that fetch URLs.",
  responses: {
    200: {
      description: "API index",
      content: {
        "application/json": {
          schema: DiscoverySchema,
        },
      },
    },
  },
});

export const discoveryRoutes = new OpenAPIHono();

discoveryRoutes.openapi(discoveryRoute, (c) => {
  const baseUrl = absoluteUrl(c.req.url, "/");
  const vaultsUrl = absoluteUrl(c.req.url, "/vaults");

  return c.json({
    name: "AlphaGrid API",
    version: "0.1.0",
    description:
      "HTTP API and MCP server for AlphaGrid vault catalog and agent tooling.",
    baseUrl,
    documentation: {
      openapi: absoluteUrl(c.req.url, "/openapi.json"),
      swaggerUi: absoluteUrl(c.req.url, "/docs"),
      llmsTxt: absoluteUrl(c.req.url, "/llms.txt"),
    },
    dataEndpoints: [
      {
        method: "GET",
        path: "/vaults",
        url: vaultsUrl,
        description: "Vault catalog with TVL, agents, and returns (JSON).",
        formats: ["application/json", "text/markdown (?format=md)"],
      },
      {
        method: "GET",
        path: "/health",
        url: absoluteUrl(c.req.url, "/health"),
        description: "Liveness probe.",
        formats: ["application/json"],
      },
    ],
    mcp: {
      method: "POST",
      url: absoluteUrl(c.req.url, "/mcp"),
      note: "Streamable HTTP MCP. Not fetchable via GET in browsers; use an MCP client or Custom GPT with Actions/OpenAPI.",
      tools: ["alphagrid_list_vaults"],
    },
    hints: {
      forChatGptBrowsing: `Use the public data URL: ${vaultsUrl} (or ${vaultsUrl}?format=md for markdown). The Swagger UI at /docs is for humans, not for URL fetchers.`,
      forCustomGptActions: `Import OpenAPI from ${absoluteUrl(c.req.url, "/openapi.json")} when creating a Custom GPT Action.`,
      forMcpClients: `Connect to POST ${absoluteUrl(c.req.url, "/mcp")} with Accept: application/json, text/event-stream`,
    },
  });
});

discoveryRoutes.get("/llms.txt", (c) => {
  const base = absoluteUrl(c.req.url, "/");
  const vaults = absoluteUrl(c.req.url, "/vaults");
  const vaultsMd = `${vaults}?format=md`;
  const openapi = absoluteUrl(c.req.url, "/openapi.json");

  const body = `# AlphaGrid API

> AlphaGrid HTTP API and MCP server for thematic ERC-4626 vaults and agent tooling.

This file helps LLMs and assistants discover **fetchable** URLs. For live vault data, call the JSON or markdown endpoints below—not the Swagger HTML UI.

## Data (fetch these)

- [Vault catalog (JSON)](${vaults}): GET — TVL, agent count, YTD return per vault (mocked until indexer)
- [Vault catalog (Markdown)](${vaultsMd}): GET — same data as plain markdown for chat tools
- [API discovery (JSON)](${base}): GET — index of all public endpoints
- [Health](${absoluteUrl(c.req.url, "/health")}): GET — liveness

## Documentation

- [OpenAPI 3.1](${openapi}): Machine-readable spec for Custom GPT Actions and codegen
- [Swagger UI](${absoluteUrl(c.req.url, "/docs")}): Human-readable interactive docs (not ideal for URL paste)

## MCP

- MCP endpoint: POST ${absoluteUrl(c.req.url, "/mcp")} (Streamable HTTP; requires MCP client, not a browser GET)
- Tool \`alphagrid_list_vaults\` mirrors GET /vaults

## Optional

- [OpenAPI on GitHub](https://github.com/alphagrid-prop/contracts/tree/main/api): Source repository
`;

  return c.text(body, 200, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "public, max-age=300",
  });
});

discoveryRoutes.get("/robots.txt", (c) => {
  const lines = [
    "User-agent: *",
    "Allow: /",
    "Allow: /vaults",
    "Allow: /llms.txt",
    "Allow: /openapi.json",
    "",
    `# LLM discovery: ${absoluteUrl(c.req.url, "/llms.txt")}`,
  ];
  return c.text(lines.join("\n"), 200, {
    "Content-Type": "text/plain; charset=utf-8",
  });
});
