import type { ChainContracts } from './contracts.js'

/** On-chain contract keys mapped to API vault slugs. */
export const DEPLOYED_VAULT_KEYS = [
  ['FoundationVault', 'foundation'],
  ['TechVault', 'tech'],
  ['VolatilityVault', 'volatility'],
  ['MacroVault', 'macro'],
] as const satisfies readonly [keyof ChainContracts, string][]

export type DeployedVaultSlug = (typeof DEPLOYED_VAULT_KEYS)[number][1]
