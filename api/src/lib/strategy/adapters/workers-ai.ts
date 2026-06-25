import type { StrategyAdapterOutcome } from '../../../schemas/strategy-adapter.js'
import type { WorkerEnvWithAi } from '../../../types/worker-env.js'
import type { StrategyContext } from '../decision.js'
import type { StrategyDecisionAdapter } from './types.js'
import { loadWorkersAiConfig } from './workers-ai.config.js'
import {
  parseWorkersAiResponse,
  readWorkersAiResponseText,
} from './workers-ai.parse.js'
import { buildWorkersAiMessages } from './workers-ai.prompt.js'
import {
  assessStrategyTradability,
  screenUserStrategy,
} from './workers-ai.screen.js'

const STRATEGY_AI_RESPONSE_FORMAT = {
  type: 'json_schema' as const,
  json_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      safety: {
        type: 'object',
        additionalProperties: false,
        properties: {
          passed: { type: 'boolean' },
          reason: { type: 'string' },
        },
        required: ['passed', 'reason'],
      },
      strategyAssessment: {
        type: 'object',
        additionalProperties: false,
        properties: {
          tradable: { type: 'boolean' },
          reason: { type: 'string' },
        },
        required: ['tradable', 'reason'],
      },
      decision: {
        anyOf: [
          { type: 'null' },
          {
            type: 'object',
            additionalProperties: false,
            properties: {
              summary: { type: 'string' },
              actions: {
                type: 'array',
                items: {
                  anyOf: [
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        type: { const: 'open' },
                        symbol: { type: 'string' },
                        usdcAmount: { type: 'string' },
                        exits: {
                          type: 'array',
                          items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                              triggerType: {
                                enum: ['StopLoss', 'TakeProfit'],
                              },
                              triggerBps: { type: 'number' },
                              exitBps: { type: 'number' },
                            },
                            required: [
                              'triggerType',
                              'triggerBps',
                              'exitBps',
                            ],
                          },
                        },
                      },
                      required: ['type', 'symbol', 'usdcAmount'],
                    },
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        type: { const: 'close' },
                        positionId: { type: 'string' },
                        exitBps: { type: 'number' },
                      },
                      required: ['type', 'positionId'],
                    },
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        type: { const: 'add' },
                        positionId: { type: 'string' },
                        usdcAmount: { type: 'string' },
                      },
                      required: ['type', 'positionId', 'usdcAmount'],
                    },
                    {
                      type: 'object',
                      additionalProperties: false,
                      properties: {
                        type: { const: 'reduce' },
                        positionId: { type: 'string' },
                        exitBps: { type: 'number' },
                      },
                      required: ['type', 'positionId', 'exitBps'],
                    },
                  ],
                },
              },
            },
            required: ['summary', 'actions'],
          },
        ],
      },
    },
    required: ['safety', 'strategyAssessment', 'decision'],
  },
}

export function createWorkersAiAdapter(
  env: WorkerEnvWithAi
): StrategyDecisionAdapter {
  const config = loadWorkersAiConfig(env)

  return {
    async decide(context: StrategyContext): Promise<StrategyAdapterOutcome> {
      const screened = screenUserStrategy(context.strategy)
      if (screened) {
        return screened
      }

      const tradability = assessStrategyTradability(
        context.strategy,
        context.guardrails.allowedSymbols
      )
      if (tradability) {
        return tradability
      }

      if (!env.AI) {
        return {
          status: 'error',
          code: 'AI_UNAVAILABLE',
          summary: 'Strategy decision failed — AI unavailable.',
          message: 'Workers AI binding is not configured.',
          actions: [],
        }
      }

      try {
        const response = await env.AI.run(config.model, {
          messages: buildWorkersAiMessages(context),
          max_tokens: config.maxTokens,
          response_format: STRATEGY_AI_RESPONSE_FORMAT,
        }, {
          gateway: {
            id: config.gatewayId,
          },
        })
        return parseWorkersAiResponse(readWorkersAiResponseText(response))
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Workers AI request failed.'
        const code =
          message.includes('JSON Mode') || message.includes("couldn't be met")
            ? 'INVALID_MODEL_OUTPUT'
            : 'AI_UNAVAILABLE'
        return {
          status: 'error',
          code,
          summary:
            code === 'INVALID_MODEL_OUTPUT'
              ? 'Strategy decision failed — invalid model output.'
              : 'Strategy decision failed — AI unavailable.',
          message,
          actions: [],
        }
      }
    },
  }
}
