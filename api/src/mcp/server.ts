import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { listVaults } from "../services/vaults.js";
import { ListVaultsResponseSchema } from "../schemas/vault.js";

const MCP_SERVER_NAME = "alphagrid-mcp-server";
const MCP_SERVER_VERSION = "0.1.0";

const listVaultsOutputSchema = ListVaultsResponseSchema;

/**
 * Registers AlphaGrid MCP tools. Each tool mirrors an HTTP API operation
 * implemented in the shared services layer.
 */
export function createAlpagridMcpServer(): McpServer {
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
  });

  server.registerTool(
    "alphagrid_list_vaults",
    {
      title: "List AlphaGrid vaults",
      description: `List thematic ERC-4626 vaults with basic stats (TVL, agent count, YTD return).

Use when you need vault catalog data for capital allocation, agent binding, or dashboards.
Mirrors GET /vaults on the HTTP API.

Returns:
  {
    "vaults": VaultSummary[],
    "total": number
  }

VaultSummary fields: id, name, slug, tagline, description, tvlUsd, tvlChange24hPct, agentCount, returnYtdPct, chainId, contractAddress.`,
      inputSchema: z.object({}).strict(),
      outputSchema: listVaultsOutputSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async () => {
      const output = listVaults();
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output as unknown as Record<string, unknown>,
      };
    },
  );

  return server;
}
