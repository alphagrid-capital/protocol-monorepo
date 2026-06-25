import type { StrategyAdapterOutcome } from '../../../schemas/strategy-adapter.js'
import type { StrategyContext } from '../decision.js'

export interface StrategyDecisionAdapter {
  decide(context: StrategyContext): Promise<StrategyAdapterOutcome>
}
