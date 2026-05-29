# AlphaGrid Contracts

Foundry workspace for AlphaGrid smart contracts.

## Prerequisites

- [Foundry](https://book.getfoundry.sh/getting-started/installation) (`forge`, `cast`, `anvil`)

## Clone & dependencies

```bash
git clone <repo-url>
cd AlphaGrid
git submodule update --init --recursive
```

Dependencies are git submodules under `lib/` (see `.gitmodules` and `foundry.lock`).

## Commands

From repo root:

```bash
make test
make fmt
```

From `contracts/`:

```bash
# Build
forge build

# Test (default profile)
forge test
forge test -vvv

# Test (CI profile — more fuzz runs)
FOUNDRY_PROFILE=ci forge test

# Format
forge fmt
forge fmt --check

# Deploy mock token
cp .env.example .env   # fill PRIVATE_KEY, ROBINHOOD_RPC_URL
forge script script/DeployMockERC20.s.sol:DeployMockERC20 --rpc-url robinhood --broadcast
```

## Layout

```text
contracts/
├── foundry.toml
├── remappings.txt
├── src/
│   ├── core/                  # AgentRegistry, FeeManager, TrackRegistry
│   ├── vaults/                # ERC-4626 AlphaGridVault
│   ├── interfaces/
│   └── mocks/
│       └── MockERC20.sol
├── test/
│   ├── helpers/
│   │   └── BaseTest.sol       # Shared deployer, alice, bob, usdc (6 decimals)
│   └── mocks/
│       └── MockERC20.t.sol
├── script/
│   └── DeployMockERC20.s.sol
└── lib/
    ├── forge-std/
    └── openzeppelin-contracts/
```

## RPC endpoints

Configured in `foundry.toml` (env vars in `.env.example`):

```bash
forge script script/DeployMockERC20.s.sol:DeployMockERC20 --rpc-url robinhood --broadcast
forge script script/DeployMockERC20.s.sol:DeployMockERC20 --rpc-url local --broadcast
```

## CI

GitHub Actions runs on changes under `contracts/`:

- `forge fmt --check`
- `forge build --sizes`
- `forge test` (with `[profile.ci]`)

Workflow: `.github/workflows/contracts.yml` at repo root.

## Current scope

Minimal starter: **MockERC20** with Forge tests. Protocol contracts will be added under `src/` as the PRD is implemented.
