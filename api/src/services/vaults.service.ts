import type { Address, PublicClient } from 'viem'
import { contracts } from '../constants/contracts.js'
import type { ChainContracts } from '../constants/contracts.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import type {
  ListVaultsResult,
  VaultSummary,
  VaultTrackConfig,
} from '../types/vault.js'
import { vaultTrackRegistryAbi } from './abis/vault-track-registry.js'
import { ProviderService } from './provider.service.js'

export interface VaultsConfig {
  chainId: number
  rpcUrl: string
  vaultTrackRegistryAddress: `0x${string}`
  chainContracts: ChainContracts
}

type VaultCatalogEntry = Pick<
  VaultSummary,
  'id' | 'name' | 'slug' | 'tagline' | 'description'
>

interface OnChainVaultTrackConfig {
  vault: Address
  trackId: bigint
  initialAllocation: bigint
  maxAllocation: bigint
  maxDrawdownBps: bigint
  maxTradeSizeBps: bigint
  maxDailyTurnoverBps: bigint
  maxDailyLossBps: bigint
  evaluationPeriod: bigint
  minTrades: bigint
  promotionScore: bigint
  active: boolean
  maxStopLossBps: bigint
  minTakeProfitBps: bigint
  maxTakeProfitBps: bigint
  requireStopLoss: boolean
  requireTakeProfit: boolean
}

/** Matches VaultTrackRegistry.MAX_TRACK_ID (tracks 0–2). */
const VAULT_TRACK_IDS = [0, 1, 2] as const

/** Static catalog for deployed thematic vaults. */
const KNOWN_VAULT_CATALOG: Record<string, VaultCatalogEntry> = {
  genesis: {
    id: 'genesis',
    name: 'Genesis',
    slug: 'genesis',
    tagline: 'Season 1 Challenge arena',
    description: 'Shared Challenge vault for all agents.',
  },
}

import { DEPLOYED_VAULT_KEYS } from '../constants/deployed-vaults.js'

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

export function loadVaultsConfig(
  env: Record<string, string | undefined> = {}
): VaultsConfig {
  const chainId = Number(requireEnv(env, 'CHAIN_ID'))
  const chainContracts = contracts[chainId]
  if (!chainContracts) {
    throw new Error(`Unsupported CHAIN_ID: ${chainId}`)
  }
  if (!chainContracts.VaultTrackRegistry) {
    throw new Error(
      `VaultTrackRegistry is not deployed for CHAIN_ID: ${chainId}`
    )
  }

  return {
    chainId,
    rpcUrl: requireEnv(env, 'RPC_URL'),
    vaultTrackRegistryAddress: chainContracts.VaultTrackRegistry,
    chainContracts,
  }
}

function catalogEntryForAddress(
  address: Address,
  chainContracts: ChainContracts
): VaultCatalogEntry {
  const normalized = address.toLowerCase()

  for (const [contractKey, catalogKey] of DEPLOYED_VAULT_KEYS) {
    const deployed = chainContracts[contractKey]
    if (deployed?.toLowerCase() === normalized) {
      return KNOWN_VAULT_CATALOG[catalogKey]
    }
  }

  return {
    id: normalized,
    name: `${address.slice(0, 6)}...${address.slice(-4)}`,
    slug: normalized,
    tagline: '',
    description: 'Registered vault (metadata not yet indexed).',
  }
}

function serializeVaultTrackConfig(
  config: OnChainVaultTrackConfig
): VaultTrackConfig {
  return {
    vault: config.vault,
    trackId: Number(config.trackId),
    initialAllocation: config.initialAllocation.toString(),
    maxAllocation: config.maxAllocation.toString(),
    maxDrawdownBps: Number(config.maxDrawdownBps),
    maxTradeSizeBps: Number(config.maxTradeSizeBps),
    maxDailyTurnoverBps: Number(config.maxDailyTurnoverBps),
    maxDailyLossBps: Number(config.maxDailyLossBps),
    evaluationPeriod: config.evaluationPeriod.toString(),
    minTrades: Number(config.minTrades),
    promotionScore: Number(config.promotionScore),
    active: config.active,
    maxStopLossBps: Number(config.maxStopLossBps),
    minTakeProfitBps: Number(config.minTakeProfitBps),
    maxTakeProfitBps: Number(config.maxTakeProfitBps),
    requireStopLoss: config.requireStopLoss,
    requireTakeProfit: config.requireTakeProfit,
  }
}

