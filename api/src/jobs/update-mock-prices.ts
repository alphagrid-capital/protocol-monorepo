import type { Address, Hex } from 'viem'
import { contracts } from '../constants/contracts.js'
import { tokenCatalog, finnhubSymbolFor } from '../lib/token-catalog.js'
import { mockPriceOracleAbi } from '../services/abis/mock-price-oracle.js'
import { ProviderService } from '../services/provider.service.js'

const FEED_DECIMALS = 8

export interface UpdateMockPricesEnv {
  CHAIN_ID?: string
  RPC_URL?: string
  FINNHUB_API_KEY?: string
  ORACLE_KEEPER_PRIVATE_KEY?: string
}

function usdToFeedPrice(usd: number): bigint {
  return BigInt(Math.round(usd * 10 ** FEED_DECIMALS))
}

async function fetchFinnhubQuote(
  symbol: string,
  apiKey: string
): Promise<number | null> {
  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) {
    return null
  }
  const body: unknown = await res.json()
  if (
    typeof body !== 'object' ||
    body === null ||
    !('c' in body) ||
    typeof body.c !== 'number' ||
    body.c <= 0
  ) {
    return null
  }
  return body.c
}

export interface UpdateMockPricesResult {
  updated: number
  skipped: boolean
  reason?: string
  transactionHash?: string
}

export async function updateMockPrices(
  env: UpdateMockPricesEnv
): Promise<UpdateMockPricesResult> {
  if (!env.CHAIN_ID || !env.RPC_URL) {
    return { updated: 0, skipped: true, reason: 'CHAIN_ID or RPC_URL not set' }
  }
  if (!env.ORACLE_KEEPER_PRIVATE_KEY) {
    return {
      updated: 0,
      skipped: true,
      reason: 'ORACLE_KEEPER_PRIVATE_KEY not set',
    }
  }
  if (!env.FINNHUB_API_KEY) {
    return { updated: 0, skipped: true, reason: 'FINNHUB_API_KEY not set' }
  }

  const chainId = Number(env.CHAIN_ID)
  const chainContracts = contracts[chainId]
  const oracleAddress = chainContracts?.PriceOracle
  if (!oracleAddress) {
    return { updated: 0, skipped: true, reason: 'PriceOracle not configured' }
  }

  const chainKey = String(chainId)
  const chainTokens = tokenCatalog.chains[chainKey]?.tokens ?? {}
  const assets: Address[] = []
  const prices: bigint[] = []

  for (const entry of tokenCatalog.tokens) {
    const address = chainTokens[entry.symbol]
    if (!address) {
      continue
    }
    const quote = await fetchFinnhubQuote(
      finnhubSymbolFor(entry),
      env.FINNHUB_API_KEY
    )
    if (quote === null) {
      continue
    }
    assets.push(address as Address)
    prices.push(usdToFeedPrice(quote))
  }

  if (assets.length === 0) {
    return { updated: 0, skipped: true, reason: 'no token addresses or quotes' }
  }

  const provider = new ProviderService(env.RPC_URL, chainId)
  const publicClient = provider.createPublicClient()
  const walletClient = provider.createWalletClient(
    env.ORACLE_KEEPER_PRIVATE_KEY as Hex
  )

  const hash = await walletClient.writeContract({
    address: oracleAddress,
    abi: mockPriceOracleAbi,
    functionName: 'setPrices',
    args: [assets, prices],
  })

  await publicClient.waitForTransactionReceipt({ hash })

  return { updated: assets.length, skipped: false, transactionHash: hash }
}
