# On-chain deployment artifacts

Record addresses after broadcasting deploy scripts. Update `config/token-catalog.json` (`chains.<chainId>`) and `api/src/constants/contracts.ts` from the generated artifact.

## Artifact file

`DeployFullStack` writes `deployments/<chainId>.json` (gitignored). See [`421614.example.json`](421614.example.json) for the schema.

| Field | Description |
|-------|-------------|
| `chainId` | Broadcast chain ID |
| `deployedAt` | Unix timestamp at write time |
| `FeeManager` … `SwapAdapter` | Core contract addresses (matches `ChainContracts` in API) |
| `usdc` | Fee asset / vault underlying |
| `tokens` | Mock stock addresses keyed by symbol (`NVDA`, `META`, …) |

## Dev-complete greenfield

Single broadcast for testnet/anvil — deploys mock USDC when `USDC` env is unset:

```bash
cd contracts
forge script script/DeployFullStack.s.sol:DeployFullStack \
  --rpc-url $RPC_URL --broadcast
```

Required env: `ADMIN`, `TREASURY`, `BACKEND_RELAYER`, `ERC8004_IDENTITY_REGISTRY`, `EXECUTOR`. Optional: `USDC`, `OPERATOR`, `ORACLE_KEEPER`, `DEPLOY_MOCK_SWAP_ADAPTER`.

Copy logged addresses into `config/token-catalog.json` and `api/src/constants/contracts.ts`.

## Staged deploy (production)

Use individual scripts in order:

```bash
forge script script/DeployVaultInfrastructure.s.sol:DeployVaultInfrastructure --rpc-url $RPC_URL --broadcast
forge script script/ops/SetRegistrationFee.s.sol:SetRegistrationFee --rpc-url $RPC_URL --broadcast
forge script script/DeployTrading.s.sol:DeployTrading --rpc-url $RPC_URL --broadcast
forge script script/DeployPriceOracle.s.sol:DeployPriceOracle --rpc-url $RPC_URL --broadcast
forge script script/DeployTokenCatalog.s.sol:DeployTokenCatalog --rpc-url $RPC_URL --broadcast
```

## Arbitrum Sepolia (421614) — token catalog only

When core infra already exists:

```bash
forge script script/DeployPriceOracle.s.sol:DeployPriceOracle --rpc-url $RPC_URL --broadcast
forge script script/DeployTokenCatalog.s.sol:DeployTokenCatalog --rpc-url $RPC_URL --broadcast
```

## Robinhood testnet (46630)

Same script order once `TOKEN_REGISTRY`, vaults, and USDC are deployed on chain 46630.
