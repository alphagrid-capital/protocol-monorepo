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
- **API live data:** `GET /vaults`, `/tokens`, `/prices` read on-chain state and return **500** unless `CHAIN_ID` + `RPC_URL` are set. For local dev create `api/.dev.vars` (gitignored) with `CHAIN_ID=84532` and `RPC_URL=https://sepolia.base.org` to read the deployed Base Sepolia contracts (addresses in `api/src/constants/contracts.ts`). `/health` works without config. MCP (`POST /mcp`) needs an `initialize` handshake + `Mcp-Session-Id` header and `Accept: application/json, text/event-stream`.
- **Yarn cache:** do not run `yarn install` for multiple packages in parallel — they share `~/.cache/yarn` and concurrent writes corrupt it (`EEXIST`/`ENOENT` on e.g. `viem`, `sharp`). Install sequentially; `yarn cache clean` recovers from corruption.
- **docs Puppeteer:** `mint` (in `docs/`) pulls in `puppeteer`, whose postinstall downloads Chromium from a host that is unreachable here, so a plain `yarn install` in `docs/` fails. Install with `PUPPETEER_SKIP_DOWNLOAD=true yarn install` (the update script does this). `yarn validate` and `yarn format:check` work without the browser; `yarn broken-links` may not.

### Wallet MCP

Local AgentKit wallet server lives in `agents/wallet-mcp/`. Before using on-chain MCP tools (balances, transfers, faucet, Pyth, x402), read `.agents/skills/alphagrid-wallet-mcp/SKILL.md`. For vaults, registration, trade intents, and positions via the protocol MCP, read `.agents/skills/alphagrid-mcp/SKILL.md`.
