import type { Address } from 'viem'
import catalogJson from '../contracts/token-catalog.json'

export interface TokenCatalogEntry {
  symbol: string
  finnhubSymbol?: string
}

export interface TokenCatalogFile {
  version: number
  tokens: TokenCatalogEntry[]
  chains: Record<
    string,
    {
      tokens: Record<string, string | null>
    }
  >
}

export const tokenCatalog = catalogJson as TokenCatalogFile

export function chainTokenAddress(
  chainId: number,
  symbol: string
): Address | null {
  const addr = tokenCatalog.chains[String(chainId)]?.tokens?.[symbol]
  if (!addr) {
    return null
  }
  return addr as Address
}

export function catalogEntryForAddress(
  chainId: number,
  address: Address
): TokenCatalogEntry | null {
  const chainTokens = tokenCatalog.chains[String(chainId)]?.tokens ?? {}
  const normalized = address.toLowerCase()
  for (const entry of tokenCatalog.tokens) {
    const tokenAddress = chainTokens[entry.symbol]
    if (tokenAddress?.toLowerCase() === normalized) {
      return entry
    }
  }
  return null
}

export function finnhubSymbolFor(entry: TokenCatalogEntry): string {
  return entry.finnhubSymbol ?? entry.symbol
}
