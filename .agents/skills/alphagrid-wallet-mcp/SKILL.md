---
name: alphagrid-wallet-mcp
description: >-
  Use the AlphaGrid local wallet MCP (AgentKit) for on-chain reads and writes:
  wallet details, native/ERC20 transfers, faucet, Pyth prices, x402 HTTP
  (including AlphaGrid registration fees on Arbitrum). Use when the user
  mentions Alpha Wallet, wallet MCP, AgentKit, on-chain balance, USDC transfer,
  x402 registration payment, or tools like
  WalletActionProvider_get_wallet_details. Pair with alphagrid-mcp for
  protocol quotes and intent submission. Not for Foundry or trading strategy.
metadata:
  version: "0.2.0"
  openclaw:
    homepage: https://github.com/coinbase/agentkit
    requires:
      mcp:
        - alphagrid-local-wallet-mcp
---

# AlphaGrid Wallet MCP

Local stdio MCP server (`@alphagrid/local-wallet-mcp`) exposing [AgentKit](https://docs.cdp.coinbase.com/agentkit/docs/welcome) wallet tools. **Not a trading agent** — signer wallet + on-chain helpers only.

Pair with **protocol MCP** (`alphagrid-mcp` skill) for quotes, registration relay, and trade submission.

## Install

### Prerequisites

- **Node.js 24+** (repo `.nvmrc`)
- Cursor with MCP enabled

### Cursor setup (recommended)

1. Merge `agents/wallet-mcp/mcp.config.example.json` into project `.cursor/mcp.json` (or user MCP settings).
2. Set secrets via `${env:VAR}` — never commit raw keys. Example from this repo:

```json
{
  "mcpServers": {
    "alphagrid-local-wallet-mcp": {
      "command": "npx",
      "args": ["-y", "@alphagrid/local-wallet-mcp"],
      "env": {
        "WALLET_PROVIDER": "viem",
        "NETWORK_ID": "${env:NETWORK_ID}",
        "PRIVATE_KEY": "${env:PRIVATE_KEY}",
        "CDP_API_KEY_ID": "${env:CDP_API_KEY_ID}",
        "CDP_API_KEY_SECRET": "${env:CDP_API_KEY_SECRET}"
      }
    }
  }
}
```

3. Export env vars in your shell or OS secret store (`NETWORK_ID`, `PRIVATE_KEY`, optional CDP keys).
4. Restart **Alpha Wallet** in Cursor Settings → MCP after any config change.

**`viem` (default):** set `NETWORK_ID` + `PRIVATE_KEY`. Omitting `PRIVATE_KEY` generates an ephemeral key each run.

**`cdp` smart wallet:** set `WALLET_PROVIDER=cdp` plus `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET`. `NETWORK_ID` defaults to `arbitrum-sepolia`.

**Faucet / x402 on `viem`:** also set `CDP_API_KEY_ID` + `CDP_API_KEY_SECRET`. Without them, those tools are absent from `ListTools`.

### Local build (Arbitrum x402)

Stock AgentKit x402 supports Base + Solana only. For AlphaGrid registration on **`arbitrum-sepolia`**, use the monorepo build with the Arbitrum patch:

```sh
cd agents/wallet-mcp && yarn install && yarn build
```

```json
"command": "node",
"args": ["/absolute/path/to/agents/wallet-mcp/build/index.js"]
```

### npx gotchas

- Launch `npx` from repo root or any neutral directory — **not** `agents/wallet-mcp/` (npx resolves the local package name and fails with `local-wallet-mcp: not found`).
- Stale cache: `rm -rf ~/.npm/_npx` and retry.

Full provider tables and tool list: `agents/wallet-mcp/README.md`.

## MCP server identity

- **Cursor config name:** `alphagrid-local-wallet-mcp`
- **Runtime server id:** often `user-Alpha Wallet`
- **Always read tool schemas** from the MCP folder before `CallMcpTool`; never guess tool or server names.

## Scope

| Use wallet MCP for | Do not use it for |
| --- | --- |
| Address, balances, user-requested transfers | Solidity dev/test (`foundry-solidity` skill) |
| Faucet, Pyth prices, x402 paid HTTP | Trade quotes, intents, positions (`alphagrid-mcp` skill) |
| EIP-712 signing (`AlphagridActionProvider_sign_*`, `viem` only) | `robinhood-testnet` with `cdp` provider |
| `robinhood-testnet` signing via `viem` | Inventing trades or strategy |

No Solana wallet in this package — native transfers are EVM ETH only.

## Configuration

- **Single chain per server:** `NETWORK_ID` in MCP `env`. No runtime chain switch — restart after changes.
- **`NETWORK_ID` required for `viem`.** Built-ins: `ethereum-mainnet`, `ethereum-sepolia`, `polygon-mainnet`, `polygon-mumbai`, `base-mainnet`, `base-sepolia`, `arbitrum-mainnet`, `arbitrum-sepolia`, `optimism-mainnet`, `optimism-sepolia`. AlphaGrid extension (`viem` only): `robinhood-testnet`.
- **Chain alignment:** wallet `NETWORK_ID` must match `eip712.chainId` from the latest protocol quote. For USDC balance checks, use `registrationFee.tokenAddress` from that quote.
- **Gasless API path:** registration pays USDC via x402 (relayer pays gas); trades are signed off-chain (executor pays gas). Zero native ETH is OK on the standard API path.

## Standard workflow

1. `WalletActionProvider_get_wallet_details` — address, network, native balance (always first).
2. `ERC20ActionProvider_get_balance` — pass `tokenAddress`; optional `address` for third parties.
3. Transfers only after user confirms amount, token, and destination:
   - `ERC20ActionProvider_transfer` — whole units (e.g. `"0.2"` USDC, not wei).
   - `WalletActionProvider_native_transfer` — same whole-unit rule for ETH.

## Tool flows

### Faucet

`CdpApiActionProvider_request_faucet_funds` — CDP testnet only (`base-sepolia`, `ethereum-sepolia`, etc.). Not mainnet or `robinhood-testnet`.

### Pyth

1. `PythActionProvider_fetch_price_feed` — `tokenSymbol`, optional `assetType`
2. `PythActionProvider_fetch_price` — `priceFeedID` from step 1

### x402

Prefer two-step unless user wants auto-pay:

1. `X402ActionProvider_make_http_request`
2. On 402 → `X402ActionProvider_retry_http_request_with_x402`

For AlphaGrid registration: `X402ActionProvider_make_http_request_with_x402` to `POST {API}/agents/register` after `SelfRegister` is signed. Pay `registrationFee.tokenAddress` from the quote — not default Base USDC.

Requires CDP API keys. Discover services: `X402ActionProvider_discover_x402_services`.

### EIP-712 signing

`viem` + `PRIVATE_KEY` only (not `cdp`). Pass `nonce`, `deadline`, `chainId`, and verifying contract from the latest protocol quote.

| Tool | Typed data | Submit via |
| --- | --- | --- |
| `AlphagridActionProvider_sign_self_register` | `SelfRegister` | `alphagrid_register_agent` |
| `AlphagridActionProvider_sign_open_position` | `OpenPosition` | `alphagrid_submit_trade_intent` |
| `AlphagridActionProvider_sign_add_position` | `AddToPosition` | `alphagrid_submit_add_intent` |
| `AlphagridActionProvider_sign_reduce_position` | `ReducePosition` | `alphagrid_submit_reduce_intent` |
| `AlphagridActionProvider_sign_update_exit_ladder` | `UpdateExitLadder` | `alphagrid_submit_exit_ladder_intent` |

For opens and ladder updates, pass `exits` exactly as submitted (`exitsHash` per `api/src/lib/eip712-open-position.ts`).

## Failure modes

| Symptom | Action |
| --- | --- |
| `gas required exceeds allowance (0)` | Faucet ETH (`CdpApiActionProvider_request_faucet_funds`, `assetId: "eth"`) or fund wallet |
| Faucet/x402 tool missing | Add CDP API keys to `env` and restart, or switch to `cdp` |
| Unsupported `NETWORK_ID` at startup | Fix typo; use `viem` for `robinhood-testnet` |
| x402 fails on Arbitrum | Use monorepo `agents/wallet-mcp` build; pay `registrationFee.tokenAddress` from quote |
| Wrong USDC balance | Re-run `get_wallet_details`; verify `tokenAddress` and network |

## Safety

- Never transfer or approve without clear user intent.
- Never commit private keys or CDP secrets.
- Re-fetch balances after transfers; report tx hash from tool result.

## MCP unavailable

1. Ask user to restart **Alpha Wallet** in Cursor MCP settings.
2. Read-only fallback: `cast balance` / `cast call` on `registrationFee.tokenAddress` from a protocol quote.
3. Robinhood testnet RPC: `https://rpc.testnet.chain.robinhood.com`, chain id `46630`.

## Further reading

- `.agents/skills/alphagrid-mcp/SKILL.md` — registration and trade workflows
- `agents/wallet-mcp/README.md` — full install, providers, tools
- `docs/integrations/integrate.mdx` — two-MCP stack
