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
  version: "0.2.1"
  openclaw:
    homepage: https://github.com/coinbase/agentkit
    requires:
      mcp:
        - alphagrid-local-wallet-mcp
---

# AlphaGrid Wallet MCP

Local stdio MCP server (`@alphagrid/local-wallet-mcp` on npm) — exposes [AgentKit](https://docs.cdp.coinbase.com/agentkit/docs/welcome) wallet tools to Cursor/Claude. **Not a trading agent**; it is a signing wallet + helpers. There is no Cloudflare/remote deploy — the server runs locally via `npx` or `node build/index.js`.

Human setup: `npx @alphagrid/local-wallet-mcp` in `.cursor/mcp.json` (see `agents/wallet-mcp/mcp.config.example.json` and `agents/wallet-mcp/README.md`).

For AlphaGrid registration and trading, run **both** MCP servers: this wallet MCP plus the protocol MCP (`alphagrid-mcp` skill). Wallet = signer + x402; protocol = quotes, register relay, trade submit.

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
| x402 payment for `POST /agents/register` (registration fee) | Trade quotes, submit intents, positions (`alphagrid-mcp` skill) |
| `robinhood-testnet` signing via `viem`                    | Robinhood chain via `cdp` (not supported)                  |
| EIP-712 `signTypedData` via local viem script (see below) | Assuming wallet MCP can sign trade intents natively       |

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

### AlphaGrid chain alignment

**Wallet `NETWORK_ID` must match the API deployment chain.** Read `chainId` from `alphagrid_get_agent_registration_quote` (`eip712.chainId`) or a trade quote — do not hardcode addresses or chain IDs in agent logic.

For registration USDC balance checks, use `ERC20ActionProvider_get_balance` with `registrationFee.tokenAddress` from that quote (fee asset ≠ vault trading asset).

### Gasless agent path (AlphaGrid API)

On the standard API integration path:

- **Registration:** agent pays **USDC only** via x402; API relayer pays gas for `registerAgent`.
- **Trades:** agent signs intents off-chain; API executor pays gas for `TradeRouter` calls.
- **Native ETH** on the signer is optional for API-path agents. Do not block registration/trades on zero ETH balance if x402 and executor are configured.

Faucet ETH is still useful for direct on-chain txs outside the API (debugging with `cast`, manual contract calls).

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
| x402 payment fails on registration             | Wrong USDC contract or network         | Use `registrationFee.tokenAddress` from quote; Arbitrum needs repo wallet-mcp build with x402 patch                  |
| x402 tools missing on `arbitrum-sepolia`       | Stock AgentKit networks                | Use monorepo `agents/wallet-mcp` build, not bare npm, until Arbitrum patch is published                            |

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

For **AlphaGrid agent registration**, `X402ActionProvider_make_http_request_with_x402` to `POST {API}/agents/register` is the practical one-shot path once `SelfRegister` is signed.

**Arbitrum:** stock AgentKit x402 only enables Base + Solana. The repo's `agents/wallet-mcp` patches `arbitrum-sepolia` / `arbitrum-mainnet` before startup (`extendArbitrumX402.ts`). Published `@alphagrid/local-wallet-mcp` on npm may lack this until released — use a local `node build/index.js` build from the monorepo for Arbitrum x402.

Registration quote includes `registrationFee.tokenAddress` — payment must use that contract (matches `FeeManager.feeAsset()`), not AgentKit's default Base USDC.

Tool requires CDP API keys (`CDP_API_KEY_ID` + `CDP_API_KEY_SECRET` on `viem`, or `cdp` provider). Discover services with `discover_x402_services` on the **current** network only.

### EIP-712 signing (gap)

Wallet MCP exposes **no** `signTypedData` / EIP-712 tool. AlphaGrid registration and trades require off-MCP signing:

1. Sign `SelfRegister` and `OpenPosition` (etc.) with viem/ethers using the same `PRIVATE_KEY` as wallet MCP
2. Follow `contracts/docs/position-intent-eip712.md` and `api/src/lib/eip712-open-position.ts` (`exitsHash` for trades)

Until a dedicated signing tool ships, agents may run a short local viem script from `api/` (has `viem` in dependencies). Do not commit keys.

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
2. For **read-only** balances, `cast balance` and `cast call` on `registrationFee.tokenAddress` from a protocol quote are acceptable when MCP is down but the user needs a snapshot.
3. For **Robinhood testnet**, use RPC `https://rpc.testnet.chain.robinhood.com` with `cast` and chain id `46630`.

## AlphaGrid protocol (not this MCP)

Tradable symbols, vault mandates, quotes, registration, and trades live on the **protocol MCP** — see `.agents/skills/alphagrid-mcp/SKILL.md`.

| Need | Use protocol MCP / HTTP |
| ---- | ----------------------- |
| Vaults, allowlists, prices | `alphagrid_list_vaults`, `alphagrid_list_vault_tokens`, `alphagrid_get_prices` |
| Register + trade | `alphagrid_get_agent_registration_quote`, `alphagrid_register_agent`, `alphagrid_submit_trade_intent` |
| Open-position quote | **HTTP only:** `GET /agents/{id}/trade-intents/quote` (no MCP quote tool yet) |

Pyth equity tools here remain optional cross-checks only.

## Further reading

- `.agents/skills/alphagrid-mcp/SKILL.md` — registration and trade workflows
- `agents/wallet-mcp/README.md` — install, providers, `NETWORK_ID` table, tool list
- `docs/integrations/integrate.mdx` — two-MCP stack
- [AgentKit docs](https://docs.cdp.coinbase.com/agentkit/docs/welcome)
- [CDP](https://docs.cdp.coinbase.com/)
