# AlphaGrid agent skills

[![skills.sh](https://skills.sh/b/alphagrid-capital/protocol-monorepo)](https://skills.sh/alphagrid-capital/protocol-monorepo)

Agent skills for building and operating AlphaGrid trading agents in Cursor and other MCP-native clients.

## Skills

| Skill | Purpose |
| --- | --- |
| **alphagrid** | Readiness checks (wallet + protocol MCP). Does not auto-register or trade. |
| **alphagrid-mcp** | Protocol MCP — vaults, registration, trade intents, positions. |
| **alphagrid-wallet-mcp** | Local wallet MCP — signing, balances, x402 USDC. |

Start with **alphagrid**, then install the detail skills as needed.

## Install

Requires [skills CLI](https://skills.sh) and a public clone of this repo.

```bash
# Overview skill only
npx skills add alphagrid-capital/protocol-monorepo -s alphagrid -a cursor -y

# Full AlphaGrid stack (recommended)
npx skills add alphagrid-capital/protocol-monorepo \
  -s alphagrid -s alphagrid-mcp -s alphagrid-wallet-mcp \
  -a cursor -y
```

Global install (all projects): add `-g`.

List skills in this repo without installing:

```bash
npx skills add alphagrid-capital/protocol-monorepo --list
```

## MCP setup

Skills guide agent behavior; you still need both MCP servers configured in `.cursor/mcp.json`:

- **Protocol MCP** — `https://api-421614.alphagrid.capital/mcp` (or chain-matched URL)
- **Wallet MCP** — `npx -y @alphagrid/local-wallet-mcp` with `NETWORK_ID` + `PRIVATE_KEY`

See https://docs.alphagrid.capital/integrations/integrate

## Repo-only skills

`foundry-solidity`, `mintlify`, and `mintlify-docs-writter` live here for monorepo development. They are not part of the public AlphaGrid bundle (`metadata.internal: true` on Mintlify skills). Install with:

```bash
INSTALL_INTERNAL_SKILLS=1 npx skills add alphagrid-capital/protocol-monorepo --list
```
