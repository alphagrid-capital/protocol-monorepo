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
import { screenUserStrategy } from './workers-ai.screen.js'

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
          response_format: { type: 'json_object' },
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
