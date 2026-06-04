import type { Address, PublicClient } from 'viem'
import { erc20Abi } from 'viem'
import { contracts } from '../constants/contracts.js'
import type { ChainContracts } from '../constants/contracts.js'
import { DEPLOYED_VAULT_KEYS } from '../constants/deployed-vaults.js'
import {
  catalogEntryForAddress,
  chainTokenAddress,
  tokenCatalog,
} from '../lib/token-catalog.js'
import type { TokenCatalogEntry } from '../lib/token-catalog.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import { mandateVaultAbi } from './abis/mandate-vault.js'
import { mockPriceOracleAbi } from './abis/mock-price-oracle.js'
import { tokenRegistryAbi } from './abis/token-registry.js'
import { ProviderService } from './provider.service.js'
import { VaultsService } from './vaults.service.js'

export interface TokenPrice {
  priceUsd: string | null
  updatedAt: string | null
  stale: boolean
}

export interface OraclePriceEntry {
  symbol: string
  address: string | null
  priceUsd: string | null
  updatedAt: string | null
  quoted: boolean
}

export interface TokenSummary {
  symbol: string
  name: string
  address: string | null
  decimals: number
  vaultIds: string[]
  listed: boolean
  active: boolean
  allowedInVault?: boolean
  price?: TokenPrice
}

export interface TokensConfig {
  chainId: number
  rpcUrl: string
  chainContracts: ChainContracts
}

const FEED_DECIMALS = 8

function requireEnv(
  env: Record<string, string | undefined>,
  key: 'CHAIN_ID' | 'RPC_URL'
): string {
  const value = env[key]
  if (!value) {
    throw new Error(`${key} is not configured`)
  }
  return value
}

export function loadTokensConfig(
  env: Record<string, string | undefined> = {}
): TokensConfig {
  const chainId = Number(requireEnv(env, 'CHAIN_ID'))
  const chainContracts = contracts[chainId]
  if (!chainContracts) {
    throw new Error(`Unsupported CHAIN_ID: ${chainId}`)
  }
  return {
    chainId,
    rpcUrl: requireEnv(env, 'RPC_URL'),
    chainContracts,
  }
}

function formatPriceUsd(answer: bigint): string {
  const whole = answer / 10n ** BigInt(FEED_DECIMALS)
  const frac = answer % 10n ** BigInt(FEED_DECIMALS)
  if (frac === 0n) {
    return whole.toString()
  }
  const fracStr = frac
    .toString()
    .padStart(FEED_DECIMALS, '0')
    .replace(/0+$/, '')
  return `${whole}.${fracStr}`
}

export class TokensService {
  private readonly publicClient: PublicClient
  private readonly config: TokensConfig

  constructor(config: TokensConfig) {
    const provider = new ProviderService(config.rpcUrl, config.chainId)
    this.publicClient = provider.createPublicClient()
    this.config = config
  }

  static fromEnv(
    env: Record<string, string | undefined> = getWorkerEnv()
  ): TokensService {
    return new TokensService(loadTokensConfig(env))
  }

  private priceOracleAddress(): Address | null {
    return this.config.chainContracts.PriceOracle
  }

  private async loadVaultIdsByToken(): Promise<Map<string, string[]>> {
    const vaultIdsByToken = new Map<string, string[]>()

    await Promise.all(
      DEPLOYED_VAULT_KEYS.map(async ([contractKey, slug]) => {
        const vaultAddress = this.config.chainContracts[contractKey]
        if (!vaultAddress) {
          return
        }

        const allowed = await this.getVaultAllowedTokens(vaultAddress)
        for (const token of allowed) {
          const key = token.toLowerCase()
          const slugs = vaultIdsByToken.get(key) ?? []
          slugs.push(slug)
          vaultIdsByToken.set(key, slugs)
        }
      })
    )

    return vaultIdsByToken
  }

  private async getVaultAllowedTokens(vault: Address): Promise<Address[]> {
    const count = await this.publicClient.readContract({
      address: vault,
      abi: mandateVaultAbi,
      functionName: 'allowedTokenCount',
    })

    if (count === 0n) {
      return []
    }

    return Promise.all(
      Array.from({ length: Number(count) }, (_, index) =>
        this.publicClient.readContract({
          address: vault,
          abi: mandateVaultAbi,
          functionName: 'allowedTokenAt',
          args: [BigInt(index)],
        })
      )
    )
  }

