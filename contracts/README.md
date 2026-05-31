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
forge build
forge test
forge test -vvv
FOUNDRY_PROFILE=ci forge test
forge fmt
forge fmt --check
```

## Layout

```text
contracts/
├── foundry.toml
├── docs/
│   └── position-intent-eip712.md   # Off-chain signing schema for opens
├── src/
│   ├── core/                       # AgentRegistry, TrackConfig, FeeManager,
│   │                               # AllocationManager, TokenRegistry,
│   │                               # PositionManager, TradeRouter
│   ├── vaults/                     # AlphaGridVault (ERC-4626)
│   ├── adapters/                   # MockSwapAdapter, InventorySwapAdapter
│   ├── interfaces/
│   ├── libraries/                  # OracleLib
│   └── mocks/                      # MockERC20
├── test/
│   ├── core/
│   ├── vaults/
│   ├── integration/                # Phase1–3 integration tests
│   └── helpers/                    # BaseTest, Phase3Base
└── script/
    ├── DeployPhase1.s.sol
    ├── DeployPhase2.s.sol
    ├── DeployPhase3.s.sol
    ├── DeployAgentRegistry.s.sol
    └── DeployMockERC20.s.sol
```

## Deployment

Copy `.env.example` to `.env` and fill values. Deploy in order:

```bash
# Phase 1 — registry, fees, track config
forge script script/DeployPhase1.s.sol:DeployPhase1 --rpc-url $RPC_URL --broadcast

# Phase 2 — token registry, allocation manager, four vaults
forge script script/DeployPhase2.s.sol:DeployPhase2 --rpc-url $RPC_URL --broadcast

# Phase 3 — position manager, trade router, swap adapter
forge script script/DeployPhase3.s.sol:DeployPhase3 --rpc-url $RPC_URL --broadcast
```

Phase 3 env vars: `ADMIN`, `EXECUTOR`, `OPERATOR` (optional), `AGENT_REGISTRY`, `ALLOCATION_MANAGER`, `TRACK_CONFIG`, `VAULT`, `DEPLOY_MOCK_SWAP_ADAPTER`.

- `DEPLOY_MOCK_SWAP_ADAPTER=true` — test/dev adapter (mints mock tokens)
- `DEPLOY_MOCK_SWAP_ADAPTER=false` — `InventorySwapAdapter` (pre-funded ERC-20 inventory)

Grant `TRADE_ROUTER_ROLE` on each vault and wire `OPERATOR` / `EXECUTOR` as needed.

## Swap adapters

| Adapter | Use case |
|---------|----------|
| `MockSwapAdapter` | Local tests; oracle-priced minting |
| `InventorySwapAdapter` | Production-style; operator funds adapter USDC/token balances |

Both implement `ISwapAdapter`. TradeRouter pulls vault assets to the adapter, then calls swap functions in the same transaction.

## Agent intents

See [docs/position-intent-eip712.md](docs/position-intent-eip712.md) for the `OpenPosition` EIP-712 schema used by executors.

## CI

GitHub Actions (`.github/workflows/contracts.yml`): `forge fmt --check`, `forge build --sizes`, `forge test` with `[profile.ci]`.
