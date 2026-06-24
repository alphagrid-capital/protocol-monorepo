import type { Address, PublicClient } from 'viem'
import { positionManagerAbi } from '../../services/abis/position-manager.js'
import { tradeRouterAbi } from '../../services/abis/trade-router.js'
import {
  fetchInAdaptiveBlockRange,
  logScanWindow,
  MAX_CONSECUTIVE_EMPTY_LOG_CHUNKS,
  MAX_LOG_BLOCK_RANGE,
  MAX_LOG_SCAN_CHUNKS,
  sortActivitiesNewestFirst,
} from '../trading/trade-log-scan.js'
import { catalogEntryForAddress } from '../tokens/catalog.js'

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

async function fetchTradeRouterActivitiesInRange(params: {
  client: PublicClient
  chainId: number
  tradeRouterAddress: Address
  agentId: bigint
  fromBlock: bigint
  toBlock: bigint
}): Promise<RawActivity[]> {
  const { client, chainId, tradeRouterAddress, agentId, fromBlock, toBlock } =
    params

  const routerLogs = await Promise.all(
    TRADE_ROUTER_EVENT_NAMES.map((eventName) =>
      fetchInAdaptiveBlockRange({
        fromBlock,
        toBlock,
        fetch: (rangeFrom, rangeTo) =>
          client.getContractEvents({
            address: tradeRouterAddress,
            abi: tradeRouterAbi,
            eventName,
            args: { agentId },
            fromBlock: rangeFrom,
            toBlock: rangeTo,
          }),
      })
    )
  )

  return routerLogs.flatMap((logs, index) =>
    logs.map((log) =>
      mapTradeRouterLog(chainId, {
        eventName: TRADE_ROUTER_EVENT_NAMES[index],
        args: log.args,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash,
        logIndex: log.logIndex,
      })
    )
  )
}

async function fetchPositionClosedInRange(params: {
  client: PublicClient
  positionManagerAddress: Address
  agentId: bigint
  fromBlock: bigint
  toBlock: bigint
}): Promise<RawActivity[]> {
  const { client, positionManagerAddress, agentId, fromBlock, toBlock } = params

  const closedLogs = await fetchInAdaptiveBlockRange({
    fromBlock,
    toBlock,
    fetch: (rangeFrom, rangeTo) =>
      client.getContractEvents({
        address: positionManagerAddress,
        abi: positionManagerAbi,
        eventName: 'PositionClosed',
        args: { agentId },
        fromBlock: rangeFrom,
        toBlock: rangeTo,
      }),
  })

  return closedLogs.map((log) =>
    mapPositionClosedLog({
      args: log.args,
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
      logIndex: log.logIndex,
    })
  )
}

async function scanActivitiesBackwards(params: {
  client: PublicClient
  chainId: number
  tradeRouterAddress: Address
  positionManagerAddress: Address | null
  agentId: bigint
  limit: number
  minScanBlock?: bigint
}): Promise<RawActivity[]> {
  const {
    client,
    chainId,
    tradeRouterAddress,
    positionManagerAddress,
    agentId,
    limit,
    minScanBlock = 0n,
  } = params

  const latestBlock = await client.getBlockNumber()
  const activities: RawActivity[] = []
  let toBlock = latestBlock
  let chunks = 0
  let emptyChunks = 0

  while (toBlock >= minScanBlock && chunks < MAX_LOG_SCAN_CHUNKS) {
    const { fromBlock } = logScanWindow(
      toBlock,
      MAX_LOG_BLOCK_RANGE,
      minScanBlock
    )

    const [routerBatch, closedBatch] = await Promise.all([
      fetchTradeRouterActivitiesInRange({
        client,
        chainId,
        tradeRouterAddress,
        agentId,
        fromBlock,
        toBlock,
      }),
      positionManagerAddress
        ? fetchPositionClosedInRange({
            client,
            positionManagerAddress,
            agentId,
            fromBlock,
            toBlock,
          })
        : Promise.resolve([]),
    ])

    const batch = [...routerBatch, ...closedBatch]
    if (batch.length === 0) {
      emptyChunks++
      if (
        activities.length === 0 &&
        emptyChunks >= MAX_CONSECUTIVE_EMPTY_LOG_CHUNKS
      ) {
        break
      }
    } else {
      emptyChunks = 0
      activities.push(...batch)
      activities.sort(sortActivitiesNewestFirst)
      if (activities.length >= limit) {
        break
      }
    }

    if (fromBlock <= minScanBlock) {
      break
    }

    toBlock = fromBlock - 1n
    chunks++
  }

  activities.sort(sortActivitiesNewestFirst)
  return activities.slice(0, limit)
}

export async function fetchAgentTradeActivity(params: {
  client: PublicClient
  chainId: number
  tradeRouterAddress: Address
  positionManagerAddress: Address | null
  agentId: bigint
  limit: number
  minScanBlock?: bigint
}): Promise<AgentTradeActivity[]> {
  const activities = await scanActivitiesBackwards(params)
  return attachTimestamps(params.client, activities)
}
