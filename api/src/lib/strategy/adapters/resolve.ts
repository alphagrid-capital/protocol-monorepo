import type { WorkerEnv } from '../../../types/worker-env.js'
import { noneStrategyDecisionAdapter } from './none.js'
import type { StrategyDecisionAdapter } from './types.js'

export type StrategyDecisionProvider = 'none'

const PROVIDERS: Record<StrategyDecisionProvider, StrategyDecisionAdapter> = {
  none: noneStrategyDecisionAdapter,
}

function parseProvider(env: WorkerEnv): StrategyDecisionProvider {
  const raw = String(env.STRATEGY_DECISION_PROVIDER ?? 'none').toLowerCase()
  if (raw in PROVIDERS) {
    return raw as StrategyDecisionProvider
  }
  throw new Error(`Unknown STRATEGY_DECISION_PROVIDER: ${raw}`)
}

export function resolveStrategyDecisionAdapter(
  env: WorkerEnv = {}
): StrategyDecisionAdapter {
  return PROVIDERS[parseProvider(env)]
}
