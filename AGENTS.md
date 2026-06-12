# AlphaGrid - Agent Instructions

## Cursor Cloud specific instructions

### Project overview

AlphaGrid is a monorepo: Foundry smart contracts in `contracts/`, an HTTP API in `api/` (Cloudflare Workers), and public Mintlify docs in `docs/`. See `README.md`, `contracts/README.md`, `api/README.md`, and `docs/README.md` for commands.

### Prerequisites

- **Foundry** (`forge`, `cast`, `anvil`, `chisel`) — installed via `foundryup`. Binaries live in `~/.foundry/bin` and must be on `$PATH`.
- **Git submodules** (`forge-std`, `openzeppelin-contracts`) under `contracts/lib/` — initialized via `git submodule update --init --recursive`.
- **Node.js 24** (via nvm, `nvm alias default 24`) for all JS packages — version is pinned by the root `.nvmrc` (`24`), `engines` (`>=24`), and CI (`node-version-file: .nvmrc`). **Yarn 1.x** is provided via corepack. The update script runs `yarn install` in each JS package + submodule init.

### Key commands (run from repo root)

| Action | Command |
|--------|---------|
| Build | `make build` |
| Test | `make test` |
| Test (CI profile, more fuzz runs) | `make ci-test` |
| Format check | `make fmt-check` |
| Format fix | `make fmt` |

All make targets `cd` into `contracts/` automatically.

### JavaScript packages (run from each package dir)

| Package | Lint/check | Run (dev) | Port |
|---------|-----------|-----------|------|
| `api/` | `yarn type-check` (also `yarn lint:ts`) | `yarn dev` (wrangler dev) | `http://localhost:8787` |
| `agents/wallet-mcp/` | `yarn type-check`, `yarn build` | `yarn dev` (stdio MCP) | stdio |
| `docs/` | `yarn format:check`, `yarn validate`, `yarn broken-links` | `yarn dev` (`mint dev`) | `http://localhost:3000` |

### Gotchas

- `forge` must be on `$PATH`. If not found, run `export PATH="$HOME/.foundry/bin:$PATH"`.
- Submodules must be initialized before any `forge build` or `forge test` succeeds. If `contracts/lib/forge-std/` is empty, run `git submodule update --init --recursive`.
- The `.env.example` in `contracts/` lists optional RPC/deploy keys. These are only needed for on-chain deployment scripts, not for local build/test.
- `foundry.toml` targets Solidity `0.8.30` with EVM version `cancun`.
- **Node version:** a baseline `node` (v22) sits first on `$PATH` and wins over nvm. Interactive login shells source `~/.bashrc` → nvm → Node 24, so `bash -lc '...'` (and tmux login shells) get Node 24. In a non-login shell, prepend it explicitly: `export PATH="$HOME/.nvm/versions/node/v24.16.0/bin:$PATH"`. `wrangler dev`, `mint dev`, and `tsx` require Node 24.
- **API live data:** `GET /vaults`, `/tokens`, `/prices` read on-chain state and return **500** unless `CHAIN_ID` + `RPC_URL` are set. The API deploys as **one Cloudflare Worker per chain** (`arbitrum-sepolia`, `robinhood-testnet`, `arbitrum-one` in `api/wrangler.toml`). For local dev: `yarn dev:arbitrum-sepolia` and `api/.dev.vars` with `RPC_URL` (chain vars come from the Wrangler env). Contract addresses in `api/src/constants/contracts.ts`. `/health` works without config. MCP (`POST /mcp`) needs an `initialize` handshake + `Mcp-Session-Id` header and `Accept: application/json, text/event-stream`.
- **Yarn cache:** do not run `yarn install` for multiple packages in parallel — they share `~/.cache/yarn` and concurrent writes corrupt it (`EEXIST`/`ENOENT` on e.g. `viem`, `sharp`). Install sequentially; `yarn cache clean` recovers from corruption.
- **docs Puppeteer:** `mint` (in `docs/`) pulls in `puppeteer`, whose postinstall downloads Chromium from a host that is unreachable here, so a plain `yarn install` in `docs/` fails. Install with `PUPPETEER_SKIP_DOWNLOAD=true yarn install` (the update script does this). `yarn validate` and `yarn format:check` work without the browser; `yarn broken-links` may not.

### Wallet MCP

Local AgentKit wallet server lives in `agents/wallet-mcp/`. Before using on-chain MCP tools (balances, transfers, faucet, Pyth, x402), read `.agents/skills/alphagrid-wallet-mcp/SKILL.md`. For vaults, registration, trade intents, and positions via the protocol MCP, read `.agents/skills/alphagrid-mcp/SKILL.md`.

- **Cursor wiring:** `.cursor/mcp.json` registers `alphagrid-local-wallet-mcp` using the published npm package (`npx -y @alphagrid/local-wallet-mcp`, the preferred "remote" source). Secrets are passed by `${env:...}` reference, never inlined — `PRIVATE_KEY` and `NETWORK_ID` are injected as VM secrets (currently an Arbitrum Sepolia network, chainId `421614`); `CDP_API_KEY_ID/SECRET` + `CDP_WALLET_SECRET` are optional and, if added, unlock the faucet + x402 tools (without them `viem` exposes 9 tools: wallet, ERC20, Pyth — no faucet/x402).
- **Local fallback:** `cd agents/wallet-mcp && yarn build`, then run `node /workspace/agents/wallet-mcp/build/index.js` (point `.cursor/mcp.json` `command` at `node` with that path). The published build already includes the Arbitrum x402 patch.
- **npx gotchas (non-obvious):** do NOT launch `npx -y @alphagrid/local-wallet-mcp` with the working directory set to `agents/wallet-mcp/` — npx resolves the bin against the local package of the same name and dies with `sh: local-wallet-mcp: not found`. Launch from the repo root / any neutral dir (Cursor spawns from the workspace root, so its config is fine). A stale `~/.npm/_npx` cache (e.g. carried in a VM snapshot) causes the same `not found` error; `rm -rf ~/.npm/_npx` and let npx reinstall fixes it.