  private async readOnChainPrice(
    tokenAddress: Address,
    maxPriceAgeSec: bigint
  ): Promise<TokenPrice | undefined> {
    const oracle = this.priceOracleAddress()
    if (!oracle) {
      return undefined
    }

    try {
      const [, answer, , updatedAt] = await this.publicClient.readContract({
        address: oracle,
        abi: mockPriceOracleAbi,
        functionName: 'latestRoundData',
        args: [tokenAddress],
      })
      if (answer <= 0n) {
        return { priceUsd: null, updatedAt: null, stale: true }
      }
      const now = BigInt(Math.floor(Date.now() / 1000))
      const stale = maxPriceAgeSec > 0n && now - updatedAt > maxPriceAgeSec
      return {
        priceUsd: formatPriceUsd(answer),
        updatedAt: updatedAt.toString(),
        stale,
      }
    } catch {
      return undefined
    }
  }

  private async registryState(
    tokenAddress: Address
  ): Promise<{ listed: boolean; active: boolean }> {
    const registry = this.config.chainContracts.TokenRegistry
    if (!registry) {
      return { listed: false, active: false }
    }

    const [listed, active] = await Promise.all([
      this.publicClient.readContract({
        address: registry,
        abi: tokenRegistryAbi,
        functionName: 'isTokenListed',
        args: [tokenAddress],
      }),
      this.publicClient.readContract({
        address: registry,
        abi: tokenRegistryAbi,
        functionName: 'isTokenActive',
        args: [tokenAddress],
      }),
    ])
    return { listed, active }
  }

  private async isAllowedOnVault(
    vaultAddress: Address,
    tokenAddress: Address
  ): Promise<boolean> {
    return this.publicClient.readContract({
      address: vaultAddress,
      abi: mandateVaultAbi,
      functionName: 'isAllowedToken',
      args: [tokenAddress],
    })
  }

  private async enrichEntry(
    entry: TokenCatalogEntry,
    options?: {
      vaultAddress?: Address
      maxPriceAgeSec?: bigint
      vaultIds?: string[]
    }
  ): Promise<TokenSummary> {
    const address = chainTokenAddress(this.config.chainId, entry.symbol)
    const base: TokenSummary = {
      symbol: entry.symbol,
      name: entry.symbol,
      address,
      decimals: 18,
      vaultIds: options?.vaultIds ?? [],
      listed: false,
      active: false,
    }

    if (!address) {
      return base
    }

    if (options?.vaultIds) {
      base.vaultIds = options.vaultIds
    } else {
      const vaultIdsByToken = await this.loadVaultIdsByToken()
      base.vaultIds = vaultIdsByToken.get(address.toLowerCase()) ?? []
    }

    const [registry, onChainSymbol, onChainName, onChainDecimals] =
      await Promise.all([
        this.registryState(address),
        this.publicClient
          .readContract({
            address,
            abi: erc20Abi,
            functionName: 'symbol',
          })
          .catch(() => entry.symbol),
        this.publicClient
          .readContract({
            address,
            abi: erc20Abi,
            functionName: 'name',
          })
          .catch(() => entry.symbol),
        this.publicClient
          .readContract({
            address,
            abi: erc20Abi,
            functionName: 'decimals',
          })
          .catch(() => 18),
      ])

    base.listed = registry.listed
    base.active = registry.active
    base.symbol = onChainSymbol
    base.name = onChainName
    base.decimals = onChainDecimals

    if (options?.vaultAddress) {
      base.allowedInVault = await this.isAllowedOnVault(
        options.vaultAddress,
        address
      )
    }

    const maxAge = options?.maxPriceAgeSec ?? 0n
    const price = await this.readOnChainPrice(address, maxAge)
    if (price) {
      base.price = price
    }

    return base
  }

