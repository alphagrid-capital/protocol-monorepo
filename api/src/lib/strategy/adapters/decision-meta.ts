import type { WorkerEnvWithAi } from '../../../types/worker-env.js'

export type StrategyDecisionProvider = 'none' | 'workers-ai' | 'bedrock'

export interface StrategyDecisionMeta {
  provider: StrategyDecisionProvider
  modelId: string | null
}

const DEFAULT_WORKERS_AI_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast'
const DEFAULT_BEDROCK_MODEL_ID = 'eu.amazon.nova-lite-v1:0'

export function parseStrategyDecisionProvider(
  env: WorkerEnvWithAi
): StrategyDecisionProvider {
  const raw = String(
    env.STRATEGY_DECISION_PROVIDER ?? 'workers-ai'
  ).toLowerCase()
  if (raw === 'none' || raw === 'workers-ai' || raw === 'bedrock') {
    return raw
  }
  throw new Error(`Unknown STRATEGY_DECISION_PROVIDER: ${raw}`)
}

function workersAiModelId(env: WorkerEnvWithAi): string {
  const raw = env.CF_WORKERS_MODEL_ID?.trim() || DEFAULT_WORKERS_AI_MODEL
  return raw.replace(/^workers-ai\//, '')
}

function bedrockModelId(env: WorkerEnvWithAi): string {
  return env.BEDROCK_MODEL_ID?.trim() || DEFAULT_BEDROCK_MODEL_ID
}

/** Provider + model id used for a run (for persistence / API), without invoking AI. */
export function resolveStrategyDecisionMeta(
  env: WorkerEnvWithAi = {}
): StrategyDecisionMeta {
  const provider = parseStrategyDecisionProvider(env)
  if (provider === 'workers-ai') {
    return { provider, modelId: workersAiModelId(env) }
  }
  if (provider === 'bedrock') {
    return { provider, modelId: bedrockModelId(env) }
  }
  return { provider: 'none', modelId: null }
}
