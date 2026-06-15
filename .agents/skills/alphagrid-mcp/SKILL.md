---
name: alphagrid-mcp
description: >-
  Use the AlphaGrid protocol MCP (HTTP API mirror) for vaults, tokens, prices,
  agent registration, trade intents, and positions. Use when the user mentions
  AlphaGrid MCP, alphagrid_list_vaults, agent registration, trade intents,
  positions, vault mandates, or trading on AlphaGrid. Pair with
  alphagrid-wallet-mcp for EIP-712 signing and x402 registration payment.
metadata:
  version: "0.1.3"
---

# AlphaGrid Protocol MCP

Streamable HTTP MCP on the same host as the AlphaGrid API. Tools call the shared service layer — behavior matches REST.

Pair with **wallet MCP** (`alphagrid-wallet-mcp` skill) for EIP-712 signing and x402 USDC payment. This server does **not** hold private keys.

## Install

### Prerequisites

- **Node.js 24+** (repo `.nvmrc`) for local API dev
- Cursor with MCP enabled

### Cursor setup

Add the protocol server to `.cursor/mcp.json` (project) or user MCP settings. Use the URL that matches your wallet chain:

| Network | Chain ID | MCP URL |
| --- | --- | --- |
| Arbitrum Sepolia | 421614 | `https://api-421614.alphagrid.capital/mcp` |
| Robinhood Testnet | 46630 | `https://api-46630.alphagrid.capital/mcp` |
| Arbitrum One | 42161 | `https://api-42161.alphagrid.capital/mcp` |

**Deployed (recommended):**

```json
{
  "mcpServers": {
    "alphagrid": {
      "url": "https://api-421614.alphagrid.capital/mcp"
    }
  }
}
```

**Local development:**

```json
{
  "mcpServers": {
    "alphagrid": {
      "url": "http://localhost:8787/mcp"
    }
  }
}
```

```sh
cd api && yarn install && yarn dev:arbitrum-sepolia
```

Set `RPC_URL` in `api/.dev.vars` (see `api/.env.example`). `GET /health` works without chain config; on-chain reads need `CHAIN_ID` + `RPC_URL`. Registration and trade submits need relayer/executor secrets configured.

For the full agent stack, also install wallet MCP — see `.agents/skills/alphagrid-wallet-mcp/SKILL.md`.

Clients send `Accept: application/json, text/event-stream`. Cursor handles `mcp-session-id` automatically after initialize.

## MCP server identity

- **Cursor config name:** varies (e.g. `alphagrid`, `AlphaGrid MCP Server`)
- **Runtime server id:** often `user-AlphaGrid MCP Server`
- **Always read tool schemas** from the MCP folder before `CallMcpTool`; never guess tool or server names.

## Two-server stack

| Server | Role |
| --- | --- |
| **Protocol MCP** (this skill) | Quotes, register, submit intents, read positions |
| **Wallet MCP** | Balances, x402 USDC, EIP-712 signing |

Agent signer signs off-chain; API relayer/executor broadcasts txs and pays gas.

## Addresses and chain ID

**Always fetch from MCP quotes or list tools** — never hardcode deployment addresses.

| Need | Source |
| --- | --- |
| Registration fee USDC, `AgentRegistry`, EIP-712 domain | `alphagrid_get_agent_registration_quote` |
| Vault address | `alphagrid_list_vaults` or quote input |
| TradeRouter, vault, token, nonce, signer | Open quote via HTTP (see below) or adjust-intent quote tools |
| Allowed symbols | `alphagrid_list_vault_tokens` |

Match wallet `NETWORK_ID` to `eip712.chainId` from the latest quote. `api/src/constants/contracts.ts` is for repo developers only.

## Workflows

### Discovery (read-only)

```
alphagrid_list_vaults → pick vault slug
alphagrid_list_vault_tokens(vaultId) → allowed symbols
alphagrid_get_prices → oracle quotes
alphagrid_get_agent(agentId) → verify registration
```

`vaultId` accepts slug, numeric id, or vault contract address.

### Register agent

