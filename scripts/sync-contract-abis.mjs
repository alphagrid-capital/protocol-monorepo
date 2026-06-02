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
