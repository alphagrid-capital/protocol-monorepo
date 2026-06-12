# AlphaGrid Local Wallet MCP

Local [Model Context Protocol](https://modelcontextprotocol.io/quickstart/server) server that exposes [AgentKit](https://github.com/coinbase/agentkit) wallet and on-chain tools to MCP clients (Claude Desktop, Cursor, etc.).

Published on npm as [`@alphagrid/local-wallet-mcp`](https://www.npmjs.com/package/@alphagrid/local-wallet-mcp).

This is not a trading agent. It is a **local MCP wallet** — a stdio MCP server you run on your machine so AI clients can read balances, transfer tokens, and call on-chain actions through a wallet you control. Other agents and assistants attach to it via MCP; nothing is hosted remotely unless you choose the CDP smart-wallet provider.

**Not for production.** Use your own key management or a third-party agent wallet for agents holding real capital. Private keys and API secrets are set in your MCP client config (`env`), never in the package.

## Install (recommended)

No global install required. Merge `mcp.config.example.json` into your MCP client config:

**Cursor** — `.cursor/mcp.json` in your project or user settings.

**Claude Desktop** — `~/Library/Application Support/Claude/claude_desktop_config.json`

### Local private key (`viem`)

**Why choose this:**

- No Coinbase Developer Platform account — fastest setup for local testing with a testnet key.
- Supports custom chains (e.g. `robinhood-testnet`) that CDP smart wallets do not.

```json
{
  "mcpServers": {
    "alphagrid-local-wallet-mcp": {
      "command": "npx",
      "args": ["-y", "@alphagrid/local-wallet-mcp"],
      "env": {
        "WALLET_PROVIDER": "viem",
        "NETWORK_ID": "arbitrum-sepolia",
        "PRIVATE_KEY": "0x..."
      }
    }
  }
}
```

Optional: add `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` to unlock faucet and x402 tools while staying on `viem`.

### CDP smart wallet (`cdp`)

**Why choose this:**

- No raw private key in MCP config — signing uses CDP API credentials and a wallet secret.
- Smart-wallet features on supported networks: gas sponsorship (`PAYMASTER_URL`), faucet, and x402 without extra setup.

```json
{
  "mcpServers": {
    "alphagrid-local-wallet-mcp": {
      "command": "npx",
      "args": ["-y", "@alphagrid/local-wallet-mcp"],
      "env": {
        "WALLET_PROVIDER": "cdp",
        "NETWORK_ID": "arbitrum-sepolia",
        "CDP_API_KEY_ID": "...",
        "CDP_API_KEY_SECRET": "...",
        "CDP_WALLET_SECRET": "..."
      }
    }
  }
}
```

Set `NETWORK_ID` (see options below). Restart the MCP server in your client after changing config.

## Wallet providers

Set `WALLET_PROVIDER` in env:

| Value            | Description                                                                            |
| ---------------- | -------------------------------------------------------------------------------------- |
| `viem` (default) | Local key via viem; optional CDP API actions if API keys are set                       |
| `cdp`            | CDP smart wallet; requires `CDP_API_KEY_ID`, `CDP_API_KEY_SECRET`, `CDP_WALLET_SECRET` |

### `NETWORK_ID`

Required for `viem`. Defaults to `arbitrum-sepolia` for `cdp`.

| `NETWORK_ID`        | Chain                   |
| ------------------- | ----------------------- |
| `ethereum-mainnet`  | Ethereum                |
| `ethereum-sepolia`  | Ethereum Sepolia        |
| `polygon-mainnet`   | Polygon                 |
| `polygon-mumbai`    | Polygon Mumbai          |
| `base-mainnet`      | Base                    |
| `base-sepolia`      | Base Sepolia            |
| `arbitrum-mainnet`  | Arbitrum One            |
| `arbitrum-sepolia`  | Arbitrum Sepolia        |
| `optimism-mainnet`  | Optimism                |
| `optimism-sepolia`  | Optimism Sepolia        |
| `robinhood-testnet` | Robinhood Chain Testnet |

Configuration lives in `src/getAgentKit.ts` and `src/wallets/`. MCP server wiring is in `src/index.ts`.

## Tools exposed

| Category         | Tool                                              | Purpose                                             |
| ---------------- | ------------------------------------------------- | --------------------------------------------------- |
| Wallet           | `WalletActionProvider_get_wallet_details`         | Address, network, native ETH/SOL balance            |
| Wallet           | `WalletActionProvider_native_transfer`            | Send native ETH (or SOL on Solana)                  |
| ERC20            | `ERC20ActionProvider_get_balance`                 | Token balance (defaults to your wallet)             |
| ERC20            | `ERC20ActionProvider_transfer`                    | Send ERC20 (e.g. USDC)                              |
| ERC20            | `ERC20ActionProvider_approve`                     | Approve a spender                                   |
| ERC20            | `ERC20ActionProvider_get_allowance`               | Check allowance for a spender                       |
| ERC20            | `ERC20ActionProvider_get_erc20_token_address`     | Resolve symbol → contract address                   |
| Faucet           | `CdpApiActionProvider_request_faucet_funds`       | Test ETH/USDC/etc. on base-sepolia or solana-devnet |
| WETH             | `WethActionProvider_wrap_eth`                     | Wrap ETH → WETH                                     |
| WETH             | `WethActionProvider_unwrap_eth`                   | Unwrap WETH → ETH                                   |
| Pyth             | `PythActionProvider_fetch_price_feed`             | Symbol → Pyth price feed ID                         |
| Pyth             | `PythActionProvider_fetch_price`                  | Price for a feed ID                                 |
| x402 (paid HTTP) | `X402ActionProvider_make_http_request`            | HTTP call; returns 402 payment details if needed    |
| x402 (paid HTTP) | `X402ActionProvider_retry_http_request_with_x402` | Retry with payment after 402                        |
| x402 (paid HTTP) | `X402ActionProvider_make_http_request_with_x402`  | One-step paid request (no confirmation)             |
| x402 (paid HTTP) | `X402ActionProvider_discover_x402_services`       | List x402 APIs on the current network               |

Faucet, x402, and some CDP actions require `CDP_API_KEY_ID` and `CDP_API_KEY_SECRET` (available with `viem` or required for `cdp`).

### Arbitrum x402 (AlphaGrid)

Stock AgentKit only registers x402 tools on Base and Solana. This server patches AgentKit at startup (`src/agentkit/extendArbitrumX402.ts`) so x402 works on **`arbitrum-sepolia`** and **`arbitrum-mainnet`** (`eip155:421614` / `eip155:42161`), matching AlphaGrid API registration. It also maps **USDC** on Arbitrum Sepolia to the AlphaGrid mock token (`0x54A4…60FA`).

Use `NETWORK_ID=arbitrum-sepolia` with CDP API keys, rebuild (`yarn build`), and restart the MCP server in Cursor.

## Development and publishing

From this directory:

```sh
yarn install
yarn build
```

For local iteration without publishing, point `args` at `build/index.js` with `"command": "node"` instead of `npx`.

### Releases

1. Bump `version` in `package.json`.
2. Commit and tag: `local-wallet-mcp-vX.Y.Z` (tag must match package version).
3. Push the tag — CI publishes via `.github/workflows/wallet-mcp.yml` (requires repo secret **`NPM_TOKEN`**).

### Manual publish

```sh
yarn install --frozen-lockfile
yarn build
npm publish --access public
```

## Learn more

- [AgentKit](https://docs.cdp.coinbase.com/agentkit/docs/welcome)
- [CDP](https://docs.cdp.coinbase.com/)
- [AlphaGrid docs — Local wallet MCP](https://docs.alphagrid.capital/agents/register#agent-signer)
