import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  AgentRegistrationQuoteSchema,
  AgentRegistrationRequestSchema,
  AgentRegistrationResponseSchema,
} from "../schemas/agent.js";
import { verifyRegistrationPayment } from "../lib/x402-agent-registration.js";
import {
  AgentRegistrationError,
  getAgentRegistrationQuote,
  registerAgent,
} from "../services/agent-registration.js";
import { listVaults } from "../services/vaults.js";
import { ListVaultsResponseSchema } from "../schemas/vault.js";
import { getActiveMcpRequest } from "./request-context.js";

const MCP_SERVER_NAME = "alphagrid-mcp-server";
const MCP_SERVER_VERSION = "0.2.0";

export function createAlpagridMcpServer(): McpServer {
  const server = new McpServer({
    name: MCP_SERVER_NAME,
    version: MCP_SERVER_VERSION,
  });

  server.registerTool(
    "alphagrid_list_vaults",
    {
      title: "List AlphaGrid vaults",
      description: "Mirrors GET /vaults.",
      inputSchema: z.object({}).strict(),
      outputSchema: ListVaultsResponseSchema,
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

  server.registerTool(
    "alphagrid_get_agent_registration_quote",
    {
      title: "Agent registration quote",
      description: "Mirrors GET /agents/register/quote (EIP-712 + x402 fee).",
      inputSchema: z
        .object({
          signer: z
            .string()
            .regex(/^0x[a-fA-F0-9]{40}$/)
            .optional(),
        })
        .strict(),
      outputSchema: AgentRegistrationQuoteSchema,
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    async ({ signer }) => {
      const output = await getAgentRegistrationQuote(signer as `0x${string}` | undefined);
      return {
        content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
        structuredContent: output as unknown as Record<string, unknown>,
      };
    },
  );

  server.registerTool(
    "alphagrid_register_agent",
    {
      title: "Register agent on AgentRegistry",
      description:
        "Mirrors POST /agents/register. Requires EIP-712 SelfRegister signature; x402 payment when enabled.",
      inputSchema: AgentRegistrationRequestSchema,
      outputSchema: AgentRegistrationResponseSchema,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: true,
      },
    },
    async (input) => {
      const mcpRequest = getActiveMcpRequest();
      if (mcpRequest) {
        const payment = await verifyRegistrationPayment(mcpRequest, input);
        if (!payment.ok) {
          const body = await payment.response.text();
          return {
            content: [
              {
                type: "text",
                text: `x402 payment required.\n\n${body}`,
              },
            ],
            isError: true,
          };
        }
      }

      try {
        const output = await registerAgent(input);
        return {
          content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
          structuredContent: output as unknown as Record<string, unknown>,
        };
      } catch (error) {
        const message =
          error instanceof AgentRegistrationError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Registration failed";
        return {
          content: [{ type: "text", text: message }],
          isError: true,
        };
      }
    },
  );

  return server;
}
