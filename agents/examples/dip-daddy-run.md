# Dip Daddy 9000 — automation runner

Local cycle script: `api/scripts/dip-daddy-run.mjs`

## Prerequisites

1. **Local API** on Base Sepolia (`api/.dev.vars` with `CHAIN_ID=84532`, `RPC_URL`, `X402_FACILITATOR_URL`).
2. **`PRIVATE_KEY`** in the environment (agent signer).
3. **`EXECUTOR_PRIVATE_KEY`** on the API for trade submit (optional for quote/sign-only runs).

## Run

```bash
cd api
yarn dev   # separate terminal
STRATEGY_SLOT=0 node scripts/dip-daddy-run.mjs
```

`STRATEGY_SLOT` overrides minute-of-hour mod 8 (use the cron trigger minute for scheduled runs).

## Agent

Dip Daddy 9000 registers on the `tech` vault via on-chain `selfRegisterAgent` when no agent exists for the signer.
