import type { WorkerEnvWithAi } from '../../../types/worker-env.js'
import { noneStrategyDecisionAdapter } from './none.js'
import type { StrategyDecisionAdapter } from './types.js'
import { createWorkersAiAdapter } from './workers-ai.js'

export type StrategyDecisionProvider = 'none' | 'workers-ai'

function parseProvider(env: WorkerEnvWithAi): StrategyDecisionProvider {
  const raw = String(env.STRATEGY_DECISION_PROVIDER ?? 'none').toLowerCase()
  if (raw === 'none' || raw === 'workers-ai') {
    return raw
  }
  throw new Error(`Unknown STRATEGY_DECISION_PROVIDER: ${raw}`)
}

export function resolveStrategyDecisionAdapter(
  env: WorkerEnvWithAi = {}
): StrategyDecisionAdapter {
  const provider = parseProvider(env)
  if (provider === 'workers-ai') {
    return createWorkersAiAdapter(env)
  }
  return noneStrategyDecisionAdapter
}
