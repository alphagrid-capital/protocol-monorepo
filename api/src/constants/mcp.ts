import type { McpDiscovery } from "../lib/discovery-from-openapi.js";
import { absoluteUrl } from "../lib/base-url.js";

export function mcpDiscovery(requestUrl: string): McpDiscovery {
  return {
    method: "POST",
    url: absoluteUrl(requestUrl, "/mcp"),
    note: "Streamable HTTP MCP (not in OpenAPI). Agent registration uses x402 on POST /agents/register.",
    tools: [
      "alphagrid_list_vaults",
      "alphagrid_get_agent_registration_quote",
      "alphagrid_register_agent",
    ],
  };
}
