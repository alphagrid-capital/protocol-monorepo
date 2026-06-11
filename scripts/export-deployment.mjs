#!/usr/bin/env node
/**
 * Build deployments/<chainId>.json from a DeployFullStack forge broadcast log.
 *
 * Usage (from repo root):
 *   node scripts/export-deployment.mjs 421614
 *   node scripts/export-deployment.mjs 84532
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const chainId = process.argv[2]
if (!chainId) {
  console.error('Usage: node scripts/export-deployment.mjs <chainId>')
  process.exit(1)
}

const contractsDir = join(import.meta.dirname, '..', 'contracts')
const broadcastCandidates = [
  join(contractsDir, 'broadcast', 'DeployFullStack.s.sol', chainId, 'run-latest.json'),
  join(contractsDir, 'broadcast', 'DeployFullStack.s.sol', chainId, 'dry-run', 'run-latest.json'),
]

const broadcastPath = broadcastCandidates.find((p) => existsSync(p))
if (!broadcastPath) {
  console.error(`No DeployFullStack broadcast found for chain ${chainId}.`)
  console.error('Run forge script with --broadcast (or a dry-run) first.')
  process.exit(1)
}

const broadcast = JSON.parse(readFileSync(broadcastPath, 'utf8'))
const txs = broadcast.transactions ?? []

function findCreate(name) {
  return txs.find((t) => t.transactionType === 'CREATE' && t.contractName === name)?.contractAddress
}

function vaultImplementation() {
  const factory = txs.find((t) => t.transactionType === 'CREATE' && t.contractName === 'MandateVaultFactory')
  return factory?.additionalContracts?.find((c) => c.contractName === 'MandateVault')?.address ?? null
}

function vaultClones() {
  return txs
    .filter((t) => t.function?.includes('deployVault'))
    .map((t) => t.additionalContracts?.[0]?.address)
    .filter(Boolean)
}

function resolveStableAssets() {
  const symbolMap = {
    mNVDA: 'NVDA',
    mMETA: 'META',
    mTSLA: 'TSLA',
    mAAPL: 'AAPL',
    mMSFT: 'MSFT',
    mCOIN: 'COIN',
    mHOOD: 'HOOD',
    mSPY: 'SPY',
  }
  const tokens = {}
  let vaultAsset

  for (const t of txs) {
    if (t.transactionType !== 'CREATE' || t.contractName !== 'MockERC20') continue
    const [, symbol] = t.arguments ?? []
    if (symbol === 'mSTBL' || symbol === 'mUSDC') {
      vaultAsset = t.contractAddress
      continue
    }
    const key = symbolMap[symbol]
    if (key) tokens[key] = t.contractAddress
  }

  const feeManager = txs.find((t) => t.contractName === 'FeeManager')
  const feeAsset = feeManager?.arguments?.[2] ?? null

  const factory = txs.find((t) => t.transactionType === 'CREATE' && t.contractName === 'MandateVaultFactory')
    ?.arguments?.[1]
  if (!vaultAsset && factory) vaultAsset = factory

  return { feeAsset, vaultAsset, tokens }
}

const [foundation, tech, volatility, macro] = vaultClones()
const { feeAsset, vaultAsset, tokens } = resolveStableAssets()
const deployedAt = broadcast.timestamp ? Math.floor(Number(broadcast.timestamp) / 1000) : Math.floor(Date.now() / 1000)

const artifact = {
  chainId: Number(chainId),
  deployedAt,
  FeeManager: findCreate('FeeManager'),
  VaultTrackRegistry: findCreate('VaultTrackRegistry'),
  TokenRegistry: findCreate('TokenRegistry'),
  AgentRegistry: findCreate('AgentRegistry'),
  AllocationManager: findCreate('AllocationManager'),
  VaultFactory: findCreate('MandateVaultFactory'),
  VaultImplementation: vaultImplementation(),
  FoundationVault: foundation,
  TechVault: tech,
  VolatilityVault: volatility,
  MacroVault: macro,
  PositionManager: findCreate('PositionManager'),
  TradeRouter: findCreate('TradeRouter'),
  SwapAdapter: findCreate('MockSwapAdapter') ?? findCreate('InventorySwapAdapter'),
  PriceOracle: findCreate('MockPriceOracle'),
  feeAsset,
  vaultAsset,
  usdc: vaultAsset,
  tokens,
}

const missing = Object.entries(artifact).filter(([, v]) => v == null || (typeof v === 'object' && !Object.keys(v).length))
if (missing.length) {
  console.warn('Warning: some fields are missing:', missing.map(([k]) => k).join(', '))
}

const outPath = join(contractsDir, 'deployments', `${chainId}.json`)
writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`)
console.log(`Wrote ${outPath}`)
console.log(`Source: ${broadcastPath}`)
