import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { verifyRegistrationPayment } from "../lib/x402-agent-registration.js";
import { getWorkerEnv } from "../lib/worker-env.js";
import {
  AgentRegistrationQuoteInputSchema,
  AgentRegistrationQuoteSchema,
  AgentRegistrationRequestSchema,
  AgentRegistrationResponseSchema,
} from "../schemas/agent.js";
import {
  AgentRegistrationService,
} from "../services/agent-registration.js";
import { listVaults } from "../services/vaults.js";
import { ListVaultsResponseSchema } from "../schemas/vault.js";
import {
  MCP_TOOL_NAMES,
  READ_ONLY_TOOL_ANNOTATIONS,
  WRITE_TOOL_ANNOTATIONS,
} from "./constants.js";
import { getActiveMcpRequest } from "./request-context.js";
import { mcpToolError, mcpToolErrorFromUnknown, mcpToolSuccess } from "./result.js";

async function verifyRegistrationPaymentForMcp(
  input: z.infer<typeof AgentRegistrationRequestSchema>,
) {
  const request = getActiveMcpRequest();
  if (!request) {
    return mcpToolError("MCP request context is not available", "INTERNAL_SERVER_ERROR");
  }

  const payment = await verifyRegistrationPayment(request, input, getWorkerEnv());
  if (payment.ok) return null;

  const body = await payment.response.text();
  return mcpToolError(`x402 payment required.\n\n${body}`, "PAYMENT_REQUIRED");
}

export function registerMcpTools(server: McpServer): void {
  server.registerTool(
    MCP_TOOL_NAMES.listVaults,
    {
      title: "List AlphaGrid vaults",
      description: "Mirrors GET /vaults.",
      inputSchema: z.object({}).strict(),
      outputSchema: ListVaultsResponseSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async () => mcpToolSuccess(listVaults()),
  );

  server.registerTool(
    MCP_TOOL_NAMES.getAgentRegistrationQuote,
    {
      title: "Agent registration quote",
      description: "Mirrors GET /agents/register/quote (EIP-712 + x402 fee).",
      inputSchema: AgentRegistrationQuoteInputSchema,
      outputSchema: AgentRegistrationQuoteSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async ({ signer }) => {
      const output = await AgentRegistrationService.fromEnv(getWorkerEnv()).getQuote(
        signer as `0x${string}` | undefined,
      );
      return mcpToolSuccess(output);
    },
  );

  server.registerTool(
    MCP_TOOL_NAMES.registerAgent,
    {
      title: "Register agent on AgentRegistry",
      description:
        "Mirrors POST /agents/register. Requires EIP-712 SelfRegister signature; x402 payment when enabled.",
      inputSchema: AgentRegistrationRequestSchema,
      outputSchema: AgentRegistrationResponseSchema,
      annotations: WRITE_TOOL_ANNOTATIONS,
    },
    async (input) => {
      try {
        const paymentError = await verifyRegistrationPaymentForMcp(input);
        if (paymentError) return paymentError;

        const output = await AgentRegistrationService.fromEnv(getWorkerEnv()).register(input);
        return mcpToolSuccess(output);
      } catch (error) {
        return mcpToolErrorFromUnknown(error, "Registration failed");
      }
    },
  );
}