  private async enrichAddress(
    address: Address,
    options: {
      vaultAddress: Address
      maxPriceAgeSec: bigint
      vaultIds?: string[]
    }
  ): Promise<TokenSummary | null> {
    const catalogEntry = catalogEntryForAddress(this.config.chainId, address)
    if (catalogEntry) {
      return this.enrichEntry(catalogEntry, options)
    }

    const [onChainSymbol, onChainName, onChainDecimals, registry] =
      await Promise.all([
        this.publicClient
          .readContract({
            address,
            abi: erc20Abi,
            functionName: 'symbol',
          })
          .catch(() => null),
        this.publicClient
          .readContract({
            address,
            abi: erc20Abi,
            functionName: 'name',
          })
          .catch(() => null),
        this.publicClient
          .readContract({
            address,
            abi: erc20Abi,
            functionName: 'decimals',
          })
          .catch(() => 18),
        this.registryState(address),
      ])

    if (!onChainSymbol) {
      return null
    }

    const vaultIds =
      options.vaultIds ??
      (await this.loadVaultIdsByToken()).get(address.toLowerCase()) ??
      []

    const summary: TokenSummary = {
      symbol: onChainSymbol,
      name: onChainName ?? onChainSymbol,
      address,
      decimals: onChainDecimals,
      vaultIds,
      listed: registry.listed,
      active: registry.active,
      allowedInVault: await this.isAllowedOnVault(
        options.vaultAddress,
        address
      ),
    }

    const price = await this.readOnChainPrice(address, options.maxPriceAgeSec)
    if (price) {
      summary.price = price
    }

    return summary
  }

  async listTokens(): Promise<{
    chainId: number
    priceOracle: string | null
    tokens: TokenSummary[]
    total: number
  }> {
    const vaultIdsByToken = await this.loadVaultIdsByToken()
    const tokens = await Promise.all(
      tokenCatalog.tokens.map((entry) => {
        const address = chainTokenAddress(this.config.chainId, entry.symbol)
        const vaultIds = address
          ? (vaultIdsByToken.get(address.toLowerCase()) ?? [])
          : []
        return this.enrichEntry(entry, { vaultIds })
      })
    )
    return {
      chainId: this.config.chainId,
      priceOracle: this.priceOracleAddress(),
      tokens,
      total: tokens.length,
    }
  }

  async listVaultTokens(vaultId: string): Promise<{
    vaultId: string
    chainId: number
    priceOracle: string | null
    tokens: TokenSummary[]
    total: number
  } | null> {
    const vaults = VaultsService.fromEnv(getWorkerEnv())
    const vault = await vaults.getVaultById(vaultId)
    if (!vault) {
      return null
    }

    const vaultAddress = vault.contractAddress as Address
    let maxPriceAgeSec = 0n
    try {
      maxPriceAgeSec = await this.publicClient.readContract({
        address: vaultAddress,
        abi: mandateVaultAbi,
        functionName: 'maxPriceAge',
      })
    } catch {
      maxPriceAgeSec = 0n
    }

    const [allowedAddresses, vaultIdsByToken] = await Promise.all([
      this.getVaultAllowedTokens(vaultAddress),
      this.loadVaultIdsByToken(),
    ])

    const tokens = (
      await Promise.all(
        allowedAddresses.map((address) =>
          this.enrichAddress(address, {
            vaultAddress,
            maxPriceAgeSec,
            vaultIds: vaultIdsByToken.get(address.toLowerCase()) ?? [
              vault.slug,
            ],
          })
        )
      )
    ).filter((token): token is TokenSummary => token !== null)

    return {
      vaultId: vault.slug,
      chainId: this.config.chainId,
      priceOracle: this.priceOracleAddress(),
      tokens,
      total: tokens.length,
    }
  }

  async getOraclePrices(): Promise<{
    chainId: number
    priceOracle: string | null
    prices: Record<string, OraclePriceEntry>
  }> {
    const oracle = this.priceOracleAddress()
    const prices: Record<string, OraclePriceEntry> = {}

    const reads = tokenCatalog.tokens.map(async (entry) => {
      const address = chainTokenAddress(this.config.chainId, entry.symbol)
      const base: OraclePriceEntry = {
        symbol: entry.symbol,
        address,
        priceUsd: null,
        updatedAt: null,
        quoted: false,
      }

      if (!address || !oracle) {
        return [entry.symbol, base] as const
      }

      try {
        const [, answer, , updatedAt] = await this.publicClient.readContract({
          address: oracle,
          abi: mockPriceOracleAbi,
          functionName: 'latestRoundData',
          args: [address],
        })
        if (answer > 0n) {
          base.priceUsd = formatPriceUsd(answer)
          base.updatedAt = updatedAt.toString()
          base.quoted = true
        }
      } catch {
        // TokenNotQuoted or RPC error — leave quoted false
      }

      return [entry.symbol, base] as const
    })

    for (const [symbol, entry] of await Promise.all(reads)) {
      prices[symbol] = entry
    }

    return {
      chainId: this.config.chainId,
      priceOracle: oracle,
      prices,
    }
  }
}
