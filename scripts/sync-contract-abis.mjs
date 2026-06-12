#!/usr/bin/env node
/**
 * Extract ABIs from Foundry artifacts into api/src/services/abis/*.ts for viem.
 * Run after `forge build` (from repo root: `make build` or `node scripts/sync-contract-abis.mjs`).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** @type {{ artifact: string; out: string; exportName: string }[]} */
const contracts = [
  {
    artifact: 'contracts/out/FeeManager.sol/FeeManager.json',
    out: 'api/src/services/abis/fee-manager.ts',
    exportName: 'feeManagerAbi',
  },
  {
    artifact: 'contracts/out/AgentRegistry.sol/AgentRegistry.json',
    out: 'api/src/services/abis/agent-registry.ts',
    exportName: 'agentRegistryAbi',
  },
  {
    artifact: 'contracts/out/AllocationManager.sol/AllocationManager.json',
    out: 'api/src/services/abis/allocation-manager.ts',
    exportName: 'allocationManagerAbi',
  },
  {
    artifact: 'contracts/out/PositionManager.sol/PositionManager.json',
    out: 'api/src/services/abis/position-manager.ts',
    exportName: 'positionManagerAbi',
  },
  {
    artifact: 'contracts/out/TokenRegistry.sol/TokenRegistry.json',
    out: 'api/src/services/abis/token-registry.ts',
    exportName: 'tokenRegistryAbi',
  },
  {
    artifact: 'contracts/out/TradeRouter.sol/TradeRouter.json',
    out: 'api/src/services/abis/trade-router.ts',
    exportName: 'tradeRouterAbi',
  },
  {
    artifact: 'contracts/out/TradeRouterLens.sol/TradeRouterLens.json',
    out: 'api/src/services/abis/trade-router-lens.ts',
    exportName: 'tradeRouterLensAbi',
  },
  {
    artifact: 'contracts/out/VaultTrackRegistry.sol/VaultTrackRegistry.json',
    out: 'api/src/services/abis/vault-track-registry.ts',
    exportName: 'vaultTrackRegistryAbi',
  },
  {
    artifact: 'contracts/out/MandateVault.sol/MandateVault.json',
    out: 'api/src/services/abis/mandate-vault.ts',
    exportName: 'mandateVaultAbi',
  },
  {
    artifact: 'contracts/out/MockPriceOracle.sol/MockPriceOracle.json',
    out: 'api/src/services/abis/mock-price-oracle.ts',
    exportName: 'mockPriceOracleAbi',
  },
]

for (const { artifact, out, exportName } of contracts) {
  const artifactPath = join(root, artifact)
  let raw
  try {
    raw = readFileSync(artifactPath, 'utf8')
  } catch {
    console.error(
      `Missing ${artifact}. Run \`make build\` in the repo root (or \`forge build\` in contracts/) first.`
    )
    process.exit(1)
  }

  const { abi } = JSON.parse(raw)
  if (!Array.isArray(abi)) {
    console.error(`No abi array in ${artifact}`)
    process.exit(1)
  }

  const outPath = join(root, out)
  mkdirSync(dirname(outPath), { recursive: true })
  writeFileSync(
    outPath,
    [
      `// Generated from ${artifact}. Do not edit.`,
      `// Regenerate: make build  (or: node scripts/sync-contract-abis.mjs)`,
      `export const ${exportName} = ${JSON.stringify(abi, null, 2)} as const`,
      '',
    ].join('\n')
  )
  console.log(`Wrote ${out} (${abi.length} entries)`)
}
