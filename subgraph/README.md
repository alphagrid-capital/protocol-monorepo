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
3. Deploy from repo root (recommended — builds first, unique version label per commit):

```bash
export DEPLOY_KEY='<studio-deploy-key>'
scripts/deploy-subgraph.sh arbitrum-sepolia
scripts/deploy-subgraph.sh arbitrum-one
```

Each deploy gets a new Studio version label: `build-<git-sha>` by default. Override with `VERSION_LABEL=v0.0.2` if you need a specific name. Labels are immutable — reusing one fails with "Version label already exists".

Or from `subgraph/` (set `--version-label` yourself):

```bash
yarn deploy:arbitrum-sepolia --version-label build-$(git rev-parse --short HEAD)
```

4. Copy each query URL into the matching API Worker env as `SUBGRAPH_URL` (see [`api/wrangler.toml`](../api/wrangler.toml)).

**Reindex:** adding `AgentEquitySnapshot` requires redeploying and reindexing existing Studio subgraphs (no graft from prior schema).

Example:

```bash
wrangler secret put SUBGRAPH_URL --env arbitrum-sepolia
```

When `SUBGRAPH_URL` is set, the API serves:

- `GET /agents/{id}/trades` from `agentActivities` (source: `indexed`)
- `GET /agents/{id}/closed-positions` from indexed `positions` (no global id scan)
- `GET /agents/{id}/equity-history` from `agentEquitySnapshots` (trade-boundary granularity)

Oracle-dependent fields (`unrealizedPnlUsdc`, equity, drawdown) still use live RPC for `risk-state` and the optional `current` tip on equity history.

## Schema entities

- `Agent`, `Allocation` — registry and capital state
- `Position`, `ExitRule` — mutable position snapshots
- `AgentActivity` — immutable trade timeline (TradeRouter + PositionClosed)
- `AgentEquitySnapshot` — trade-boundary equity points (lens eth_calls at each trade/allocation event)

## ABI sync

ABIs are copied from Foundry output on `make build`:

```bash
node scripts/sync-subgraph-abis.mjs
```

Do not edit `abis/*.json` by hand.
