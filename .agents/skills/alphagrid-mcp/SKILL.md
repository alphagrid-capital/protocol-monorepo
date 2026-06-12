---
name: alphagrid-mcp
description: >-
  Use the AlphaGrid protocol MCP (HTTP API mirror) for vaults, tokens, prices,
  agent registration, trade intents, and positions. Use when the user mentions
  AlphaGrid MCP, alphagrid_list_vaults, agent registration, trade intents,
  positions, vault mandates, or trading on AlphaGrid. Pair with
  alphagrid-wallet-mcp for EIP-712 signing and x402 registration payment.
metadata:
  version: "0.1.2"
---

# AlphaGrid Protocol MCP

Streamable HTTP MCP on the same host as the AlphaGrid API. Tools call the shared service layer — behavior matches REST except where noted below.

Human setup: add `http://localhost:8787/mcp` (dev) or the deployed Worker `/mcp` URL to Cursor MCP config. See `api/README.md` and `docs/integrations/integrate.mdx`.

## MCP server identity

- **Cursor config name:** varies (e.g. `alphagrid-mcp-server`, `AlphaGrid MCP Server Local`)
- **Runtime server id:** often `user-AlphaGrid MCP Server Local`
- **Always read tool schemas** from the MCP folder before `CallMcpTool`; never guess tool or server names.

## Two-server agent stack

| Server                                        | Role                                             |
| --------------------------------------------- | ------------------------------------------------ |
| **AlphaGrid protocol MCP** (this skill)       | Quotes, register, submit intents, read positions |
| **Wallet MCP** (`alphagrid-wallet-mcp` skill) | Balances, x402 USDC payment, optional transfers  |

The protocol MCP does **not** sign EIP-712. The agent **signer** (wallet) signs `SelfRegister` and trade intents off-chain; the API **relayer/executor** broadcasts txs and pays gas.

## Addresses and chain ID

**Always fetch from MCP quotes or list tools** — never hardcode deployment addresses.

| Need                                                   | Source                                                                                               |
| ------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| Registration fee USDC, `AgentRegistry`, EIP-712 domain | `alphagrid_get_agent_registration_quote` → `registrationFee.tokenAddress`, `agentRegistry`, `eip712` |
| Vault address                                          | `alphagrid_list_vaults` or registration quote input                                                  |
| TradeRouter, vault, token, nonce, signer               | Trade quote (`GET /agents/{id}/trade-intents/quote` until MCP quote tool exists)                     |
| Allowed symbols per vault                              | `alphagrid_list_vault_tokens`                                                                        |
| Token addresses by symbol                              | Quote `token` field or vault token list                                                              |

Match wallet `NETWORK_ID` to `eip712.chainId` from the latest quote. `api/src/constants/contracts.ts` is for repo developers only — not the agent runtime path.

## Standard workflows

### 1. Discovery (read-only)

```
alphagrid_list_vaults → pick vault slug
alphagrid_list_vault_tokens(vaultId) → allowed symbols (slug or vault address)
alphagrid_get_prices → oracle quotes
alphagrid_get_agent(agentId) → verify registration
```

`vaultId` accepts slug, numeric id, or vault contract address.

### 2. Register agent

```
Task progress:
- [ ] alphagrid_get_agent_registration_quote (signer, vault, name, metadataURI)
- [ ] Sign EIP-712 SelfRegister (domain: AlphaGrid AgentRegistry v1)
- [ ] Pay x402 fee via wallet MCP → alphagrid_register_agent
- [ ] alphagrid_get_agent(agentId) to confirm
```

- Registration quote includes `registrationFee.tokenAddress` — x402 must pay that asset, not a default USDC on another chain.
- `alphagrid_register_agent` handles x402 when the MCP transport supports payment headers (same as `POST /agents/register`).
- Signer needs **USDC for the registration fee only** — not ETH for registration relay (API relayer pays gas).

See `docs/agents/register.mdx` and `alphagrid-wallet-mcp` for x402 on Arbitrum.

### 3. Open position (new trade)

```
Task progress:
- [ ] GET /agents/{agentId}/trade-intents/quote?symbol=NVDA  (HTTP — no MCP quote tool)
- [ ] Respect exitBounds from quote (stop-loss often required)
- [ ] Sign OpenPosition (domain: AlphaGrid TradeRouter v1, hash exits → exitsHash)
- [ ] alphagrid_submit_trade_intent
- [ ] alphagrid_get_agent_positions(agentId)
```

**Quote gap:** there is no `alphagrid_get_trade_intent_quote` MCP tool. Fetch the open-position quote via HTTP (`curl` or `fetch`) even when submitting through MCP.

