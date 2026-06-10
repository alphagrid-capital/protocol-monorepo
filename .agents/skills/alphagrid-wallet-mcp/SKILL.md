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
  version: "0.1.1"
  openclaw:
    homepage: https://github.com/coinbase/agentkit
    requires:
      mcp:
        - alphagrid-local-wallet-mcp
---

# AlphaGrid Wallet MCP

Local stdio MCP server (`@alphagrid/local-wallet-mcp` on npm) — exposes [AgentKit](https://docs.cdp.coinbase.com/agentkit/docs/welcome) wallet tools to Cursor/Claude. **Not a trading agent**; it is a signing wallet + helpers. There is no Cloudflare/remote deploy — the server runs locally via `npx` or `node build/index.js`.

Human setup: `npx @alphagrid/local-wallet-mcp` in `.cursor/mcp.json` (see `agents/wallet-mcp/mcp.config.example.json` and `agents/wallet-mcp/README.md`).

## MCP server identity

- **Cursor config name:** `alphagrid-local-wallet-mcp` (example)
- **Runtime server id:** often `user-Alpha Wallet` (name may vary in Cursor Settings)
- **Always read tool schemas** from the MCP folder before `CallMcpTool`; never guess tool or server names.

## Scope: use vs avoid

| Use wallet MCP for                                        | Do not use it for                                          |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| Address, network, native + ERC20 balances (EVM)           | Writing/testing Solidity (`foundry-solidity` skill)        |
| Transfers the user explicitly requested                   | Inventing trades or portfolio strategy                     |
| Testnet faucet (with CDP keys)                            | Assuming multi-chain without checking `get_wallet_details` |
| Pyth spot prices, x402 paid HTTP (when tools are present) | Live-updating canvas data (canvases are static snapshots)  |
| `robinhood-testnet` signing via `viem`                    | Robinhood chain via `cdp` (not supported)                  |

## Wallet providers

Set `WALLET_PROVIDER` in MCP `env`:

| Provider         | Required env                                                | Best for                                                                                |
| ---------------- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `viem` (default) | `NETWORK_ID`, `PRIVATE_KEY` (optional — see below)          | Fast local testing; custom chains (`robinhood-testnet`)                                 |
| `cdp`            | `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET` | Smart wallet without raw private key; paymaster, faucet, x402 on CDP-supported networks |

- **`viem` + CDP API keys:** `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` are optional but **required to register** faucet and x402 tools. Without them, those tools are absent from `ListTools`, not merely disabled.
- **`cdp`:** `NETWORK_ID` defaults to `base-sepolia` if omitted. Optional: `ADDRESS`, `OWNER_ADDRESS`, `PAYMASTER_URL`, `RPC_URL`.
- **No Solana wallet** is wired in this package — native transfers are EVM ETH only. Ignore AgentKit Solana IDs and faucet notes for `solana-devnet`.

## Configuration agents must assume

- **Single active chain:** set by env `NETWORK_ID` on the MCP server. There is **no** MCP tool to list or switch chains at runtime. Restart the MCP server after changing `env`.
- **`NETWORK_ID` is required for `viem`.** If omitted, startup fails with an unsupported-network error.
- **`PRIVATE_KEY` on `viem`:** if omitted, a new ephemeral key is generated each run — fine for smoke tests, bad for funded wallets (address changes every restart).

### EVM `NETWORK_ID` values

AgentKit built-ins: `ethereum-mainnet`, `ethereum-sepolia`, `polygon-mainnet`, `polygon-mumbai`, `base-mainnet`, `base-sepolia`, `arbitrum-mainnet`, `arbitrum-sepolia`, `optimism-mainnet`, `optimism-sepolia`

AlphaGrid extension (**`viem` only**): `robinhood-testnet`

### AlphaGrid default testnet reference (Base Sepolia)

| Asset          | Contract / note                              |
| -------------- | -------------------------------------------- |
| USDC           | `0x036cbd53842c5426634e7929541ec2318f3dcf7e` |
| Chain ID       | `84532`                                      |
| RPC (fallback) | `https://sepolia.base.org`                   |

Resolve other symbols via `ERC20ActionProvider_get_erc20_token_address` — never invent token addresses.

## Standard workflow

1. **`WalletActionProvider_get_wallet_details`** — address, `networkId`, chain ID, native balance. Do this first on every wallet task.
2. **ERC20 balance** — `ERC20ActionProvider_get_balance` with `tokenAddress`; optional `address` to query a third party.
3. **ERC20 transfer** — only after user confirms **amount**, **token**, and **destination**:
   - `ERC20ActionProvider_transfer` — amounts in **whole units** (e.g. `"0.2"` USDC, not wei).
4. **Native transfer** — `WalletActionProvider_native_transfer` — same whole-unit rule for ETH.

## Failure modes (fix before retrying)

| Symptom                                        | Likely cause                           | Action                                                                                                             |
| ---------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `gas required exceeds allowance (0)`           | No native ETH for gas                  | `CdpApiActionProvider_request_faucet_funds` with `assetId: "eth"` (needs CDP keys), or ask user to fund the wallet |
| Faucet error on mainnet or `robinhood-testnet` | Faucet is CDP testnet-only             | Use `base-sepolia` or `ethereum-sepolia`; fund Robinhood wallets manually                                          |
| Faucet/x402 tool missing                       | `viem` without CDP API keys            | Add `CDP_API_KEY_ID` + `CDP_API_KEY_SECRET` to MCP `env` and restart, or switch to `cdp`                           |
| Tool missing / server errored                  | MCP offline or misconfigured `env`     | Ask user to enable MCP in Cursor Settings; verify `NETWORK_ID` and provider secrets                                |
| Wrong USDC balance                             | Wrong network or token address         | Re-run `get_wallet_details`; verify `tokenAddress`                                                                 |
| Unsupported `NETWORK_ID` at startup            | Typo or `robinhood-testnet` with `cdp` | Fix `NETWORK_ID`; use `viem` for Robinhood testnet                                                                 |

## Tool-specific flows

### Faucet (`CdpApiActionProvider_request_faucet_funds`)

- **base-sepolia (EVM):** `eth` (default), `usdc`, `eurc`, `cbbtc`
- **ethereum-sepolia:** `eth` (and other assets per CDP)
- Requires CDP API credentials (`cdp` provider, or `viem` with both CDP API keys set)

### Pyth

1. `PythActionProvider_fetch_price_feed` — `tokenSymbol`, optional `assetType` (`crypto` | `equity` | `fx` | `metal`)
2. `PythActionProvider_fetch_price` — `priceFeedID` from step 1

Do not pass arbitrary hex as a feed ID.

### x402 (paid HTTP)

Prefer the safe two-step flow unless the user explicitly wants auto-pay:

1. `X402ActionProvider_make_http_request`
2. On 402 → `X402ActionProvider_retry_http_request_with_x402` with payment details from the response

Avoid `make_http_request_with_x402` unless the user asked to skip confirmation. Discover services with `discover_x402_services` on the **current** network only. Tool is only available when CDP API keys are configured.

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
3. For **Robinhood testnet**, use RPC `https://rpc.testnet.chain.robinhood.com` with `cast` and chain id `46630`.

## AlphaGrid token catalog (trading universe)

Tradable mock stocks and per-vault allowlists are **not** in wallet MCP. Use the AlphaGrid API or MCP server:

| Need                             | Source                                                                                              |
| -------------------------------- | --------------------------------------------------------------------------------------------------- |
| All listed tokens + oracle price | `GET /tokens` or MCP `alphagrid_list_tokens`                                                        |
| Tokens for one vault (e.g. tech) | `GET /vaults/tech/tokens` or MCP `alphagrid_list_vault_tokens`                                      |
| Oracle quotes by symbol only     | `GET /prices` or MCP `alphagrid_get_prices`                                                         |
| On-chain quote                   | `MockPriceOracle.latestRoundData(token)` at `PriceOracle` from API/`api/src/constants/contracts.ts` |

Off-chain catalog: `config/token-catalog.json`. Pyth equity tools remain optional cross-checks only.

## Further reading

- `agents/wallet-mcp/README.md` — install, providers, `NETWORK_ID` table, tool list
- [AgentKit docs](https://docs.cdp.coinbase.com/agentkit/docs/welcome)
- [CDP](https://docs.cdp.coinbase.com/)
