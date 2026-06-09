/** Per-vault track policy from VaultTrackRegistry (uint256 values as decimal strings). */
export interface VaultTrackConfig {
  vault: string;
  trackId: number;
  initialAllocation: string;
  maxAllocation: string;
  maxDrawdownBps: number;
  maxTradeSizeBps: number;
  maxDailyTurnoverBps: number;
  maxDailyLossBps: number;
  evaluationPeriod: string;
  minTrades: number;
  promotionScore: number;
  active: boolean;
  maxStopLossBps: number;
  minTakeProfitBps: number;
  maxTakeProfitBps: number;
  requireStopLoss: boolean;
  requireTakeProfit: boolean;
}

/** Summary for a thematic ERC-4626 vault registered in VaultTrackRegistry. */
export interface VaultSummary {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  vaultTrackConfigs: VaultTrackConfig[];
  chainId: number;
  contractAddress: string;
}

export interface ListVaultsResult {
  vaults: VaultSummary[];
  total: number;
}
