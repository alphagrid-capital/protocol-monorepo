#!/usr/bin/env node
/**
 * Copy Foundry artifact ABIs into subgraph/abis/ for The Graph codegen.
 * Run after `make build` (from repo root).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** @type {{ artifact: string; out: string }[]} */
const contracts = [
  {
    artifact: 'contracts/out/AgentRegistry.sol/AgentRegistry.json',
    out: 'subgraph/abis/AgentRegistry.json',
  },
  {
    artifact: 'contracts/out/AllocationManager.sol/AllocationManager.json',
    out: 'subgraph/abis/AllocationManager.json',
  },
  {
    artifact: 'contracts/out/PositionManager.sol/PositionManager.json',
    out: 'subgraph/abis/PositionManager.json',
  },
  {
    artifact: 'contracts/out/TradeRouter.sol/TradeRouter.json',
    out: 'subgraph/abis/TradeRouter.json',
  },
  {
    artifact: 'contracts/out/TradeRouterLens.sol/TradeRouterLens.json',
    out: 'subgraph/abis/TradeRouterLens.json',
  },
]

mkdirSync(join(root, 'subgraph/abis'), { recursive: true })

for (const { artifact, out } of contracts) {
  const artifactPath = join(root, artifact)
  let raw
  try {
    raw = readFileSync(artifactPath, 'utf8')
  } catch {
    console.error(
      `Missing ${artifact}. Run \`make build\` in the repo root first.`
    )
    process.exit(1)
  }

  const { abi } = JSON.parse(raw)
  if (!Array.isArray(abi)) {
    console.error(`No abi array in ${artifact}`)
    process.exit(1)
  }

  const outPath = join(root, out)
  writeFileSync(outPath, `${JSON.stringify(abi, null, 2)}\n`)
  console.log(`Wrote ${out} (${abi.length} entries)`)
}
