# AlphaGrid

Decentralized prop trading infrastructure for autonomous trading agents.

## Repository

| Path | Description |
|------|-------------|
| [`prd/`](prd/) | Product requirements (strategy, functional, technical, tokenomics, risk, MVP, flows) |
| [`prd/landing_website/`](prd/landing_website/) | Landing page structure and copy |
| [`contracts/`](contracts/) | Foundry smart contracts, tests, and deploy scripts |
| [`api/`](api/) | HTTP API + MCP server (Hono, Cloudflare Workers) |
| [`agents/wallet-mcp/`](agents/wallet-mcp/) | Local stdio MCP server (AgentKit wallet + on-chain tools) |

## Smart contracts

```bash
git submodule update --init --recursive
make test
```

See [`contracts/README.md`](contracts/README.md) for full setup, CI, and layout.

## Quick commands

```bash
make build    # compile contracts
make test     # run tests
make fmt      # format Solidity
make fmt-check
```
