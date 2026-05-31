import type { McpDiscovery } from "../lib/discovery-from-openapi.js";
import { absoluteUrl } from "../lib/base-url.js";

export function mcpDiscovery(requestUrl: string): McpDiscovery {
  return {
    method: "POST",
    url: absoluteUrl(requestUrl, "/mcp"),
    note: "Streamable HTTP MCP (not in OpenAPI). Use an MCP client; mirrors vault list via alphagrid_list_vaults.",
    tools: ["alphagrid_list_vaults"],
  };
}
