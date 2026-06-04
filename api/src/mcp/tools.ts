import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { runRegistrationWithPayment } from '../lib/x402-agent-registration.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import {
  AgentRegistrationQuoteInputSchema,
  AgentRegistrationQuoteSchema,
  AgentRegistrationRequestSchema,
  AgentRegistrationResponseSchema,
  GetAgentInputSchema,
  GetAgentResponseSchema,
} from '../schemas/agent.js'
import { AgentRegistrationService } from '../services/agent-registration.service.js'
import { VaultsService } from '../services/vaults.service.js'
import { ListVaultsResponseSchema } from '../schemas/vault.js'
import {
  MCP_TOOL_NAMES,
  READ_ONLY_TOOL_ANNOTATIONS,
  WRITE_TOOL_ANNOTATIONS,
} from './constants.js'
import { getActiveMcpRequest } from './request-context.js'
import {
  mcpToolError,
  mcpToolErrorFromUnknown,
  mcpToolSuccess,
} from './result.js'

export function registerMcpTools(server: McpServer): void {
  server.registerTool(
    MCP_TOOL_NAMES.listVaults,
    {
      title: 'List AlphaGrid vaults',
      description: 'Mirrors GET /vaults.',
      inputSchema: z.object({}).strict(),
      outputSchema: ListVaultsResponseSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async () =>
      mcpToolSuccess(await VaultsService.fromEnv(getWorkerEnv()).listVaults())
  )

  server.registerTool(
    MCP_TOOL_NAMES.getAgent,
    {
      title: 'Get agent by id',
      description:
        'Mirrors GET /agents/{agentId}. Reads AgentRegistry.getAgent via RPC.',
      inputSchema: GetAgentInputSchema,
      outputSchema: GetAgentResponseSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async ({ agentId }) => {
      try {
        const output = await AgentRegistrationService.fromEnv(
          getWorkerEnv()
        ).getAgent(agentId)
        return mcpToolSuccess(output)
      } catch (error) {
        return mcpToolErrorFromUnknown(error, 'Failed to load agent')
      }
    }
  )

  server.registerTool(
    MCP_TOOL_NAMES.getAgentRegistrationQuote,
    {
      title: 'Agent registration quote',
      description: 'Mirrors GET /agents/register/quote (EIP-712 + x402 fee).',
      inputSchema: AgentRegistrationQuoteInputSchema,
      outputSchema: AgentRegistrationQuoteSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async ({ signer }) => {
      const output = await AgentRegistrationService.fromEnv(
        getWorkerEnv()
      ).getQuote(signer as `0x${string}` | undefined)
      return mcpToolSuccess(output)
    }
  )

  server.registerTool(
    MCP_TOOL_NAMES.registerAgent,
    {
      title: 'Register agent on AgentRegistry',
      description:
        'Mirrors POST /agents/register. Requires EIP-712 SelfRegister signature; x402 payment when enabled.',
      inputSchema: AgentRegistrationRequestSchema,
      outputSchema: AgentRegistrationResponseSchema,
      annotations: WRITE_TOOL_ANNOTATIONS,
    },
    async (input) => {
      try {
        const request = getActiveMcpRequest()
        if (!request) {
          return mcpToolError(
            'MCP request context is not available',
            'INTERNAL_SERVER_ERROR'
          )
        }

        const payment = await runRegistrationWithPayment({
          request,
          parsedBody: input,
          handler: () =>
            AgentRegistrationService.fromEnv(getWorkerEnv()).register(input),
          toResponseBody: (output) => JSON.stringify(output),
        })
        if (!payment.ok) {
          const body = await payment.response.text()
          return mcpToolError(
            `x402 payment required.\n\n${body}`,
            'PAYMENT_REQUIRED'
          )
        }

        return mcpToolSuccess(payment.value)
      } catch (error) {
        return mcpToolErrorFromUnknown(error, 'Registration failed')
      }
    }
  )
}
