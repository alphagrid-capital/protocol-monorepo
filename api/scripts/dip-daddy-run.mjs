#!/usr/bin/env node
/**
 * Dip Daddy 9000 — one automation cycle (quote → sign → submit).
 * Uses local AlphaGrid API + viem signing with PRIVATE_KEY.
 */
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  http,
  keccak256,
  parseAbiParameters,
  parseAbi,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { baseSepolia } from 'viem/chains'

const API = process.env.ALPHAGRID_API_URL ?? 'http://localhost:8787'
const PRIVATE_KEY = process.env.PRIVATE_KEY
const VAULT_SLUG = 'tech'
const FAVORITES = ['TSLA', 'COIN', 'NVDA', 'META', 'MSFT']
const AGENT_NAME = 'Dip Daddy 9000'
const METADATA_URI = 'ipfs://dip-daddy-9000'

const CONTRACTS = {
  agentRegistry: '0x5b8a93b13cd4939fb52bee581778081a7a2f1084',
  feeManager: '0xa4d40dcfeb2915bf5e709b88b6b177d962422a4a',
  techVault: '0xea3895c279bcab7f3d2fd18416500f781accebed',
  usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
}

const LADDERS = {
  A: [
    { triggerType: 'TakeProfit', triggerBps: 400, exitBps: 5000 },
    { triggerType: 'TakeProfit', triggerBps: 800, exitBps: 5000 },
    { triggerType: 'StopLoss', triggerBps: -1200, exitBps: 10000 },
  ],
  B: [
    { triggerType: 'TakeProfit', triggerBps: 1500, exitBps: 3000 },
    { triggerType: 'TakeProfit', triggerBps: 3000, exitBps: 7000 },
    { triggerType: 'StopLoss', triggerBps: -1500, exitBps: 10000 },
  ],
  C: [
    { triggerType: 'TakeProfit', triggerBps: 600, exitBps: 10000 },
    { triggerType: 'StopLoss', triggerBps: -1000, exitBps: 10000 },
  ],
  D: [
    { triggerType: 'TakeProfit', triggerBps: 2500, exitBps: 10000 },
    { triggerType: 'StopLoss', triggerBps: -1500, exitBps: 10000 },
  ],
}

const STRATEGY_NAMES = [
  'Panic dip buyer',
  'Momentum chaser',
  'Scalp & run',
  'YOLO add',
  'Volatility lottery',
  'Ladder remix',
  'Rotation',
  'Full send Friday',
]

const VOL_ORDER = ['COIN', 'TSLA', 'NVDA', 'META', 'MSFT']

function hashExitRules(exits) {
  const ruleHashes = exits.map((rule) =>
    keccak256(
      encodeAbiParameters(parseAbiParameters('uint8, int256, uint16'), [
        rule.triggerType === 'StopLoss' ? 0 : 1,
        BigInt(rule.triggerBps),
        rule.exitBps,
      ])
    )
  )
  return keccak256(
    encodeAbiParameters(parseAbiParameters('bytes32[]'), [ruleHashes])
  )
}

