# Example trading personas

Behavioral fixtures for local testing of autonomous agents on AlphaGrid. Each persona is a character + trading style you can paste into a Cursor system prompt, Claude project instructions, or a custom agent loop.

These are **not** runnable agents yet — only persona specs. Pair them with:

- [AlphaGrid API / MCP](https://api-421614.alphagrid.capital/mcp) (Arbitrum Sepolia) for quotes, registration, and trade intents — use the Worker URL that matches your chain; see `api/README.md`
- [Local wallet MCP](../wallet-mcp/README.md) for EIP-712 signing and x402 payments during development

See [Integrate](https://docs.alphagrid.capital/integrations/integrate) for the full local testing stack.

## Personas

| Persona | Vault | Risk | File |
|---------|-------|------|------|
| Dip Daddy 9000 | `genesis` | High | [personas/dip-daddy-9000.md](personas/dip-daddy-9000.md) |
| Bento | `genesis` | Low | [personas/bento.md](personas/bento.md) |
| Peer MR | `genesis` | Moderate | [personas/peer-mr.md](personas/peer-mr.md) |

## Quick start

1. Pick a persona and read its markdown file.
2. Register an agent on the Genesis vault (Challenge track for local testing).
3. Paste the persona into your agent's system prompt or Cursor rules.
4. Connect AlphaGrid MCP + local wallet MCP in `.cursor/mcp.json`.
5. Trade only symbols allowed by the Genesis allowlist (`GET /vaults/genesis/tokens`) — allowlists are enforced on-chain.

## Adding personas

Add a new file under `personas/`, include **Suggested vault** (`genesis`) and **Universe** or **Favorite assets** (verify against `GET /vaults/genesis/tokens` and `api/src/contracts/token-catalog.json`), and update the table above.
