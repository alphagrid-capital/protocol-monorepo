import type { Address, PublicClient } from 'viem'
import { positionManagerAbi } from '../services/abis/position-manager.js'
import { tradeRouterAbi } from '../services/abis/trade-router.js'
import { catalogEntryForAddress } from './token-catalog.js'

export type AgentTradeActivityType =
  | 'PositionOpened'
  | 'PositionIncreased'
  | 'PositionReduced'
  | 'ExitLadderUpdated'
  | 'ExitExecuted'
  | 'PositionForceClosed'
  | 'PositionClosed'

export type AgentTradeActivitySource = 'TradeRouter' | 'PositionManager'

export interface AgentTradeActivity {
  type: AgentTradeActivityType
  positionId: string
  blockNumber: string
  transactionHash: string
  timestamp: string
  logIndex: number
  source: AgentTradeActivitySource
  vault?: string
  token?: string
  symbol?: string
  usdcIn?: string
  usdcOut?: string
  tokensAdded?: string
  exitBps?: number
  ruleIndex?: number
  nextRuleIndex?: number
  keeper?: string
  keeperBounty?: string
  operator?: string
  realizedPnlUsdc?: string
}

type RawActivity = Omit<AgentTradeActivity, 'timestamp'>

const TRADE_ROUTER_EVENT_NAMES = [
  'PositionOpenedFromIntent',
  'PositionIncreasedFromIntent',
  'PositionReducedFromIntent',
  'PositionExitLadderUpdatedFromIntent',
  'ExitExecuted',
  'PositionForceClosed',
] as const

function mapTradeRouterLog(
  chainId: number,
  log: {
    eventName: (typeof TRADE_ROUTER_EVENT_NAMES)[number]
    args: Record<string, unknown>
    blockNumber: bigint
    transactionHash: string
    logIndex: number
  }
): RawActivity {
  const base = {
    blockNumber: log.blockNumber.toString(),
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
    source: 'TradeRouter' as const,
    positionId: String(log.args.positionId),
  }

  switch (log.eventName) {
    case 'PositionOpenedFromIntent': {
      const token = log.args.token as Address
      const entry = catalogEntryForAddress(chainId, token)
      return {
        ...base,
        type: 'PositionOpened',
        vault: log.args.vault as string,
        token,
        symbol: entry?.symbol,
        usdcIn: (log.args.usdcIn as bigint).toString(),
      }
    }
    case 'PositionIncreasedFromIntent':
      return {
        ...base,
        type: 'PositionIncreased',
        usdcIn: (log.args.usdcIn as bigint).toString(),
        tokensAdded: (log.args.tokensAdded as bigint).toString(),
      }
    case 'PositionReducedFromIntent':
      return {
        ...base,
        type: 'PositionReduced',
        exitBps: Number(log.args.exitBps),
        usdcOut: (log.args.usdcOut as bigint).toString(),
      }
    case 'PositionExitLadderUpdatedFromIntent':
      return {
        ...base,
        type: 'ExitLadderUpdated',
        nextRuleIndex: Number(log.args.nextRuleIndex),
      }
    case 'ExitExecuted':
      return {
        ...base,
        type: 'ExitExecuted',
        ruleIndex: Number(log.args.ruleIndex),
        keeper: log.args.keeper as string,
        usdcOut: (log.args.usdcOut as bigint).toString(),
        keeperBounty: (log.args.keeperBounty as bigint).toString(),
      }
    case 'PositionForceClosed':
      return {
        ...base,
        type: 'PositionForceClosed',
        operator: log.args.operator as string,
        usdcOut: (log.args.usdcOut as bigint).toString(),
      }
  }
}

function mapPositionClosedLog(log: {
  args: Record<string, unknown>
  blockNumber: bigint
  transactionHash: string
  logIndex: number
}): RawActivity {
  return {
    type: 'PositionClosed',
    positionId: String(log.args.positionId),
    blockNumber: log.blockNumber.toString(),
    transactionHash: log.transactionHash,
    logIndex: log.logIndex,
    source: 'PositionManager',
    realizedPnlUsdc: (log.args.realizedPnlUsdc as bigint).toString(),
  }
}

function sortActivitiesNewestFirst(a: RawActivity, b: RawActivity): number {
  const blockDiff = Number(BigInt(b.blockNumber) - BigInt(a.blockNumber))
  if (blockDiff !== 0) {
    return blockDiff
  }
  return b.logIndex - a.logIndex
}

async function attachTimestamps(
  client: PublicClient,
  activities: RawActivity[]
): Promise<AgentTradeActivity[]> {
  const uniqueBlocks = [...new Set(activities.map((item) => item.blockNumber))]
  const timestampByBlock = new Map<string, string>()

  await Promise.all(
    uniqueBlocks.map(async (blockNumber) => {
      const block = await client.getBlock({ blockNumber: BigInt(blockNumber) })
      timestampByBlock.set(blockNumber, block.timestamp.toString())
    })
  )

  return activities.map((activity) => ({
    ...activity,
    timestamp: timestampByBlock.get(activity.blockNumber) ?? '0',
  }))
}

export async function fetchAgentTradeActivity(params: {
  client: PublicClient
  chainId: number
  tradeRouterAddress: Address
  positionManagerAddress: Address | null
  agentId: bigint
  limit: number
}): Promise<AgentTradeActivity[]> {
  const {
    client,
    chainId,
    tradeRouterAddress,
    positionManagerAddress,
    agentId,
    limit,
  } = params

  const routerLogs = await Promise.all(
    TRADE_ROUTER_EVENT_NAMES.map((eventName) =>
      client.getContractEvents({
        address: tradeRouterAddress,
        abi: tradeRouterAbi,
        eventName,
        args: { agentId },
        fromBlock: 0n,
        toBlock: 'latest',
      })
    )
  )

  const activities: RawActivity[] = routerLogs.flatMap((logs, index) =>
    logs.map((log) =>
      mapTradeRouterLog(chainId, {
        eventName: TRADE_ROUTER_EVENT_NAMES[index]!,
        args: log.args as Record<string, unknown>,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
      })
    )
  )

  if (positionManagerAddress) {
    const closedLogs = await client.getContractEvents({
      address: positionManagerAddress,
      abi: positionManagerAbi,
      eventName: 'PositionClosed',
      args: { agentId },
      fromBlock: 0n,
      toBlock: 'latest',
    })

    for (const log of closedLogs) {
      activities.push(
        mapPositionClosedLog({
          args: log.args as Record<string, unknown>,
          blockNumber: log.blockNumber,
          transactionHash: log.transactionHash,
          logIndex: log.logIndex,
        })
      )
    }
  }

  activities.sort(sortActivitiesNewestFirst)
  return attachTimestamps(client, activities.slice(0, limit))
}
