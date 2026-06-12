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
│   └── mocks/                      # MockERC20, MockPriceOracle
├── test/
│   ├── core/
│   ├── vaults/
│   ├── integration/                # Agent, vault, and trading flow integration tests
│   └── helpers/                    # BaseTest, TradingTestBase
└── script/
    ├── helpers/                    # DeploymentEnv, AgentCoreDeploy, VaultDeploy, DeploymentArtifacts
    ├── config/                     # VaultTrackPolicies, Fees, TokenCatalog
    ├── ops/                        # SetRegistrationFee, DepositToGenesisVault, EnableGenesisVaultTokens
    ├── DeployAgentCore.s.sol
    ├── DeployVaultInfrastructure.s.sol
    ├── DeployFullStack.s.sol       # dev-complete greenfield orchestrator
    ├── DeployTrading.s.sol
    ├── DeployPriceOracle.s.sol
    ├── DeployTokenCatalog.s.sol
    └── DeployMockERC20.s.sol
```

## Deployment

Shared logic lives in `script/helpers/` and `script/config/`. Entry scripts are thin wrappers with a **deploy → wire → setRoles** (or configure) pipeline.

`DeployMockERC20` is deploy-only. `DeployAgentCore` and `DeployVaultInfrastructure` grant `REGISTRAR_ROLE` to `BACKEND_RELAYER` via `AgentCoreDeploy`.

Copy `.env.example` to `.env` and fill values.

### Dev-complete greenfield (testnet/anvil)

```bash
forge script script/DeployFullStack.s.sol:DeployFullStack --rpc-url $RPC_URL --broadcast
```

Deploys core + vaults + track config + trading + oracle + mock token catalog in one broadcast. Writes `deployments/<chainId>.json`. `FEE_ASSET` (x402 USDC) and `VAULT_ASSET` (Mocked Stable for vaults/trading) are separate; legacy `USDC` sets both. When `VAULT_ASSET` is unset, deploys `mSTBL`. For production, use staged scripts below.

### Staged deploy (incremental / mainnet)

```bash
# Agent onboarding only
forge script script/DeployAgentCore.s.sol:DeployAgentCore --rpc-url $RPC_URL --broadcast

# Greenfield: agent core + Genesis vault + allocation + track configs
forge script script/DeployVaultInfrastructure.s.sol:DeployVaultInfrastructure --rpc-url $RPC_URL --broadcast

# Set registration fee to 0.1 USDC on FeeManager
forge script script/ops/SetRegistrationFee.s.sol:SetRegistrationFee --rpc-url $RPC_URL --broadcast

# Trading: position manager, trade router, swap adapter
forge script script/DeployTrading.s.sol:DeployTrading --rpc-url $RPC_URL --broadcast

# Token catalog: MockPriceOracle + mock stocks + vault allowlists
forge script script/DeployPriceOracle.s.sol:DeployPriceOracle --rpc-url $RPC_URL --broadcast
forge script script/DeployTokenCatalog.s.sol:DeployTokenCatalog --rpc-url $RPC_URL --broadcast
```

See [`deployments/README.md`](deployments/README.md) and [`../api/src/contracts/token-catalog.json`](../api/src/contracts/token-catalog.json).

### Enable all tokens on an existing Genesis vault

Use when the vault was deployed with a subset allowlist (e.g. former Tech vault with 5 stocks) and you want all 8 mock stocks enabled without redeploying.

**Prerequisites**

1. Mock stocks are registered and active in `TokenRegistry` (from `DeployTokenCatalog` or equivalent).
2. Broadcaster (`PRIVATE_KEY`) holds `VAULT_ADMIN_ROLE` on `GENESIS_VAULT` (typically the deploy `ADMIN`).
3. `deployments/<chainId>.json` exists with `tokens.NVDA` … `tokens.SPY` (or set `DEPLOYMENT_ARTIFACT`).

**Arbitrum Sepolia (421614)** — former Tech vault, now Genesis:

```bash
cd contracts
# .env: PRIVATE_KEY, RPC_URL, GENESIS_VAULT=0xa1291D77Eec59c1BE7dd30D0D7e50D659f1C5a84

forge script script/ops/EnableGenesisVaultTokens.s.sol:EnableGenesisVaultTokens \
  --rpc-url $RPC_URL --broadcast
```

Dry-run first (omit `--broadcast`). The script skips tokens already on the allowlist and only calls `enableToken` for missing ones (typically `AAPL`, `HOOD`, `SPY` on the legacy Tech vault).

Verify on-chain:

```bash
cast call $GENESIS_VAULT "allowedTokenCount()(uint256)" --rpc-url $RPC_URL
# expect 8
```

`DeployTrading` env vars: `ADMIN`, `EXECUTOR`, `OPERATOR` (optional), `AGENT_REGISTRY`, `ALLOCATION_MANAGER`, `VAULT_TRACK_REGISTRY`, `GENESIS_VAULT`, `DEPLOY_MOCK_SWAP_ADAPTER`.

- `DEPLOY_MOCK_SWAP_ADAPTER=true` — test/dev adapter (mints mock tokens)
- `DEPLOY_MOCK_SWAP_ADAPTER=false` — `InventorySwapAdapter` (pre-funded ERC-20 inventory)

`DeployTrading` grants `EXECUTOR` / `OPERATOR` on `TradeRouter`, and grants `TRADE_ROUTER_ROLE` on each mandate vault and on `AllocationManager`.

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