```
- [ ] alphagrid_get_agent_registration_quote (signer, vault, name, metadataURI)
- [ ] Sign SelfRegister via wallet MCP
- [ ] Pay x402 fee → alphagrid_register_agent
- [ ] alphagrid_get_agent(agentId) to confirm
```

x402 must pay `registrationFee.tokenAddress` from the quote. Signer needs USDC for the fee only — relayer pays gas.

### Open position

```
- [ ] GET /agents/{agentId}/trade-intents/quote?symbol=NVDA  (HTTP only — no MCP quote tool)
- [ ] Respect exitBounds from quote
- [ ] Sign OpenPosition via wallet MCP
- [ ] alphagrid_submit_trade_intent (or POST /agents/{agentId}/trade-intents)
- [ ] alphagrid_get_agent_positions(agentId)
```

**Quote gap:** no `alphagrid_get_trade_intent_quote` MCP tool — fetch open-position quote via HTTP even when submitting through MCP.

Submit body: `symbol`, human `usdcAmount`, `minTokenOut`, `maxSlippageBps`, `exits`, `deadline`, `nonce`, `signature`. Vault resolved from registry — never pass vault in submit.

### Adjust open position

| Action | Quote | Submit |
| --- | --- | --- |
| Add size | `alphagrid_get_add_intent_quote` | `alphagrid_submit_add_intent` |
| Reduce / close | `alphagrid_get_reduce_intent_quote` | `alphagrid_submit_reduce_intent` |
| Update TP/SL | `alphagrid_get_exit_ladder_intent_quote` | `alphagrid_submit_exit_ladder_intent` |

Always quote → sign → submit. One open position per token per agent.

### EIP-712 signing

Use wallet MCP `AlphagridActionProvider_sign_*` tools. Match `nonce`, `deadline`, and domain fields from the latest quote.

| Intent | Domain |
| --- | --- |
| Registration | `AlphaGrid AgentRegistry` v1 |
| Open / add / reduce / exit ladder | `AlphaGrid TradeRouter` v1 |

OpenPosition signs `exitsHash`, not raw `exits` — see `api/src/lib/eip712-open-position.ts`.

### Position and risk reads

| Tool | Notes |
| --- | --- |
| `alphagrid_get_agent_positions` | Open positions with `unrealizedPnlUsdc`, `derived` |
| `alphagrid_list_closed_positions` | Closed list (`limit`) |
| `alphagrid_get_agent_position` | Open or closed by id |
| `alphagrid_get_risk_state` | Equity, drawdown, `promotionReadiness` |
| `alphagrid_get_trade_history` | On-chain event logs (`limit`) |

Confirm execution via HTTP `GET /transactions/{txHash}` (not an MCP tool).

## Failure modes

| Symptom | Action |
| --- | --- |
| 503 on quote/submit | Missing `EXECUTOR_PRIVATE_KEY` or `RELAYER_PRIVATE_KEY` in API env — restart API |
| 500 on reads | Missing `CHAIN_ID` + `RPC_URL` |
| 400 Invalid signature | Re-quote; re-sign with correct domain, nonce, exitsHash |
| 402 on register | Pay x402 via wallet MCP; verify `tokenAddress` in quote |
| NOT_FOUND vault | `alphagrid_list_vaults` first |
| MCP offline | Start API (`yarn dev`) or check deployed URL matches wallet chain |

## Exit ladder quick reference

```json
"exits": [
  { "triggerType": "StopLoss", "triggerBps": -1200, "exitBps": 10000 },
  { "triggerType": "TakeProfit", "triggerBps": 2500, "exitBps": 10000 }
]
```

`triggerBps` in basis points (negative for stop-loss). `exitBps`: 10000 = 100%. Quote `exitBounds` override defaults.

## Further reading

- `api/README.md` — endpoints, executor/relayer env, full MCP tool table
- `docs/reference/api-mcp.mdx` — transport, error codes, local dev
- `docs/agents/register.mdx`, `docs/agents/trade.mdx` — agent workflows
- `.agents/skills/alphagrid-wallet-mcp/SKILL.md` — wallet, x402, signing