async function api(path, init) {
  const res = await fetch(`${API}${path}`, init)
  const text = await res.text()
  let body
  try {
    body = JSON.parse(text)
  } catch {
    body = text
  }
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} → ${res.status}: ${text}`)
  }
  return body
}

async function resolveAgentId(owner) {
  try {
    const res = await api(`/agents/by-owner/${owner}`)
    const agents = res.agents ?? []
    if (agents.length > 0) {
      return agents[0].agentId
    }
  } catch {
    // fall through to on-chain probe
  }
  const nextId = await createPublicClient({
    chain: baseSepolia,
    transport: http('https://sepolia.base.org'),
  }).readContract({
    address: CONTRACTS.agentRegistry,
    abi: parseAbi(['function nextAgentId() view returns (uint256)']),
    functionName: 'nextAgentId',
  })
  return nextId > 1n ? '1' : null
}

async function registerAgent(account, publicClient, walletClient) {
  const nonce = await publicClient.readContract({
    address: CONTRACTS.agentRegistry,
    abi: parseAbi(['function nonces(address) view returns (uint256)']),
    functionName: 'nonces',
    args: [account.address],
  })
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600)
  const signature = await walletClient.signTypedData({
    account,
    domain: {
      name: 'AlphaGrid AgentRegistry',
      version: '1',
      chainId: baseSepolia.id,
      verifyingContract: CONTRACTS.agentRegistry,
    },
    types: {
      SelfRegister: [
        { name: 'vault', type: 'address' },
        { name: 'name', type: 'string' },
        { name: 'metadataURI', type: 'string' },
        { name: 'signer', type: 'address' },
        { name: 'linkERC8004', type: 'bool' },
        { name: 'erc8004AgentId', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    primaryType: 'SelfRegister',
    message: {
      vault: CONTRACTS.techVault,
      name: AGENT_NAME,
      metadataURI: METADATA_URI,
      signer: account.address,
      linkERC8004: false,
      erc8004AgentId: 0n,
      nonce,
      deadline,
    },
  })

  const fee = await publicClient.readContract({
    address: CONTRACTS.feeManager,
    abi: parseAbi(['function getRegistrationFee() view returns (uint256)']),
    functionName: 'getRegistrationFee',
  })

  if (fee > 0n) {
    const allowance = await publicClient.readContract({
      address: CONTRACTS.usdc,
      abi: parseAbi([
        'function allowance(address,address) view returns (uint256)',
      ]),
      functionName: 'allowance',
      args: [account.address, CONTRACTS.feeManager],
    })
    if (allowance < fee) {
      const approveHash = await walletClient.writeContract({
        account,
        chain: baseSepolia,
        address: CONTRACTS.usdc,
        abi: parseAbi(['function approve(address,uint256) returns (bool)']),
        functionName: 'approve',
        args: [CONTRACTS.feeManager, fee],
      })
      await publicClient.waitForTransactionReceipt({ hash: approveHash })
    }
  }

  const hash = await walletClient.writeContract({
    account,
    chain: baseSepolia,
    address: CONTRACTS.agentRegistry,
    abi: parseAbi([
      'function selfRegisterAgent(address,string,string,address,bool,uint256,uint256,bytes) returns (uint256)',
    ]),
    functionName: 'selfRegisterAgent',
    args: [
      CONTRACTS.techVault,
      AGENT_NAME,
      METADATA_URI,
      account.address,
      false,
      0n,
      deadline,
      signature,
    ],
  })
  await publicClient.waitForTransactionReceipt({ hash })
  const nextId = await publicClient.readContract({
    address: CONTRACTS.agentRegistry,
    abi: parseAbi(['function nextAgentId() view returns (uint256)']),
    functionName: 'nextAgentId',
  })
  const agentId = nextId - 1n
  if (agentId < 1n) throw new Error('Registration did not mint an agent id')
  return agentId.toString()
}

async function signOpenPosition(walletClient, account, quote, symbol, usdcAmount, exits) {
  const tokenEntry = quote.token
  if (!tokenEntry) throw new Error('Quote missing token address')
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600)
  const nonce = BigInt(quote.nonce)
  const exitsHash = hashExitRules(exits)
  const usdcAtomic = BigInt(Math.round(Number(usdcAmount) * 1e6))

  const signature = await walletClient.signTypedData({
    account,
    domain: {
      name: quote.eip712.domainName,
      version: quote.eip712.domainVersion,
      chainId: quote.eip712.chainId,
      verifyingContract: quote.eip712.verifyingContract,
    },
    types: {
      OpenPosition: [
        { name: 'agentId', type: 'uint256' },
        { name: 'vault', type: 'address' },
        { name: 'token', type: 'address' },
        { name: 'usdcAmount', type: 'uint256' },
        { name: 'minTokenOut', type: 'uint256' },
        { name: 'maxSlippageBps', type: 'uint16' },
        { name: 'exitsHash', type: 'bytes32' },
        { name: 'deadline', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    primaryType: 'OpenPosition',
    message: {
      agentId: BigInt(quote.agentId),
      vault: quote.vault,
      token: tokenEntry,
      usdcAmount: usdcAtomic,
      minTokenOut: 0n,
      maxSlippageBps: 100,
      exitsHash,
      deadline,
      nonce,
    },
  })

  return {
    symbol,
    usdcAmount: usdcAmount.toFixed(2),
    minTokenOut: '0',
    maxSlippageBps: 100,
    exits,
    deadline: deadline.toString(),
    nonce: nonce.toString(),
    signature,
  }
}

function normSymbol(s) {
  return (s ?? '').replace(/^m/, '')
}

function heldSymbols(positions) {
  return new Set(positions.map((p) => normSymbol(p.symbol)))
}

function pctVsEntry(position, pythPrices) {
  const sym = normSymbol(position.symbol)
  const entry = Number(position.entryPriceUsdc ?? position.costBasis?.entryPriceUsdc ?? 0)
  const px = pythPrices[sym]
  if (!entry || !px) return 0
  return (px - entry) / entry
}

function lowestPriceSymbol(symbols, pythPrices) {
  let pick = symbols[0]
  let low = pythPrices[pick] ?? Infinity
  for (const s of symbols) {
    const px = pythPrices[s] ?? Infinity
    if (px < low) {
      low = px
      pick = s
    }
  }
  return pick
}

function strongestGainer(pythPrices) {
  return [...FAVORITES].sort((a, b) => (pythPrices[b] ?? 0) - (pythPrices[a] ?? 0))[0]
}

function pickStrategy(slot, positions, pythPrices) {
  const held = heldSymbols(positions)
  const flat = FAVORITES.filter((s) => !held.has(s))

  if (slot === 0) {
    if (flat.length > 0) {
      return { action: 'open', symbol: lowestPriceSymbol(flat, pythPrices), usdc: 250, ladder: 'C' }
    }
    const underwater = positions
      .map((p) => ({ sym: normSymbol(p.symbol), pct: pctVsEntry(p, pythPrices), p }))
      .filter((x) => x.pct < 0)
      .sort((a, b) => a.pct - b.pct)[0]
    if (underwater) {
      return { action: 'add', symbol: underwater.sym, usdc: 125, ladder: 'C', positionId: underwater.p.positionId }
    }
    return { action: 'open', symbol: 'COIN', usdc: 200, ladder: 'C' }
  }

  if (slot === 1) {
    const sym = strongestGainer(pythPrices)
    if (held.has(sym)) {
      return { action: 'add', symbol: sym, usdc: 225, ladder: 'A', positionId: positions.find((p) => normSymbol(p.symbol) === sym)?.positionId }
    }
    return { action: 'open', symbol: sym, usdc: 250, ladder: 'A' }
  }

  if (slot === 2) {
    const winner = positions
      .map((p) => ({ sym: normSymbol(p.symbol), pct: pctVsEntry(p, pythPrices), p }))
      .filter((x) => x.pct > 0)
      .sort((a, b) => b.pct - a.pct)[0]
    if (winner?.p?.positionId) {
      return { action: 'reduce', symbol: winner.sym, exitBps: 4000, positionId: winner.p.positionId }
    }
    return { action: 'open', symbol: lowestPriceSymbol(FAVORITES, pythPrices), usdc: 150, ladder: 'C' }
  }

  if (slot === 3) {
    const worst = positions
      .map((p) => ({ sym: normSymbol(p.symbol), pct: pctVsEntry(p, pythPrices), p }))
      .sort((a, b) => a.pct - b.pct)[0]
    if (worst?.p?.positionId) {
      return { action: 'add', symbol: worst.sym, usdc: 200, ladder: 'A', positionId: worst.p.positionId }
    }
    return { action: 'open', symbol: 'TSLA', usdc: 200, ladder: 'C' }
  }

  if (slot === 4) {
    const target = held.has('COIN') ? 'TSLA' : 'COIN'
    if (held.has(target)) {
      return {
        action: 'add',
        symbol: target,
        usdc: 300,
        ladder: 'D',
        positionId: positions.find((p) => normSymbol(p.symbol) === target)?.positionId,
      }
    }
    return { action: 'open', symbol: target, usdc: 350, ladder: 'D' }
  }

  if (slot === 5) {
    const open = positions[0]
    if (open?.positionId) {
      const ladder = ['A', 'B', 'C'][Math.floor(Date.now() / 600000) % 3]
      return { action: 'ladder', symbol: normSymbol(open.symbol), ladder, positionId: open.positionId }
    }
    return { action: 'open', symbol: flat[0] ?? 'NVDA', usdc: 175, ladder: 'B' }
  }

  if (slot === 6) {
    const oldest = positions[0]
    if (oldest?.positionId && flat.length > 0) {
      return {
        action: 'rotate',
        reduce: { symbol: normSymbol(oldest.symbol), exitBps: 10000, positionId: oldest.positionId },
        open: { symbol: flat[0], usdc: 225, ladder: 'B' },
      }
    }
    return { action: 'open', symbol: flat[0] ?? 'MSFT', usdc: 200, ladder: 'B' }
  }

  // slot 7
  if (flat.length > 0) {
    const sym = flat.sort((a, b) => VOL_ORDER.indexOf(a) - VOL_ORDER.indexOf(b))[0]
    return { action: 'open', symbol: sym, usdc: 450, ladder: sym === 'COIN' || sym === 'TSLA' ? 'D' : 'B' }
  }
  const worst = positions
    .map((p) => ({ sym: normSymbol(p.symbol), pct: pctVsEntry(p, pythPrices), p }))
    .sort((a, b) => a.pct - b.pct)[0]
  if (worst?.p?.positionId) {
    return { action: 'add', symbol: worst.sym, usdc: 250, ladder: 'D', positionId: worst.p.positionId }
  }
  return { action: 'open', symbol: 'COIN', usdc: 400, ladder: 'D' }
}

async function submitOpen(agentId, walletClient, account, symbol, usdc, ladderKey) {
  const quote = await api(`/agents/${agentId}/trade-intents/quote?symbol=${symbol}`)
  const body = await signOpenPosition(walletClient, account, quote, symbol, usdc, LADDERS[ladderKey])
  return api(`/agents/${agentId}/trade-intents`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function main() {
  if (!PRIVATE_KEY) throw new Error('PRIVATE_KEY not set')

  const account = privateKeyToAccount(PRIVATE_KEY)
  const transport = http('https://sepolia.base.org')
  const publicClient = createPublicClient({ chain: baseSepolia, transport })
  const walletClient = createWalletClient({ account, chain: baseSepolia, transport })

  const slot =
    process.env.STRATEGY_SLOT != null
      ? Number(process.env.STRATEGY_SLOT) % 8
      : new Date().getUTCMinutes() % 8
  const report = {
    slot,
    strategy: STRATEGY_NAMES[slot],
    wallet: account.address,
    actions: [],
    skipReason: null,
  }

  let agentId = await resolveAgentId(account.address)
  if (!agentId) {
    console.log('Registering agent on tech vault...')
    agentId = await registerAgent(account, publicClient, walletClient)
    report.actions.push({ type: 'register', agentId })
  }

  let positions = []
  try {
    const posRes = await api(`/agents/${agentId}/positions`)
    positions = posRes.positions ?? []
  } catch (e) {
    report.positionsError = String(e)
  }

  const vaultTokens = await api(`/vaults/${VAULT_SLUG}/tokens`)
  const allowed = new Set(
    vaultTokens.tokens
      .map((t) => t.symbol.replace(/^m/, ''))
      .filter((s) => FAVORITES.includes(s))
  )

  const pythPrices = Object.fromEntries(
    (
      await Promise.all(
        FAVORITES.map(async (s) => {
          try {
            const feed = await fetch(
              `https://hermes.pyth.network/v2/updates/price/latest?ids[]=${await pythId(s)}`
            ).then((r) => r.json())
            const p = feed?.parsed?.[0]?.price
            const px = p ? Number(p.price) * 10 ** p.expo : null
            return [s, px]
          } catch {
            return [s, null]
          }
        })
      )
    ).filter(([, px]) => px != null)
  )

  report.pythPrices = pythPrices
  report.agentId = agentId

  const plan = pickStrategy(slot, positions, pythPrices)
  report.plan = plan

  const primarySymbol = plan.symbol ?? plan.open?.symbol ?? plan.reduce?.symbol
  if (primarySymbol && !allowed.has(primarySymbol)) {
    report.skipReason = `${primarySymbol} not on tech allowlist`
    console.log(JSON.stringify(report, null, 2))
    return
  }

  try {
    if (plan.action === 'open') {
      const submit = await submitOpen(agentId, walletClient, account, plan.symbol, plan.usdc, plan.ladder)
      report.actions.push({ type: 'open', symbol: plan.symbol, usdc: plan.usdc, ladder: plan.ladder, tx: submit.transactionHash })
    } else if (plan.action === 'add' && plan.positionId) {
      report.skipReason = 'Add intent requires MCP quote tools — not executed this cycle'
    } else if (plan.action === 'reduce' && plan.positionId) {
      report.skipReason = 'Reduce intent requires MCP quote tools — not executed this cycle'
    } else if (plan.action === 'ladder' && plan.positionId) {
      report.skipReason = 'Exit ladder update requires MCP quote tools — not executed this cycle'
    } else if (plan.action === 'rotate') {
      report.skipReason = 'Rotation requires reduce+open — deferred (no position reads on Base Sepolia lens)'
    }
  } catch (e) {
    report.actions.push({ type: 'trade_error', error: String(e), plan })
    if (String(e).includes('503') || String(e).includes('EXECUTOR')) {
      report.skipReason = 'Trade signed but submit blocked: EXECUTOR_PRIVATE_KEY not configured on API'
    }
  }

  try {
    const finalPos = await api(`/agents/${agentId}/positions`)
    report.finalPositions = finalPos.positions ?? []
  } catch (e) {
    report.finalPositionsError = String(e)
  }

  console.log(JSON.stringify(report, null, 2))
}

async function pythId(symbol) {
  const map = {
    TSLA: '16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1',
    COIN: 'fee33f2a978bf32dd6b662b65ba8083c6773b494f8401194ec1870c640860245',
    NVDA: 'b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593',
    META: '78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe',
    MSFT: 'd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1',
  }
  return map[symbol]
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
