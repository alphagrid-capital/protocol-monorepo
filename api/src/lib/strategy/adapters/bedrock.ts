import { AwsClient } from 'aws4fetch'
import type { StrategyAdapterOutcome } from '../../../schemas/strategy-adapter.js'
import type { WorkerEnvWithAi } from '../../../types/worker-env.js'
import type { StrategyContext } from '../decision.js'
import {
  DEFAULT_BEDROCK_MODEL_ID,
  loadBedrockConfig,
  type BedrockConfig,
} from './bedrock.config.js'
import type { StrategyDecisionAdapter } from './types.js'
import { parseWorkersAiResponse } from './workers-ai.parse.js'
import { buildWorkersAiMessages } from './workers-ai.prompt.js'
import {
  assessStrategyTradability,
  screenUserStrategy,
} from './workers-ai.screen.js'

interface BedrockConverseTextBlock {
  text?: string
}

interface BedrockConverseResponse {
  output?: {
    message?: {
      content?: BedrockConverseTextBlock[]
    }
  }
  message?: string
}

function readBedrockResponseText(payload: BedrockConverseResponse): string {
  const blocks = payload.output?.message?.content
  if (!Array.isArray(blocks) || blocks.length === 0) {
    throw new Error('Bedrock response missing output.message.content')
  }
  const text = blocks
    .map((block) => (typeof block.text === 'string' ? block.text : ''))
    .join('')
    .trim()
  if (!text) {
    throw new Error('Bedrock response content had no text')
  }
  return text
}

function buildConverseBody(
  context: StrategyContext,
  config: BedrockConfig
): Record<string, unknown> {
  const messages = buildWorkersAiMessages(context)
  const systemParts = messages
    .filter((message) => message.role === 'system')
    .map((message) => ({ text: message.content }))
  const converseMessages = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({
      role: message.role,
      content: [{ text: message.content }],
    }))

  return {
    messages: converseMessages,
    system: systemParts,
    inferenceConfig: {
      maxTokens: config.maxTokens,
      temperature: 0.2,
    },
  }
}

export async function invokeBedrockConverse(
  config: BedrockConfig,
  context: StrategyContext
): Promise<string> {
  const aws = new AwsClient({
    accessKeyId: config.accessKeyId,
    secretAccessKey: config.secretAccessKey,
    sessionToken: config.sessionToken,
    region: config.region,
    service: 'bedrock',
  })

  const url = `https://bedrock-runtime.${config.region}.amazonaws.com/model/${encodeURIComponent(config.modelId)}/converse`
  const response = await aws.fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(buildConverseBody(context, config)),
  })

  const payload = (await response.json()) as BedrockConverseResponse
  if (!response.ok) {
    const detail =
      typeof payload.message === 'string'
        ? payload.message
        : JSON.stringify(payload).slice(0, 400)
    throw new Error(`Bedrock Converse HTTP ${response.status}: ${detail}`)
  }

  return readBedrockResponseText(payload)
}

export function createBedrockAdapter(
  env: WorkerEnvWithAi
): StrategyDecisionAdapter {
  let config: BedrockConfig
  try {
    config = loadBedrockConfig(env)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Bedrock config invalid.'
    return {
      async decide(): Promise<StrategyAdapterOutcome> {
        return {
          status: 'error',
          code: 'AI_UNAVAILABLE',
          summary: 'Strategy decision failed — AI unavailable.',
          message,
          actions: [],
        }
      },
    }
  }

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

      try {
        const raw = await invokeBedrockConverse(config, context)
        return parseWorkersAiResponse(raw)
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Bedrock request failed.'
        const code =
          message.includes('JSON') || message.includes('schema')
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

export { DEFAULT_BEDROCK_MODEL_ID }
