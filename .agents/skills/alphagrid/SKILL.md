---
name: alphagrid
description: >-
  Check AlphaGrid agent readiness (wallet + protocol MCP) and guide setup. Use when
  the user asks how to get started with AlphaGrid, verify MCP setup, or check if
  they are ready to register or trade. Read-only checks only on init — never
  auto-register or auto-trade. For registration or trades, wait for explicit user
  request; then use alphagrid-mcp and alphagrid-wallet-mcp.
metadata:
  version: "0.2.0"
---

# AlphaGrid — Get started

AlphaGrid agents need a **local signer wallet** (wallet MCP) and the **remote protocol API** (protocol MCP).

## Init sequence — checks only

When this skill runs for setup or onboarding, **only verify readiness**. Do **not** register, sign EIP-712 payloads, pay x402, transfer funds, or submit trade intents unless the user **explicitly** asks in a follow-up message.

Run these checks in order and report a status table:

```
AlphaGrid readiness:
- [ ] Step 1 — Wallet identity
- [ ] Step 2 — Protocol MCP + chain alignment
```

**Output format** (always use this after init):

| Step | Status | Details |
| --- | --- | --- |
| 1 — Wallet | ✅ or ❌ | Address, `networkId`, or what failed |
| 2 — Protocol MCP | ✅ or ❌ | Chain, MCP URL, or what failed |

If both are ✅, tell the user they are ready and **ask** whether they want to register or explore assets — do not proceed automatically.

If either is ❌, explain what to fix (config, missing MCP, chain mismatch). Point to **alphagrid-wallet-mcp** or **alphagrid-mcp** for install details.

---

## Step 1 — Check wallet identity

Read-only check via wallet MCP:

1. `WalletActionProvider_get_wallet_details` — must return address and `networkId`.

✅ **Ready** when the call succeeds and shows a stable signer address.

❌ **Not ready** when wallet MCP is offline, misconfigured, or missing `NETWORK_ID` / `PRIVATE_KEY`.

Recommend **Alpha Wallet** (`@alphagrid/local-wallet-mcp`) if not set up. Default testnet: `NETWORK_ID=arbitrum-sepolia`. CDP API keys needed for x402 on Arbitrum.

**Details:** **alphagrid-wallet-mcp** skill.

## Step 2 — Check protocol MCP

Read-only check via protocol MCP:

1. `alphagrid_list_vaults` or `alphagrid_get_prices` — must succeed.
2. Wallet `networkId` / chain must match the protocol MCP host (e.g. wallet on Arbitrum Sepolia → `https://api-421614.alphagrid.capital/mcp`).

| Network | Chain ID | Protocol MCP URL |
| --- | --- | --- |
| Arbitrum Sepolia (recommended start) | 421614 | `https://api-421614.alphagrid.capital/mcp` |
| Robinhood Testnet | 46630 | `https://api-46630.alphagrid.capital/mcp` |
| Arbitrum One | 42161 | `https://api-42161.alphagrid.capital/mcp` |

✅ **Ready** when protocol tools respond and chain matches wallet.

❌ **Not ready** when protocol MCP is offline, wrong URL, or chain mismatch.

Users connect to **deployed** endpoints only — they do not run the AlphaGrid API locally.

**Details:** **alphagrid-mcp** skill.

---

## After init — only when the user explicitly asks

These are **not** part of the init sequence. Require clear user intent before any write, sign, or payment.

### Register agent

Only when the user says they want to register (e.g. name, vault, metadata):

```
alphagrid_get_agent_registration_quote → sign SelfRegister (wallet MCP)
→ pay x402 USDC (wallet MCP) → alphagrid_register_agent
```

Confirm with `alphagrid_get_agent(agentId)` after the user approves the flow.

### Discover assets

Read-only — safe when the user asks what they can trade:

```
alphagrid_list_vaults → alphagrid_list_vault_tokens → alphagrid_get_prices
```

### Place a trade

Only when the user explicitly requests a trade (symbol, size, exits):

```
GET https://api-{chainId}.alphagrid.capital/agents/{agentId}/trade-intents/quote?symbol=...
→ sign OpenPosition (wallet MCP) → alphagrid_submit_trade_intent
```

Never invent trades or submit without user confirmation of amount, symbol, and exits.

**Details:** **alphagrid-mcp** skill.

## Related skills

```bash
npx skills add alphagrid-capital/protocol-monorepo \
  -s alphagrid -s alphagrid-mcp -s alphagrid-wallet-mcp \
  -a cursor -y
```

| Goal | Skill |
| --- | --- |
| Wallet install, x402, signing | `alphagrid-wallet-mcp` |
| Registration, vaults, trades | `alphagrid-mcp` |
| Human docs | https://docs.alphagrid.capital/integrations/integrate |
