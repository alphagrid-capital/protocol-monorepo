/** Summary stats for a thematic ERC-4626 vault (mock data until indexer is wired). */
export interface VaultSummary {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  tvlUsd: number;
  tvlChange24hPct: number;
  agentCount: number;
  returnYtdPct: number;
  chainId: number;
  contractAddress: string;
}

export interface ListVaultsResult {
  vaults: VaultSummary[];
  total: number;
}
