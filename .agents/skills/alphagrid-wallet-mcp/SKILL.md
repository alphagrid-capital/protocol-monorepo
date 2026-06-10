---
name: alphagrid-wallet-mcp
description: >-
  Use the AlphaGrid local wallet MCP (AgentKit) for on-chain reads and writes:
  wallet details, native/ERC20 transfers, faucet, Pyth prices, x402 HTTP.
  Use when the user mentions Alpha Wallet, wallet MCP, AgentKit, on-chain
  balance, USDC/ETH transfer, faucet, or MCP tools like
  WalletActionProvider_get_wallet_details. Read this skill before calling
  wallet MCP tools — not for Foundry contract development or trading strategy.
metadata:
  version: "0.1.0"
  openclaw:
    homepage: https://github.com/coinbase/agentkit
    requires:
      mcp:
        - alphagrid-local-wallet-mcp
---

# AlphaGrid Wallet MCP

Local stdio MCP server (`@alphagrid/local-wallet-mcp` on npm) — exposes [AgentKit](https://docs.cdp.coinbase.com/agentkit/docs/welcome) wallet tools to Cursor/Claude. **Not a trading agent**; it is a signing wallet + helpers.

Human setup: install via `npx @alphagrid/local-wallet-mcp` in `.cursor/mcp.json` (see `agents/wallet-mcp/mcp.config.example.json`) or build from `agents/wallet-mcp/README.md` for monorepo development.

## MCP server identity

- **Cursor config name:** `alphagrid-local-wallet-mcp` (example)
- **Runtime server id:** often `user-Alpha Wallet` (name may vary in Cursor Settings)
- **Always read tool schemas** from the MCP folder before `CallMcpTool`; never guess tool or server names.

## Scope: use vs avoid

| Use wallet MCP for | Do not use it for |
|--------------------|-------------------|
| Address, network, native + ERC20 balances | Writing/testing Solidity (`foundry-solidity` skill) |
| Transfers the user explicitly requested | Inventing trades or portfolio strategy |
| Testnet faucet (with CDP keys) | Assuming multi-chain without checking `get_wallet_details` |
| Pyth spot prices, x402 paid HTTP | Live-updating canvas data (canvases are static snapshots) |

## Configuration agents must assume

- **Single active chain:** set by env `NETWORK_ID` on the MCP server (default in repo: `base-sepolia`). There is **no** MCP tool to list or switch chains at runtime.
- **`WALLET_PROVIDER`:** `viem` (local key) or `cdp` (CDP smart wallet + required CDP secrets).
- **Optional CDP API keys** (`CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`): required for `cdp` provider; on `viem` they **unlock** faucet + x402 tools only when both are set.

### EVM `NETWORK_ID` values (AgentKit / viem path)

`ethereum-mainnet`, `ethereum-sepolia`, `polygon-mainnet`, `polygon-mumbai`, `base-mainnet`, `base-sepolia`, `arbitrum-mainnet`, `arbitrum-sepolia`, `optimism-mainnet`, `optimism-sepolia`, `robinhood-testnet` (chain ID `46630`, AlphaGrid extension — not in stock AgentKit)

Solana IDs exist in AgentKit but **this repo’s wallet-mcp does not wire a Solana wallet provider** — do not assume SOL balances unless the project adds it.

### AlphaGrid default testnet reference (Base Sepolia)

| Asset | Contract / note |
|-------|-----------------|
| USDC | `0x036cbd53842c5426634e7929541ec2318f3dcf7e` |
| Chain ID | `84532` |
| RPC (fallback) | `https://sepolia.base.org` |

Resolve other symbols via `ERC20ActionProvider_get_erc20_token_address` — never invent token addresses.

## Standard workflow

1. **`WalletActionProvider_get_wallet_details`** — address, `networkId`, chain ID, native balance. Do this first on every wallet task.
2. **ERC20 balance** — `ERC20ActionProvider_get_balance` with `tokenAddress`; optional `address` to query a third party.
3. **ERC20 transfer** — only after user confirms **amount**, **token**, and **destination**:
   - `ERC20ActionProvider_transfer` — amounts in **whole units** (e.g. `"0.2"` USDC, not wei).
4. **Native transfer** — `WalletActionProvider_native_transfer` — same whole-unit rule for ETH/SOL.

## Failure modes (fix before retrying)

| Symptom | Likely cause | Action |
|---------|--------------|--------|
| `gas required exceeds allowance (0)` | No native ETH for gas | `CdpApiActionProvider_request_faucet_funds` with `assetId: "eth"` (needs CDP keys), or ask user to fund the wallet |
| Faucet error on mainnet | Faucet testnet-only | EVM: `base-sepolia` or `ethereum-sepolia`; SVM: `solana-devnet` only |
| Tool missing / server errored | MCP offline or no CDP keys | Ask user to enable MCP in Cursor Settings; for viem, set CDP keys if faucet/x402 needed |
| Wrong USDC balance | Wrong network or token address | Re-run `get_wallet_details`; verify `tokenAddress` |

## Tool-specific flows

### Faucet (`CdpApiActionProvider_request_faucet_funds`)

- **base-sepolia (EVM):** `eth` (default), `usdc`, `eurc`, `cbbtc`
- **solana-devnet:** `sol` (default), `usdc` — only if Solana wallet is configured in this project
- Requires CDP API credentials

### Pyth

1. `PythActionProvider_fetch_price_feed` — `tokenSymbol`, optional `assetType` (`crypto` | `equity` | `fx` | `metal`)
2. `PythActionProvider_fetch_price` — `priceFeedID` from step 1

Do not pass arbitrary hex as a feed ID.

### x402 (paid HTTP)

Prefer the safe two-step flow unless the user explicitly wants auto-pay:

1. `X402ActionProvider_make_http_request`
2. On 402 → `X402ActionProvider_retry_http_request_with_x402` with payment details from the response

Avoid `make_http_request_with_x402` unless the user asked to skip confirmation. Discover services with `discover_x402_services` on the **current** network only.

## Safety

- **Never** transfer or approve without clear user intent (amount + destination + asset).
- **Never** commit private keys, `CDP_WALLET_SECRET`, or `.env` contents.
- Treat faucet and testnet funds as non-production.
- After transfers, optionally re-fetch balances and report tx hash from the tool result.

## Canvas + chat refresh

Wallet canvases embed **static** numbers (no `fetch` in canvas). To refresh a canvas: fetch via MCP (or `cast` fallback), then update constants in the `.canvas.tsx` file. Canvas buttons may use `useCanvasAction({ type: "newComposerChat", userPrompt: "..." })` to start an agent with a refresh instruction — they do not call MCP directly.

## MCP unavailable fallback

If the wallet MCP server is not in the available server list:

1. Tell the user to restart **Alpha Wallet** / `alphagrid-local-wallet-mcp` in Cursor MCP settings.
2. For **read-only** balances on Base Sepolia, `cast balance` and `cast call` on the USDC contract are acceptable when the user only needs a snapshot and provides or implies the wallet address from prior context.

## AlphaGrid token catalog (trading universe)

Tradable mock stocks and per-vault allowlists are **not** in wallet MCP by default. Use the AlphaGrid API or MCP server:

| Need | Source |
| --- | --- |
| All listed tokens + oracle price | `GET /tokens` or MCP `alphagrid_list_tokens` |
| Tokens for one vault (e.g. tech) | `GET /vaults/tech/tokens` or MCP `alphagrid_list_vault_tokens` |
| Oracle quotes by symbol only | `GET /prices` or MCP `alphagrid_get_prices` |
| On-chain quote | `MockPriceOracle.latestRoundData(token)` at `PriceOracle` from API/`api/src/constants/contracts.ts` |

Off-chain catalog: `config/token-catalog.json`. Pyth equity tools remain optional cross-checks only.

## Further reading

- `agents/wallet-mcp/README.md` — install, build, tool table
- [AgentKit docs](https://docs.cdp.coinbase.com/agentkit/docs/welcome)
- [CDP](https://docs.cdp.coinbase.com/)
