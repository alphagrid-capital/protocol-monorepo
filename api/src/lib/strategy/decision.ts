import type { BotFrequency } from '../../schemas/agent-draft.js'
import type {
  AgentRiskStateResponse,
  ListAgentPositionsResponse,
  TradeIntentQuote,
} from '../../schemas/trading.js'
import type { StrategyDecision } from '../../schemas/strategy.js'
import type { OraclePriceEntry } from '../../services/tokens.service.js'
import type { WorkerEnv } from '../../types/worker-env.js'
import { resolveStrategyDecisionAdapter } from './adapters/resolve.js'

export type {
  StrategyAction,
  StrategyDecision,
} from '../../schemas/strategy.js'

export interface StrategyGuardrails {
  allowedSymbols: TradeIntentQuote['allowedSymbols']
  allocation: TradeIntentQuote['allocation']
  exitBounds: TradeIntentQuote['exitBounds']
  accountRiskBounds: TradeIntentQuote['accountRiskBounds']
  dailyRealizedPnlUsdc: TradeIntentQuote['dailyRealizedPnlUsdc']
  breaches: AgentRiskStateResponse['breaches']
  defaultExit: TradeIntentQuote['defaultExit']
  usdcDecimals: number
}

export interface StrategyContext {
  agentId: string
  strategy: string
  botFrequency: BotFrequency
  prices: Record<string, OraclePriceEntry>
  positions: ListAgentPositionsResponse['positions']
  risk: AgentRiskStateResponse
  guardrails: StrategyGuardrails
}

/** Example input: `api/src/lib/strategy/context.example.json` */

export async function decideStrategy(
  context: StrategyContext,
  env?: WorkerEnv
): Promise<StrategyDecision> {
  const adapter = resolveStrategyDecisionAdapter(env)
  return adapter.decide(context)
}
