# AlphaGrid Wallet MCP Server

Local [Model Context Protocol](https://modelcontextprotocol.io/quickstart/server) server that exposes [AgentKit](https://github.com/coinbase/agentkit) wallet and on-chain tools to MCP clients (Claude Desktop, Cursor, etc.).

This is not a trading agent. It is a **local MCP wallet** — a stdio MCP server you run on your machine so AI clients can read balances, transfer tokens, and call on-chain actions through a wallet you control. Other agents and assistants attach to it via MCP; nothing is hosted remotely unless you choose the CDP smart-wallet provider.

## Getting Started

From this directory:

```sh
yarn install
yarn build
```

Copy `mcp.config.example.json` into your MCP client config. Set env vars as needed (`WALLET_PROVIDER=viem` by default; use `cdp` with CDP keys). Update the `args` path to this project's `build/index.js`.

**Claude Desktop** — merge the `mcpServers` entry into:

`~/Library/Application Support/Claude/claude_desktop_config.json`

**Cursor** — merge into `.cursor/mcp.json` in your project or user settings.

## Wallet providers

Set `WALLET_PROVIDER` in env:

| Value | Description |
|-------|-------------|
| `viem` (default) | Local key via viem; optional CDP API actions if API keys are set |
| `cdp` | CDP smart wallet; requires `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET` |

Configuration lives in `src/getAgentKit.ts` and `src/wallets/`. MCP server wiring is in `src/index.ts`.

## Tools exposed

| Category | Tool | Purpose |
|----------|------|---------|
| Wallet | `WalletActionProvider_get_wallet_details` | Address, network, native ETH/SOL balance |
| Wallet | `WalletActionProvider_native_transfer` | Send native ETH (or SOL on Solana) |
| ERC20 | `ERC20ActionProvider_get_balance` | Token balance (defaults to your wallet) |
| ERC20 | `ERC20ActionProvider_transfer` | Send ERC20 (e.g. USDC) |
| ERC20 | `ERC20ActionProvider_approve` | Approve a spender |
| ERC20 | `ERC20ActionProvider_get_allowance` | Check allowance for a spender |
| ERC20 | `ERC20ActionProvider_get_erc20_token_address` | Resolve symbol → contract address |
| Faucet | `CdpApiActionProvider_request_faucet_funds` | Test ETH/USDC/etc. on base-sepolia or solana-devnet |
| WETH | `WethActionProvider_wrap_eth` | Wrap ETH → WETH |
| WETH | `WethActionProvider_unwrap_eth` | Unwrap WETH → ETH |
| Pyth | `PythActionProvider_fetch_price_feed` | Symbol → Pyth price feed ID |
| Pyth | `PythActionProvider_fetch_price` | Price for a feed ID |
| x402 (paid HTTP) | `X402ActionProvider_make_http_request` | HTTP call; returns 402 payment details if needed |
| x402 (paid HTTP) | `X402ActionProvider_retry_http_request_with_x402` | Retry with payment after 402 |
| x402 (paid HTTP) | `X402ActionProvider_make_http_request_with_x402` | One-step paid request (no confirmation) |
| x402 (paid HTTP) | `X402ActionProvider_discover_x402_services` | List x402 APIs on the current network |

Faucet, x402, and some CDP actions require `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` (available with `viem` or required for `cdp`).

## Learn more

- [AgentKit](https://docs.cdp.coinbase.com/agentkit/docs/welcome)
- [CDP](https://docs.cdp.coinbase.com/)
