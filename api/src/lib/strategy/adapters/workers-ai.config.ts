import type { WorkerEnv } from '../../../types/worker-env.js'

export const DEFAULT_STRATEGY_AI_MODEL =
  'workers-ai/@cf/meta/llama-3.1-8b-instruct'
export const DEFAULT_STRATEGY_AI_GATEWAY_ID = 'alphagrid-ai-gateway'
export const DEFAULT_STRATEGY_AI_MAX_TOKENS = 512

export interface WorkersAiConfig {
  model: string
  gatewayId: string
  maxTokens: number
}

function parseMaxTokens(env: WorkerEnv): number {
  const raw = env.STRATEGY_AI_MAX_TOKENS
  if (!raw) {
    return DEFAULT_STRATEGY_AI_MAX_TOKENS
  }
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid STRATEGY_AI_MAX_TOKENS: ${raw}`)
  }
  return parsed
}

export function loadWorkersAiConfig(
  env: WorkerEnv = {}
): WorkersAiConfig {
  return {
    model: env.STRATEGY_AI_MODEL?.trim() || DEFAULT_STRATEGY_AI_MODEL,
    gatewayId:
      env.STRATEGY_AI_GATEWAY_ID?.trim() || DEFAULT_STRATEGY_AI_GATEWAY_ID,
    maxTokens: parseMaxTokens(env),
  }
}