function toVaultSummary(
  address: Address,
  vaultTrackConfigs: VaultTrackConfig[],
  config: VaultsConfig
): VaultSummary {
  const catalog = catalogEntryForAddress(address, config.chainContracts)

  return {
    ...catalog,
    vaultTrackConfigs,
    chainId: config.chainId,
    contractAddress: address,
  }
}

export class VaultsService {
  private readonly publicClient: PublicClient
  private readonly vaultTrackRegistryAddress: Address

  constructor(private readonly config: VaultsConfig) {
    const providerService = new ProviderService(config.rpcUrl, config.chainId)
    this.publicClient = providerService.createPublicClient()
    this.vaultTrackRegistryAddress = config.vaultTrackRegistryAddress
  }

  static fromEnv(
    env: Record<string, string | undefined> = getWorkerEnv()
  ): VaultsService {
    return new VaultsService(loadVaultsConfig(env))
  }

  private async fetchVaultTrackConfigs(
    vault: Address
  ): Promise<VaultTrackConfig[]> {
    const configs = await Promise.all(
      VAULT_TRACK_IDS.map((trackId) =>
        this.publicClient.readContract({
          address: this.vaultTrackRegistryAddress,
          abi: vaultTrackRegistryAbi,
          functionName: 'getVaultTrackConfig',
          args: [vault, BigInt(trackId)],
        })
      )
    )

    return configs.map((config) => serializeVaultTrackConfig(config))
  }

  /** Returns a single vault by `id`, `slug`, or contract address, or null if unknown. */
  async getVaultById(id: string): Promise<VaultSummary | null> {
    const key = id.toLowerCase()
    const { vaults } = await this.listVaults()
    return (
      vaults.find(
        (vault) =>
          vault.id.toLowerCase() === key ||
          vault.slug.toLowerCase() === key ||
          vault.contractAddress.toLowerCase() === key
      ) ?? null
    )
  }

  /** Returns deployed vaults from chain constants. */
  async listVaults(): Promise<ListVaultsResult> {
    // const count = await this.publicClient.readContract({
    //   address: this.vaultTrackRegistryAddress,
    //   abi: vaultTrackRegistryAbi,
    //   functionName: 'vaultCount',
    // })

    // const addresses = await Promise.all(
    //   Array.from({ length: Number(count) }, (_, index) =>
    //     this.publicClient.readContract({
    //       address: this.vaultTrackRegistryAddress,
    //       abi: vaultTrackRegistryAbi,
    //       functionName: 'vaultAt',
    //       args: [BigInt(index)],
    //     })
    //   )
    // )

    const addresses = DEPLOYED_VAULT_KEYS.map(
      ([contractKey]) => this.config.chainContracts[contractKey]
    ).filter((address): address is Address => address != null)

    const vaults = await Promise.all(
      addresses.map(async (address) => {
        const vaultTrackConfigs = await this.fetchVaultTrackConfigs(address)
        return toVaultSummary(address, vaultTrackConfigs, this.config)
      })
    )

    return {
      vaults,
      total: vaults.length,
    }
  }

  /** Human-readable markdown for LLMs and chat tools that prefer plain text. */
  formatVaultsMarkdown(data: ListVaultsResult): string {
    const lines = ['# AlphaGrid vaults', '', `Total: ${data.total}`, '']

    for (const vault of data.vaults) {
      lines.push(`## ${vault.name} (\`${vault.id}\`)`)
      lines.push('')
      lines.push(`- **Tagline:** ${vault.tagline}`)
      lines.push(`- **Chain ID:** ${vault.chainId}`)
      lines.push(`- **Contract:** \`${vault.contractAddress}\``)
      lines.push('')
      lines.push(vault.description)
      lines.push('')
      for (const track of vault.vaultTrackConfigs) {
        lines.push(
          `### Track ${track.trackId}${track.active ? '' : ' (inactive)'}`
        )
        lines.push('')
        lines.push(
          `- **Initial allocation (atomic):** ${track.initialAllocation}`
        )
        lines.push(`- **Max allocation (atomic):** ${track.maxAllocation}`)
        lines.push(`- **Max drawdown (bps):** ${track.maxDrawdownBps}`)
        lines.push(`- **Max trade size (bps):** ${track.maxTradeSizeBps}`)
        lines.push(
          `- **Max daily turnover (bps):** ${track.maxDailyTurnoverBps}`
        )
        lines.push(`- **Evaluation period (s):** ${track.evaluationPeriod}`)
        lines.push(`- **Min trades:** ${track.minTrades}`)
        lines.push(`- **Promotion score:** ${track.promotionScore}`)
        lines.push('')
      }
    }

    return lines.join('\n').trimEnd()
  }
}
