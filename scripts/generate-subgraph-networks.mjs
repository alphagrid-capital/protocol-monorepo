#!/usr/bin/env node
/**
 * Generate subgraph/networks.json from contracts/deployments/*.json and broadcast logs.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/** @type {Record<number, string>} */
const GRAPH_NETWORKS = {
  421614: 'arbitrum-sepolia',
  42161: 'arbitrum-one',
}

const CONTRACTS = [
  'AgentRegistry',
  'AllocationManager',
  'PositionManager',
  'TradeRouter',
]

function minDeployBlock(chainId) {
  const broadcastPath = join(
    root,
    'contracts/broadcast/DeployFullStack.s.sol',
    String(chainId),
    'run-latest.json'
  )
  if (!existsSync(broadcastPath)) {
    return null
  }

  const broadcast = JSON.parse(readFileSync(broadcastPath, 'utf8'))
  const receipts = broadcast.receipts ?? []
  const txs = broadcast.transactions ?? []
  /** @type {Record<string, number>} */
  const minByContract = {}

  for (const tx of txs) {
    if (!CONTRACTS.includes(tx.contractName)) {
      continue
    }
    const receipt = receipts.find((r) => r.transactionHash === tx.hash)
    if (!receipt?.blockNumber) {
      continue
    }
    const block = Number.parseInt(receipt.blockNumber, 16)
    const current = minByContract[tx.contractName]
    if (current === undefined || block < current) {
      minByContract[tx.contractName] = block
    }
  }

  return minByContract
}

/** @type {Record<string, Record<string, { address: string; startBlock: number }>>} */
const networks = {}

for (const [chainIdStr, networkName] of Object.entries(GRAPH_NETWORKS)) {
  const chainId = Number(chainIdStr)
  const deploymentPath = join(root, 'contracts/deployments', `${chainId}.json`)
  if (!existsSync(deploymentPath)) {
    console.warn(`Skipping ${networkName}: missing ${deploymentPath}`)
    continue
  }

  const deployment = JSON.parse(readFileSync(deploymentPath, 'utf8'))
  const blocks = minDeployBlock(chainId)
  if (!blocks) {
    console.warn(`Skipping ${networkName}: no broadcast log`)
    continue
  }

  networks[networkName] = {}
  for (const contract of CONTRACTS) {
    const address = deployment[contract]
    const startBlock = blocks[contract]
    if (!address || startBlock === undefined) {
      console.warn(`${networkName}: missing ${contract} address or start block`)
      continue
    }
    networks[networkName][contract] = {
      address,
      startBlock,
    }
  }
}

const outPath = join(root, 'subgraph/networks.json')
writeFileSync(outPath, `${JSON.stringify(networks, null, 2)}\n`)
console.log(`Wrote ${outPath}`)
