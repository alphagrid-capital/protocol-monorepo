import type { AgentTradeActivity } from '../lib/agent-trade-events.js'
import {
  positionReturnBps,
  positionTotalPnlUsdc,
} from '../lib/trading-metrics.js'
import type {
  GetAgentPositionResponse,
  ListAgentPositionsResponse,
} from '../schemas/trading.js'

type GraphExitRule = {
  index: number
  triggerType: string
  triggerBps: string
  exitBps: number
}

type GraphActivity = {
  type: string
  position: { id: string }
  blockNumber: string
  blockTimestamp: string
  transactionHash: string
  logIndex: number
  source: string
  vault?: string | null
  token?: string | null
  symbol?: string | null
  usdcIn?: string | null
  usdcOut?: string | null
  tokensAdded?: string | null
  exitBps?: number | null
  ruleIndex?: number | null
  nextRuleIndex?: number | null
  keeper?: string | null
  keeperBounty?: string | null
  operator?: string | null
  realizedPnlUsdc?: string | null
}

type GraphClosedPosition = {
  id: string
  agent: { id: string }
  symbol: string
  token: string
  vault: string
  tokenAmount: string
  entryPriceUsdc: string
  usdcCostBasis: string
  maxSlippageBps: number
  status: string
  nextRuleIndex: number
  exitRules: GraphExitRule[]
  openedAt: string
  realizedPnlUsdc?: string | null
}

function optionalString(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) {
    return undefined
  }
  return value
}

function mapExitRule(rule: GraphExitRule) {
  return {
    triggerType: rule.triggerType as 'StopLoss' | 'TakeProfit',
    triggerBps: Number(rule.triggerBps),
    exitBps: rule.exitBps,
  }
}

export function mapSubgraphActivity(
  activity: GraphActivity
): AgentTradeActivity {
  return {
    type: activity.type as AgentTradeActivity['type'],
    positionId: activity.position.id,
    blockNumber: activity.blockNumber,
    transactionHash: activity.transactionHash,
    timestamp: activity.blockTimestamp,
    logIndex: activity.logIndex,
    source: activity.source as AgentTradeActivity['source'],
    ...(optionalString(activity.vault) ? { vault: activity.vault! } : {}),
    ...(optionalString(activity.token) ? { token: activity.token! } : {}),
    ...(optionalString(activity.symbol) ? { symbol: activity.symbol! } : {}),
    ...(optionalString(activity.usdcIn) ? { usdcIn: activity.usdcIn! } : {}),
    ...(optionalString(activity.usdcOut) ? { usdcOut: activity.usdcOut! } : {}),
    ...(optionalString(activity.tokensAdded)
      ? { tokensAdded: activity.tokensAdded! }
      : {}),
    ...(activity.exitBps != null ? { exitBps: activity.exitBps } : {}),
    ...(activity.ruleIndex != null ? { ruleIndex: activity.ruleIndex } : {}),
    ...(activity.nextRuleIndex != null
      ? { nextRuleIndex: activity.nextRuleIndex }
      : {}),
    ...(optionalString(activity.keeper) ? { keeper: activity.keeper! } : {}),
    ...(optionalString(activity.keeperBounty)
      ? { keeperBounty: activity.keeperBounty! }
      : {}),
    ...(optionalString(activity.operator)
      ? { operator: activity.operator! }
      : {}),
    ...(optionalString(activity.realizedPnlUsdc)
      ? { realizedPnlUsdc: activity.realizedPnlUsdc! }
      : {}),
  }
}

export function mapSubgraphClosedPosition(
  agentIdStr: string,
  position: GraphClosedPosition
): GetAgentPositionResponse['position'] {
  const mappedRules = position.exitRules
    .slice()
    .sort((a, b) => a.index - b.index)
    .map(mapExitRule)
  const costBasis = BigInt(position.usdcCostBasis)
  const realizedBigint = position.realizedPnlUsdc
    ? BigInt(position.realizedPnlUsdc)
    : 0n
  const totalPnl = positionTotalPnlUsdc(false, undefined, realizedBigint)

  return {
    positionId: position.id,
    agentId: agentIdStr,
    symbol: position.symbol,
    token: position.token,
    vault: position.vault,
    tokenAmount: position.tokenAmount,
    entryPriceUsdc: position.entryPriceUsdc,
    usdcCostBasis: position.usdcCostBasis,
    maxSlippageBps: position.maxSlippageBps,
    status: 'Closed',
    nextRuleIndex: position.nextRuleIndex,
    exitRules: mappedRules,
    pendingRules: mappedRules.slice(position.nextRuleIndex),
    openedAt: position.openedAt,
    realizedPnlUsdc: realizedBigint.toString(),
    derived: {
      totalPnlUsdc: totalPnl.toString(),
      returnBps: positionReturnBps(costBasis, totalPnl),
    },
  }
}

export function mapSubgraphClosedPositions(
  agentIdStr: string,
  positions: GraphClosedPosition[]
): ListAgentPositionsResponse['positions'] {
  return positions.map((position) =>
    mapSubgraphClosedPosition(agentIdStr, position)
  )
}

export type SubgraphActivitiesResult = {
  indexedThroughBlock: string | null
  activities: GraphActivity[]
}

export type SubgraphClosedPositionsResult = {
  positions: GraphClosedPosition[]
}
