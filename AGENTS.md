# AlphaGrid - Agent Instructions

## Cursor Cloud specific instructions

### Project overview

AlphaGrid is a Foundry/Solidity smart-contract workspace. The only runnable code lives in `contracts/`. See `README.md` and `contracts/README.md` for standard commands.

### Prerequisites

- **Foundry** (`forge`, `cast`, `anvil`, `chisel`) — installed via `foundryup`. Binaries live in `~/.foundry/bin` and must be on `$PATH`.
- **Git submodules** (`forge-std`, `openzeppelin-contracts`) under `contracts/lib/` — initialized via `git submodule update --init --recursive`.

### Key commands (run from repo root)

| Action | Command |
|--------|---------|
| Build | `make build` |
| Test | `make test` |
| Test (CI profile, more fuzz runs) | `make ci-test` |
| Format check | `make fmt-check` |
| Format fix | `make fmt` |

All make targets `cd` into `contracts/` automatically.

### Gotchas

- `forge` must be on `$PATH`. If not found, run `export PATH="$HOME/.foundry/bin:$PATH"`.
- Submodules must be initialized before any `forge build` or `forge test` succeeds. If `contracts/lib/forge-std/` is empty, run `git submodule update --init --recursive`.
- The `.env.example` in `contracts/` lists optional RPC/deploy keys. These are only needed for on-chain deployment scripts, not for local build/test.
- `foundry.toml` targets Solidity `0.8.30` with EVM version `cancun`.
