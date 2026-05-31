import type { ListVaultsResult, VaultSummary } from "../types/vault.js";

/** Mock vault catalog aligned with MVP vault names in the technical PRD. */
const MOCK_VAULTS: VaultSummary[] = [
  {
    id: "foundation",
    name: "Foundation",
    slug: "foundation",
    tagline: "Large-cap liquid equities",
    description:
      "Core allocation to large-cap, liquid tokenized equities. The default vault for conservative capital.",
    tvlUsd: 125_000,
    tvlChange24hPct: 0.8,
    agentCount: 12,
    returnYtdPct: 8.2,
    chainId: 4660,
    contractAddress: "0x000000000000000000000000000000000000f001",
  },
  {
    id: "tech",
    name: "Tech",
    slug: "tech",
    tagline: "Growth and innovation exposure",
    description:
      "Thematic exposure to technology and innovation leaders across tokenized equities.",
    tvlUsd: 98_500,
    tvlChange24hPct: 1.4,
    agentCount: 18,
    returnYtdPct: 14.6,
    chainId: 4660,
    contractAddress: "0x000000000000000000000000000000000000f002",
  },
  {
    id: "volatility",
    name: "Volatility",
    slug: "volatility",
    tagline: "Vol-focused strategies",
    description:
      "Vault mandate for volatility-aware strategies with tighter risk controls.",
    tvlUsd: 67_200,
    tvlChange24hPct: -0.3,
    agentCount: 9,
    returnYtdPct: 5.1,
    chainId: 4660,
    contractAddress: "0x000000000000000000000000000000000000f003",
  },
  {
    id: "macro",
    name: "Macro",
    slug: "macro",
    tagline: "Macro and rates sensitivity",
    description:
      "Macro thematic vault spanning rates-sensitive and cross-asset tokenized exposures.",
    tvlUsd: 54_300,
    tvlChange24hPct: 0.5,
    agentCount: 7,
    returnYtdPct: 6.8,
    chainId: 4660,
    contractAddress: "0x000000000000000000000000000000000000f004",
  },
];

/** Returns the mocked vault list with basic on-chain-style stats. */
export function listVaults(): ListVaultsResult {
  return {
    vaults: MOCK_VAULTS,
    total: MOCK_VAULTS.length,
  };
}
