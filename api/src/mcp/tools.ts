import type { McpServer } from '@modelcontextprotocol/server'
import { z } from 'zod'
import { runRegistrationWithPayment } from '../lib/x402-agent-registration.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import {
  AgentRegistrationQuoteInputSchema,
  AgentRegistrationQuoteSchema,
  AgentRegistrationRequestSchema,
  AgentRegistrationResponseSchema,
  GetAgentByErc8004InputSchema,
  GetAgentInputSchema,
  GetAgentResponseSchema,
  LinkErc8004InputSchema,
  LinkErc8004ResponseSchema,
} from '../schemas/agent.js'
import { AgentRegistrationService } from '../services/agent-registration.service.js'
import { TokensService } from '../services/tokens.service.js'
import { VaultsService } from '../services/vaults.service.js'
import {
  ListTokensResponseSchema,
  OraclePricesResponseSchema,
  VaultTokensResponseSchema,
} from '../schemas/token.js'
import {
  GetAgentTradingInputSchema,
  GetIntentStatusInputSchema,
  PositionAdjustInputSchema,
  SubmitAddIntentInputSchema,
  SubmitAdjustIntentResponseSchema,
  SubmitExitLadderIntentInputSchema,
  SubmitReduceIntentInputSchema,
  SubmitTradeIntentInputSchema,
  SubmitTradeIntentResponseSchema,
  ListAgentPositionsResponseSchema,
} from '../schemas/trading.js'
import { ListVaultsResponseSchema } from '../schemas/vault.js'
import { TradingService } from '../services/trading.service.js'
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
    MCP_TOOL_NAMES.listTokens,
    {
      title: 'List tradable tokens',
      description: 'Mirrors GET /tokens.',
      inputSchema: z.object({}).strict(),
      outputSchema: ListTokensResponseSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async () =>
      mcpToolSuccess(await TokensService.fromEnv(getWorkerEnv()).listTokens())
  )

  server.registerTool(
    MCP_TOOL_NAMES.listVaultTokens,
    {
      title: 'List tokens for a vault',
      description: 'Mirrors GET /vaults/{id}/tokens.',
      inputSchema: z.object({
        vaultId: z.string().min(1),
      }),
      outputSchema: VaultTokensResponseSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async ({ vaultId }) => {
      const result =
        await TokensService.fromEnv(getWorkerEnv()).listVaultTokens(vaultId)
      if (!result) {
        return mcpToolError('Vault not found', 'NOT_FOUND')
      }
      return mcpToolSuccess(result)
    }
  )

  server.registerTool(
    MCP_TOOL_NAMES.getPrices,
    {
      title: 'Oracle prices by symbol',
      description: 'Mirrors GET /prices.',
      inputSchema: z.object({}).strict(),
      outputSchema: OraclePricesResponseSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async () =>
      mcpToolSuccess(
        await TokensService.fromEnv(getWorkerEnv()).getOraclePrices()
      )
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
        const output =
          await AgentRegistrationService.fromEnv(getWorkerEnv()).getAgent(
            agentId
          )
        return mcpToolSuccess(output)
      } catch (error) {
        return mcpToolErrorFromUnknown(error, 'Failed to load agent')
      }
    }
  )

  server.registerTool(
    MCP_TOOL_NAMES.getAgentByErc8004,
    {
      title: 'Get agent by ERC-8004 identity',
      description:
        'Mirrors GET /agents/by-erc8004/{erc8004AgentId}. Reads AgentRegistry.getAgentByERC8004 via RPC.',
      inputSchema: GetAgentByErc8004InputSchema,
      outputSchema: GetAgentResponseSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async ({ erc8004AgentId }) => {
      try {
        const output =
          await AgentRegistrationService.fromEnv(
            getWorkerEnv()
          ).getAgentByErc8004(erc8004AgentId)
        return mcpToolSuccess(output)
      } catch (error) {
        return mcpToolErrorFromUnknown(
          error,
          'Failed to load agent by ERC-8004'
        )
      }
    }
  )

  server.registerTool(
    MCP_TOOL_NAMES.linkAgentErc8004,
    {
      title: 'Link ERC-8004 identity to agent',
      description:
        'Mirrors POST /agents/{agentId}/erc8004/link. Submits linkERC8004Identity via registrar relayer.',
      inputSchema: LinkErc8004InputSchema,
      outputSchema: LinkErc8004ResponseSchema,
      annotations: WRITE_TOOL_ANNOTATIONS,
    },
    async (input) => {
      try {
        // TODO: rate-limit linkERC8004 requests per IP/signer/agentId (Cloudflare or in-worker)
        const output = await AgentRegistrationService.fromEnv(
          getWorkerEnv()
        ).linkErc8004(input.agentId, {
          erc8004AgentId: input.erc8004AgentId,
        })
        return mcpToolSuccess(output)
      } catch (error) {
        return mcpToolErrorFromUnknown(error, 'ERC-8004 link failed')
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

  server.registerTool(
    MCP_TOOL_NAMES.submitTradeIntent,
    {
      title: 'Submit trade intent',
      description:
        'Mirrors POST /agents/{agentId}/trade-intents (EIP-712 OpenPosition + executor).',
      inputSchema: SubmitTradeIntentInputSchema,
      outputSchema: SubmitTradeIntentResponseSchema,
      annotations: WRITE_TOOL_ANNOTATIONS,
    },
    async ({ agentId, ...body }) => {
      try {
        const output = await TradingService.fromEnv(
          getWorkerEnv()
        ).submitIntent(agentId, body)
        return mcpToolSuccess(output)
      } catch (error) {
        return mcpToolErrorFromUnknown(error, 'Trade submission failed')
      }
    }
  )

  server.registerTool(
    MCP_TOOL_NAMES.getAddIntentQuote,
    {
      title: 'Add-to-position intent quote',
      description: 'Mirrors GET /agents/{agentId}/add-intents/quote.',
      inputSchema: PositionAdjustInputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async ({ agentId, positionId }) => {
      try {
        const output = await TradingService.fromEnv(getWorkerEnv()).getAddQuote(
          agentId,
          positionId
        )
        return mcpToolSuccess(output)
      } catch (error) {
        return mcpToolErrorFromUnknown(error, 'Add quote failed')
      }
    }
  )

  server.registerTool(
    MCP_TOOL_NAMES.submitAddIntent,
    {
      title: 'Submit add-to-position intent',
      description: 'Mirrors POST /agents/{agentId}/add-intents.',
      inputSchema: SubmitAddIntentInputSchema,
      outputSchema: SubmitAdjustIntentResponseSchema,
      annotations: WRITE_TOOL_ANNOTATIONS,
    },
    async ({ agentId, ...body }) => {
      try {
        const output = await TradingService.fromEnv(
          getWorkerEnv()
        ).submitAddIntent(agentId, body)
        return mcpToolSuccess(output)
      } catch (error) {
        return mcpToolErrorFromUnknown(error, 'Add submission failed')
      }
    }
  )

  server.registerTool(
    MCP_TOOL_NAMES.getReduceIntentQuote,
    {
      title: 'Reduce-position intent quote',
      description: 'Mirrors GET /agents/{agentId}/reduce-intents/quote.',
      inputSchema: PositionAdjustInputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async ({ agentId, positionId }) => {
      try {
        const output = await TradingService.fromEnv(
          getWorkerEnv()
        ).getReduceQuote(agentId, positionId)
        return mcpToolSuccess(output)
      } catch (error) {
        return mcpToolErrorFromUnknown(error, 'Reduce quote failed')
      }
    }
  )

  server.registerTool(
    MCP_TOOL_NAMES.submitReduceIntent,
    {
      title: 'Submit reduce-position intent',
      description: 'Mirrors POST /agents/{agentId}/reduce-intents.',
      inputSchema: SubmitReduceIntentInputSchema,
      outputSchema: SubmitAdjustIntentResponseSchema,
      annotations: WRITE_TOOL_ANNOTATIONS,
    },
    async ({ agentId, ...body }) => {
      try {
        const output = await TradingService.fromEnv(
          getWorkerEnv()
        ).submitReduceIntent(agentId, body)
        return mcpToolSuccess(output)
      } catch (error) {
        return mcpToolErrorFromUnknown(error, 'Reduce submission failed')
      }
    }
  )

  server.registerTool(
    MCP_TOOL_NAMES.getExitLadderIntentQuote,
    {
      title: 'Update exit ladder intent quote',
      description: 'Mirrors GET /agents/{agentId}/exit-ladder-intents/quote.',
      inputSchema: PositionAdjustInputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async ({ agentId, positionId }) => {
      try {
        const output = await TradingService.fromEnv(
          getWorkerEnv()
        ).getExitLadderQuote(agentId, positionId)
        return mcpToolSuccess(output)
      } catch (error) {
        return mcpToolErrorFromUnknown(error, 'Exit ladder quote failed')
      }
    }
  )

  server.registerTool(
    MCP_TOOL_NAMES.submitExitLadderIntent,
    {
      title: 'Submit update exit ladder intent',
      description: 'Mirrors POST /agents/{agentId}/exit-ladder-intents.',
      inputSchema: SubmitExitLadderIntentInputSchema,
      outputSchema: SubmitAdjustIntentResponseSchema,
      annotations: WRITE_TOOL_ANNOTATIONS,
    },
    async ({ agentId, ...body }) => {
      try {
        const output = await TradingService.fromEnv(
          getWorkerEnv()
        ).submitExitLadderIntent(agentId, body)
        return mcpToolSuccess(output)
      } catch (error) {
        return mcpToolErrorFromUnknown(error, 'Exit ladder submission failed')
      }
    }
  )

  server.registerTool(
    MCP_TOOL_NAMES.getAgentPositions,
    {
      title: 'Agent open positions',
      description: 'Mirrors GET /agents/{agentId}/positions.',
      inputSchema: GetAgentTradingInputSchema,
      outputSchema: ListAgentPositionsResponseSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    async ({ agentId }) => {
      try {
        const output =
          await TradingService.fromEnv(getWorkerEnv()).listOpenPositions(
            agentId
          )
        return mcpToolSuccess(output)
      } catch (error) {
        return mcpToolErrorFromUnknown(error, 'Failed to load positions')
      }
    }
  )

  const tradingNotImplemented = () =>
    mcpToolError(TradingService.notImplemented().message, 'NOT_IMPLEMENTED')

  server.registerTool(
    MCP_TOOL_NAMES.getTradeHistory,
    {
      title: 'Agent trade history',
      description:
        'Mirrors GET /agents/{agentId}/trades. Returns NOT_IMPLEMENTED.',
      inputSchema: GetAgentTradingInputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    tradingNotImplemented
  )

  server.registerTool(
    MCP_TOOL_NAMES.getRiskState,
    {
      title: 'Agent risk state',
      description:
        'Mirrors GET /agents/{agentId}/risk-state. Returns NOT_IMPLEMENTED.',
      inputSchema: GetAgentTradingInputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    tradingNotImplemented
  )

  server.registerTool(
    MCP_TOOL_NAMES.getIntentStatus,
    {
      title: 'Trade intent status',
      description: 'Mirrors GET /intents/{intentId}. Returns NOT_IMPLEMENTED.',
      inputSchema: GetIntentStatusInputSchema,
      annotations: READ_ONLY_TOOL_ANNOTATIONS,
    },
    tradingNotImplemented
  )
}