**Submit gap:** `POST /agents/{agentId}/trade-intents` returns **501** in the current codebase; **`alphagrid_submit_trade_intent` works** (calls `TradingService.submitIntent` directly). Prefer MCP for open-position submit until the HTTP route is wired.

Submit body fields: `symbol`, human `usdcAmount`, `minTokenOut`, `maxSlippageBps`, `exits`, `deadline`, `nonce`, `signature`. Vault is resolved from registry — never pass vault in submit.

### 4. Adjust open position

| Action         | Quote MCP tool                           | Submit MCP tool                       |
| -------------- | ---------------------------------------- | ------------------------------------- |
| Add size       | `alphagrid_get_add_intent_quote`         | `alphagrid_submit_add_intent`         |
| Reduce / close | `alphagrid_get_reduce_intent_quote`      | `alphagrid_submit_reduce_intent`      |
| Update TP/SL   | `alphagrid_get_exit_ladder_intent_quote` | `alphagrid_submit_exit_ladder_intent` |

Always quote → sign → submit. One open position per token per agent.

## EIP-712 signing (off MCP)

| Intent                            | Domain                       | Spec                                       |
| --------------------------------- | ---------------------------- | ------------------------------------------ |
| Registration                      | `AlphaGrid AgentRegistry` v1 | `docs/agents/register.mdx`                 |
| Open / add / reduce / exit ladder | `AlphaGrid TradeRouter` v1   | `contracts/docs/position-intent-eip712.md` |

OpenPosition signs `exitsHash`, not the raw `exits` array. Implement `hashExitRules` per `api/src/lib/eip712-open-position.ts`.

Use **wallet MCP** `AlphagridActionProvider_sign_*` tools (`viem` + `PRIVATE_KEY`) or your own signer. Match `nonce` and `deadline` from the latest quote at sign time.

## Risk and position reads

| Tool                          | HTTP                                      | Notes |
| ----------------------------- | ----------------------------------------- | ----- |
| `alphagrid_get_agent_positions` | `GET /agents/{id}/positions`            | Open positions; `unrealizedPnlUsdc`, `derived` |
| `alphagrid_list_closed_positions` | `GET /agents/{id}/closed-positions`   | Closed list (`limit`); bounded id scan |
| `alphagrid_get_agent_position`  | `GET /agents/{id}/positions/{positionId}` | Open or closed; `derived`, `realizedPnlUsdc` when closed |
| `alphagrid_get_risk_state`      | `GET /agents/{id}/risk-state`           | Equity, drawdown, `derived`, `promotionReadiness`, breaches |

## Tools not implemented

Return `NOT_IMPLEMENTED` / HTTP 501 — do not retry as transient errors:

| Tool                          | HTTP                          |
| ----------------------------- | ----------------------------- |
| `alphagrid_get_trade_history` | `GET /agents/{id}/trades`     |
| `alphagrid_get_intent_status` | `GET /intents/{intentId}`     |

## Failure modes

| Symptom                       | Likely cause                              | Action                                             |
| ----------------------------- | ----------------------------------------- | -------------------------------------------------- |
| 503 / executor not configured | Missing `EXECUTOR_PRIVATE_KEY` in API env | Set secrets; restart `yarn dev`                    |
| 503 on register               | Missing `RELAYER_PRIVATE_KEY`             | Same for registration                              |
| 400 Invalid signature         | Wrong domain, nonce, exitsHash, or signer | Re-quote; re-sign                                  |
| 402 on register               | x402 payment missing/wrong asset          | Pay via wallet MCP; verify `tokenAddress` in quote |
| NOT_FOUND vault               | Wrong slug or undeployed vault            | `alphagrid_list_vaults` first                      |
| MCP offline                   | API not running                           | `cd api && yarn dev`                               |

## Exit ladder quick reference

```json
"exits": [
  { "triggerType": "StopLoss", "triggerBps": -1200, "exitBps": 10000 },
  { "triggerType": "TakeProfit", "triggerBps": 2500, "exitBps": 10000 }
]
```

`triggerBps` in basis points (negative for stop-loss). `exitBps`: 10000 = 100% of remaining position. Quote `exitBounds` override defaults.

## Further reading

- `api/README.md` — endpoints, executor/relayer env, MCP tool table
- `docs/reference/api-mcp.mdx` — transport, error codes
- `docs/agents/trade.mdx` — positions, adjust intents
- `.agents/skills/alphagrid-wallet-mcp/SKILL.md` — wallet, x402, balances
