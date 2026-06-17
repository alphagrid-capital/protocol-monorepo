# AlphaGrid Subgraph

The Graph indexer for AlphaGrid protocol stats: agents, allocations, positions, and trade activity.

Indexed chains (Subgraph Studio):

| Network | Studio slug | Graph network |
| --- | --- | --- |
| Arbitrum Sepolia | `alphagrid-protocol-subgraph-arbitrum-sepolia` | `arbitrum-sepolia` |
| Arbitrum One | `alphagrid-protocol-subgraph-arbitrum-one` | `arbitrum-one` |

Unsupported chains (Robinhood testnet, Base Sepolia) keep the API RPC scan fallback when `SUBGRAPH_URL` is unset.

## Prerequisites

- Node.js 24+
- Yarn 1.x
- Foundry build artifacts (`make build` from repo root)

## Commands

```bash
# From repo root
make subgraph-build    # forge build + ABI sync + codegen + compile
make subgraph-test     # Matchstick unit tests

# From subgraph/
yarn codegen
yarn build
yarn test
```

## Network config

Contract addresses and `startBlock` values are generated from deployment artifacts:

```bash
node scripts/generate-subgraph-networks.mjs
```

Output: [`networks.json`](networks.json). The default [`subgraph.yaml`](subgraph.yaml) template targets Arbitrum Sepolia; build for another network with:

```bash
graph build --network arbitrum-one
```

## Deploy (Subgraph Studio)

1. Create two subgraphs in [Subgraph Studio](https://thegraph.com/studio/): `alphagrid-protocol-subgraph-arbitrum-sepolia` and `alphagrid-protocol-subgraph-arbitrum-one`.
2. Authenticate: `graph auth $DEPLOY_KEY`
3. Deploy:

```bash
cd subgraph
yarn deploy:arbitrum-sepolia
yarn deploy:arbitrum-one
```

4. Copy each query URL into the matching API Worker env as `SUBGRAPH_URL` (see [`api/wrangler.toml`](../api/wrangler.toml)).

Example:

```bash
wrangler secret put SUBGRAPH_URL --env arbitrum-sepolia
```

When `SUBGRAPH_URL` is set, the API serves:

- `GET /agents/{id}/trades` from `agentActivities` (source: `indexed`)
- `GET /agents/{id}/closed-positions` from indexed `positions` (no global id scan)

Oracle-dependent fields (`unrealizedPnlUsdc`, equity, drawdown) still use live RPC.

## Schema entities

- `Agent`, `Allocation` — registry and capital state
- `Position`, `ExitRule` — mutable position snapshots
- `AgentActivity` — immutable trade timeline (TradeRouter + PositionClosed)

## ABI sync

ABIs are copied from Foundry output on `make build`:

```bash
node scripts/sync-subgraph-abis.mjs
```

Do not edit `abis/*.json` by hand.
