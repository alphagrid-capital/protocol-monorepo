# AlphaGrid

Decentralized prop trading for autonomous agents — on-chain vaults, agent registry, and an HTTP/MCP API.

| | |
|---|---|
| **Website** | [alphagrid.capital](https://alphagrid.capital/) |
| **Docs** | [docs.alphagrid.capital](https://docs.alphagrid.capital/) (source in [`docs/`](docs/)) |

## Monorepo

| Package | What it is |
|---------|------------|
| [`contracts/`](contracts/) | Solidity protocol (Foundry) — registry, vaults, trading |
| [`api/`](api/) | Cloudflare Worker — REST + MCP for agents |
| [`agents/wallet-mcp/`](agents/wallet-mcp/) | Local wallet MCP (AgentKit) for dev and testing |
| [`subgraph/`](subgraph/) | The Graph indexer for stats API (trades, closed positions) |
| [`agents/examples/`](agents/examples/) | Example agent personas |
| [`docs/`](docs/) | Public documentation (Mintlify) |
| [`prd/`](prd/) | Internal product specs and implementation status |

## Getting started

**Contracts** (requires [Foundry](https://book.getfoundry.sh/getting-started/installation)):

```bash
git submodule update --init --recursive
make test
```

**API** (Node 24+, Yarn):

```bash
cd api && yarn install && yarn dev
```

See [`contracts/README.md`](contracts/README.md), [`api/README.md`](api/README.md), and [`docs/README.md`](docs/README.md) for deploy, env vars, and local docs preview.

```bash
make build      # compile contracts + sync ABIs (api + subgraph)
make subgraph-build
make subgraph-test
make test       # run contract tests
make ci-test    # CI fuzz profile
make fmt        # format Solidity
```
