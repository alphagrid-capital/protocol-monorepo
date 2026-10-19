import type { WorkerEnvWithAi } from '../../../types/worker-env.js'
import { createBedrockAdapter } from './bedrock.js'
import { parseStrategyDecisionProvider } from './decision-meta.js'
import { noneStrategyDecisionAdapter } from './none.js'
import type { StrategyDecisionAdapter } from './types.js'
import { createWorkersAiAdapter } from './workers-ai.js'

export type {
  StrategyDecisionMeta,
  StrategyDecisionProvider,
} from './decision-meta.js'
export { resolveStrategyDecisionMeta } from './decision-meta.js'

export function resolveStrategyDecisionAdapter(
  env: WorkerEnvWithAi = {}
): StrategyDecisionAdapter {
  const provider = parseStrategyDecisionProvider(env)
  if (provider === 'workers-ai') {
    return createWorkersAiAdapter(env)
  }
  if (provider === 'bedrock') {
    return createBedrockAdapter(env)
  }
  return noneStrategyDecisionAdapter
}
