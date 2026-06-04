# On-chain deployment artifacts

Record addresses after broadcasting token-catalog scripts. Update `config/token-catalog.json` (`chains.<chainId>`) and `api/src/constants/contracts.ts` (`PriceOracle`, per-token addresses in catalog).

## Base Sepolia (84532) — token catalog

**Note:** `TokenRegistry` ABI changed (global `priceOracle`). Redeploy `TokenRegistry` or deploy a fresh stack before running these scripts.

```bash
cd contracts
# 1. Deploy oracle and wire registry
forge script script/DeployPriceOracle.s.sol:DeployPriceOracle \
  --rpc-url $RPC_URL --broadcast

# 2. Deploy mock stocks, register in TokenRegistry, enable per vault (no on-chain prices)
forge script script/DeployTokenCatalog.s.sol:DeployTokenCatalog \
  --rpc-url $RPC_URL --broadcast
```

Copy logged addresses into `config/token-catalog.json` and `api/src/constants/contracts.ts`.

## Robinhood testnet (46630)

Same script order once `TOKEN_REGISTRY`, vaults, and USDC are deployed on chain 46630.
