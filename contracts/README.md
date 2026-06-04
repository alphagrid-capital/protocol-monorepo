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
│   ├── core/                       # AgentRegistry, VaultTrackRegistry, FeeManager,
│   │                               # AllocationManager, TokenRegistry,
│   │                               # PositionManager, TradeRouter
│   ├── vaults/                     # MandateVault (ERC-4626), MandateVaultFactory
│   ├── adapters/                   # MockSwapAdapter, InventorySwapAdapter
│   ├── interfaces/
│   ├── libraries/                  # OracleLib
│   └── mocks/                      # MockERC20
├── test/
│   ├── core/
│   ├── vaults/
│   ├── integration/                # Agent, vault, and trading flow integration tests
│   └── helpers/                    # BaseTest, TradingTestBase
└── script/
    ├── DeployAgentCore.s.sol
    ├── DeployVaultInfrastructure.s.sol
    ├── DeployTrading.s.sol
    └── DeployMockERC20.s.sol
```

## Deployment

Deploy scripts share a **deploy → wire → setRoles** pipeline inside `run()`:

| Step | Purpose |
|------|---------|
| `_deploy` | `new` contracts only |
| `_wire` | Cross-contract setters (registry links, adapter/router, fees) |
| `_setRoles` | `grantRole` on deployed or existing contracts |

`DeployMockERC20` is deploy-only. `DeployAgentCore` and `DeployVaultInfrastructure` grant `REGISTRAR_ROLE` to `BACKEND_RELAYER` in `setRoles`.

Copy `.env.example` to `.env` and fill values. Deploy in order:

```bash
# Agent onboarding only (incremental)
forge script script/DeployAgentCore.s.sol:DeployAgentCore --rpc-url $RPC_URL --broadcast

# Greenfield: agent core + four vaults + allocation (full base stack)
forge script script/DeployVaultInfrastructure.s.sol:DeployVaultInfrastructure --rpc-url $RPC_URL --broadcast

# Trading: position manager, trade router, swap adapter (on existing vault stack)
forge script script/DeployTrading.s.sol:DeployTrading --rpc-url $RPC_URL --broadcast
```

`DeployTrading` env vars: `ADMIN`, `EXECUTOR`, `OPERATOR` (optional), `AGENT_REGISTRY`, `ALLOCATION_MANAGER`, `TRACK_CONFIG`, `VAULT`, `DEPLOY_MOCK_SWAP_ADAPTER`.

- `DEPLOY_MOCK_SWAP_ADAPTER=true` — test/dev adapter (mints mock tokens)
- `DEPLOY_MOCK_SWAP_ADAPTER=false` — `InventorySwapAdapter` (pre-funded ERC-20 inventory)

`DeployTrading` `setRoles` grants `EXECUTOR` / `OPERATOR` on `TradeRouter` and `TRADE_ROUTER_ROLE` on the env `VAULT` and `AllocationManager`. Repeat `DeployTrading` with a different `VAULT` for additional vaults.

## Vault deployment

Vaults deploy as **EIP-1167 minimal clones** via `MandateVaultFactory` (not centrally upgradeable):

1. One `MandateVault` **implementation** is constructed with the shared ERC-4626 asset (USDC).
2. Each `deployVault` call clones that implementation and runs `initialize` for mandate, share metadata, token registry, and admin roles.

`VAULT_NAME` and `TOKEN_REGISTRY` live in clone storage (not constructor immutables). OpenZeppelin `ERC4626` still stores the underlying asset as an **implementation immutable**, so every clone shares the same asset address baked in at implementation deploy time (USDC for AlphaGrid).

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
