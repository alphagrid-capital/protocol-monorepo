# AlphaGrid API

HTTP API and MCP server for AlphaGrid, deployed as a [Cloudflare Worker](https://developers.cloudflare.com/workers/).

REST endpoints and MCP tools share the same service layer so agents and classic HTTP clients see identical data.

## Prerequisites

- Node.js 24+
- [Yarn](https://yarnpkg.com/) 1.x (Classic)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/) (installed via `yarn install` in this directory)

## Observability

Workers Logs and tracing are enabled in `wrangler.toml` (`observability.enabled`, logs, and traces at 100% head sampling for MVP traffic). After deploy, view invocations in the [Cloudflare dashboard](https://dash.cloudflare.com/) under **Workers & Pages → alphagrid-api → Observability**.

## Commands

```bash
cd api
yarn install
yarn type-check   # TypeScript check (no emit)
yarn dev         # Local dev server (wrangler dev)
yarn deploy      # Deploy to Cloudflare (requires account auth)
```

## Endpoints

| Method | Path                                          | Description                                                                    |
| ------ | --------------------------------------------- | ------------------------------------------------------------------------------ |
| `GET`  | `/`                                           | API discovery JSON (generated from OpenAPI)                                    |
| `GET`  | `/llms.txt`                                   | LLM-oriented index ([llms.txt spec](https://llmstxt.org/))                     |
| `GET`  | `/health`                                     | Liveness probe                                                                 |
| `GET`  | `/vaults`                                     | Vault catalog (`?format=md` for markdown)                                      |
| `GET`  | `/vaults/{id}/tokens`                         | Tradable tokens for a vault mandate + oracle prices                            |
| `GET`  | `/tokens`                                     | Global token catalog + on-chain registry state                                 |
| `GET`  | `/prices`                                     | MockPriceOracle quotes indexed by symbol (e.g. `NVDA`)                         |
| `POST` | `/prices/refresh`                             | Manually fetch Finnhub quotes and update the oracle                            |
| `GET`  | `/agents/{agentId}/trade-intents/quote`       | EIP-712 quote for open-position intent (nonce, vault, allocation, exit bounds) |
| `POST` | `/agents/{agentId}/trade-intents`             | Verify signed open intent; relay `TradeRouter.openPosition` (201)              |
| `GET`  | `/agents/{agentId}/add-intents/quote`         | Quote for `AddToPosition` (`?positionId=`)                                     |
| `POST` | `/agents/{agentId}/add-intents`               | Relay signed add-to-position intent (201)                                      |
| `GET`  | `/agents/{agentId}/reduce-intents/quote`      | Quote for `ReducePosition` (`?positionId=`)                                    |
| `POST` | `/agents/{agentId}/reduce-intents`            | Relay signed reduce intent — partial or full close (201)                       |
| `GET`  | `/agents/{agentId}/exit-ladder-intents/quote` | Quote for `UpdateExitLadder` (`?positionId=`)                                  |
| `POST` | `/agents/{agentId}/exit-ladder-intents`       | Relay signed pending TP/SL update (201)                                        |
| `GET`  | `/agents/{agentId}/positions`                 | Agent open positions with exit rules (RPC via `PositionManager`)               |
| `POST` | `/intents/trade`                              | Global trade intent submit (**501** stub)                                      |
| `GET`  | `/agents/{agentId}/trades`                    | Agent trade history (**501** stub)                                             |
| `GET`  | `/agents/{agentId}/risk-state`                | Agent risk state (**501** stub)                                                |
| `GET`  | `/intents/{intentId}`                         | Intent status lookup (**501** stub)                                            |
| `GET`  | `/docs`                                       | Swagger UI (humans; poor fit for URL paste in chat)                            |
| `GET`  | `/docs/swagger.json`                          | OpenAPI 3.1 (Custom GPT Actions)                                               |
| `POST` | `/mcp`                                        | MCP Streamable HTTP (Durable Object sessions)                                  |

## Using with ChatGPT and other LLMs

ChatGPT **browsing** only performs simple `GET` requests on **public** URLs. It cannot run your local dev server, open Swagger UI as data, or call `POST /mcp`.

| Goal                                   | What to use                                                                  |
| -------------------------------------- | ---------------------------------------------------------------------------- |
| Paste a URL in chat and get vault data | Deployed `GET /vaults` or `GET /vaults?format=md`                            |
| Let ChatGPT discover endpoints         | Deployed `GET /` or `GET /llms.txt` (both derived from `/docs/swagger.json`) |
| Custom GPT with structured actions     | Import `GET /docs/swagger.json` when creating Actions                        |
| Claude / Cursor / MCP-native clients   | `POST /mcp` (see MCP tools table below)                                      |

**Do not paste** `/docs` if you want JSON—the UI is HTML. Paste the **data URL**, e.g. `https://<your-worker>.workers.dev/vaults?format=md`.

### MCP tools

| Tool                                     | HTTP equivalent                                          |
| ---------------------------------------- | -------------------------------------------------------- |
| `alphagrid_list_vaults`                  | `GET /vaults`                                            |
| `alphagrid_list_tokens`                  | `GET /tokens`                                            |
| `alphagrid_list_vault_tokens`            | `GET /vaults/{id}/tokens`                                |
| `alphagrid_get_prices`                   | `GET /prices`                                            |
| `alphagrid_get_agent`                    | `GET /agents/{agentId}`                                  |
| `alphagrid_get_agent_by_erc8004`         | `GET /agents/by-erc8004/{erc8004AgentId}`                |
| `alphagrid_link_agent_erc8004`           | `POST /agents/{agentId}/erc8004/link`                    |
| `alphagrid_get_agent_registration_quote` | `GET /agents/register/quote`                             |
| `alphagrid_register_agent`               | `POST /agents/register`                                  |
| `alphagrid_submit_trade_intent`          | `POST /agents/{agentId}/trade-intents`                   |
| `alphagrid_get_add_intent_quote`         | `GET /agents/{agentId}/add-intents/quote`                |
| `alphagrid_submit_add_intent`            | `POST /agents/{agentId}/add-intents`                     |
| `alphagrid_get_reduce_intent_quote`      | `GET /agents/{agentId}/reduce-intents/quote`             |
| `alphagrid_submit_reduce_intent`         | `POST /agents/{agentId}/reduce-intents`                  |
| `alphagrid_get_exit_ladder_intent_quote` | `GET /agents/{agentId}/exit-ladder-intents/quote`        |
| `alphagrid_submit_exit_ladder_intent`    | `POST /agents/{agentId}/exit-ladder-intents`             |
| `alphagrid_get_agent_positions`          | `GET /agents/{agentId}/positions`                        |
| `alphagrid_get_trade_history`            | `GET /agents/{agentId}/trades` (**NOT_IMPLEMENTED**)     |
| `alphagrid_get_risk_state`               | `GET /agents/{agentId}/risk-state` (**NOT_IMPLEMENTED**) |
| `alphagrid_get_intent_status`            | `GET /intents/{intentId}` (**NOT_IMPLEMENTED**)          |

Trade history, risk state, and intent status stubs return HTTP **501** or MCP `NOT_IMPLEMENTED`. Open/add/reduce/exit-ladder intents and positions require executor config (see below).

Connect MCP clients to `http://localhost:8787/mcp` in development (or your deployed Worker URL). Clients must send `Accept: application/json, text/event-stream` on MCP requests.

**Cursor custom MCP:** use your deployed `https://<worker-host>/mcp` URL (Streamable HTTP). Each client session is backed by a Cloudflare Durable Object (`McpAgent`), so initialize and tool calls stay on the same session across Worker isolates. Transport uses Streamable HTTP with SSE (including `GET /mcp` listen streams). Opening `/mcp` in a browser will fail — use an MCP client or [MCP Inspector](https://github.com/modelcontextprotocol/inspector).

## Layout

```text
api/
  src/
    index.ts           # Worker entry (exports fetch handler)
    app.ts             # Hono app, OpenAPI, MCP transport
    mcp/alphagrid-mcp-agent.ts  # McpAgent (Durable Object per session)
    mcp/server.ts               # MCP tool registration
    routes/            # OpenAPI HTTP routes
    services/          # Shared business logic (used by HTTP + MCP)
    schemas/           # Zod / OpenAPI schemas
    types/             # TypeScript types
  wrangler.toml
  package.json
```

## Agent registration (x402)

When `AGENT_REGISTRY_ADDRESS`, `FEE_MANAGER_ADDRESS`, `RPC_URL`, and `RELAYER_PRIVATE_KEY` are set, registration uses HTTP 402 (x402) for the USDC fee (amount + treasury read on-chain from `FeeManager`), then the API relayer broadcasts `registerAgent` via `REGISTRAR_ROLE`.

| Variable                                | Role                                                      |
| --------------------------------------- | --------------------------------------------------------- |
| `AGENT_REGISTRY_ADDRESS`                | `AgentRegistry` contract                                  |
| `FEE_MANAGER_ADDRESS`                   | Fee amount + treasury source                              |
| `RELAYER_PRIVATE_KEY`                   | Secret (`wrangler secret put`); signs the registration tx |
| `RPC_URL` / `CHAIN_ID`                  | Chain access                                              |
| `X402_NETWORK` / `X402_FACILITATOR_URL` | x402 network/facilitator settings                         |

Without these, `POST /agents/register` runs in mock mode (no chain submit).

## Trade execution (positions)

When `TRADE_ROUTER_ADDRESS` (or address in `api/src/constants/contracts.ts`), `RPC_URL`, `CHAIN_ID`, and `EXECUTOR_PRIVATE_KEY` are set, the API verifies EIP-712 intents and relays `TradeRouter` calls via an EOA with `EXECUTOR_ROLE`.

Supported intents: `OpenPosition`, `AddToPosition`, `ReducePosition` (partial or `exitBps=10000` full close), `UpdateExitLadder` (pending TP/SL replacement within vault track bounds).

| Variable                 | Role                                                                      |
| ------------------------ | ------------------------------------------------------------------------- |
| `TRADE_ROUTER_ADDRESS`   | `TradeRouter` contract (optional if set in `contracts.ts` for `CHAIN_ID`) |
| `EXECUTOR_PRIVATE_KEY`   | Secret (`wrangler secret put`); signs `openPosition` txs                  |
| `RPC_URL` / `CHAIN_ID`   | Chain access (same as registration)                                       |
| `AGENT_REGISTRY_ADDRESS` | Resolve agent signer and vault                                            |

**Agent-friendly submit body:** `symbol`, human `usdcAmount`, `minTokenOut`, `maxSlippageBps`, `exits`, `deadline`, `nonce`, `signature`. Vault is resolved from `AgentRegistry.vaultOf(agentId)` — never from the client.

**Quote first:** Open quotes return `exitBounds` and `trackId` from `VaultTrackConfig`. Position adjust quotes require `?positionId=`. Sign with the agent signer (see [`contracts/docs/position-intent-eip712.md`](../contracts/docs/position-intent-eip712.md)).

Without executor config, quote/submit/positions return **503** (not configured). Settlement uses on-chain `MockSwapAdapter` (mock token mint/burn) — no external venue.

### Manual E2E (testnet)

1. Deploy trading stack (`DeployTrading`) and grant `EXECUTOR_ROLE` to the executor EOA.
2. Ensure vault has idle USDC, enabled tokens, and oracle prices.
3. Register an agent with a known signer.
4. `GET /agents/{agentId}/trade-intents/quote`
5. Sign `OpenPosition` with the agent signer.
6. `POST /agents/{agentId}/trade-intents` with the signed body → `{ positionId, transactionHash }`
7. `GET /agents/{agentId}/positions` shows the open position with exit rules.
8. Optional: `add-intents`, `reduce-intents`, or `exit-ladder-intents` quote → sign → submit to adjust size or pending TP/SL.

## CI deployment

Pushes to `main` that touch `api/**` run type-check, then deploy via [wrangler-action](https://github.com/cloudflare/wrangler-action). Pull requests only run type-check.

### GitHub repository secrets

Add these under **Settings → Secrets and variables → Actions → Repository secrets**:

| Secret                  | Description                                                                                                          |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API token with permission to deploy Workers (see below).                                                  |
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID ([dashboard](https://dash.cloudflare.com/) → right sidebar on any zone/account overview). |

**Create the API token:** [Cloudflare dashboard → My Profile → API Tokens](https://dash.cloudflare.com/profile/api-tokens) → **Create Token** → use the **Edit Cloudflare Workers** template, or create a custom token with at least:

- **Account** → **Workers Scripts** → **Edit**
- **Account** → **Workers Scripts** → **Read** (included in the template)

`workflow_dispatch` on the API workflow also runs deploy when triggered on `main` (after type-check passes).

## Mock price oracle (cron)

When `PriceOracle` and token addresses are configured for `CHAIN_ID`, a cron (`*/15 * * * *` UTC, every day) calls Finnhub and submits `MockPriceOracle.setPrices`.

| Secret / var                | Purpose                                                                            |
| --------------------------- | ---------------------------------------------------------------------------------- |
| `FINNHUB_API_KEY`           | Finnhub quote API (`wrangler secret put`)                                          |
| `ORACLE_KEEPER_PRIVATE_KEY` | EOA with `ORACLE_UPDATER_ROLE` on `MockPriceOracle`                                |
| `ORACLE_REFRESH_SECRET`     | Optional; if set, `POST /prices/refresh` requires `Authorization: Bearer <secret>` |
| `RPC_URL` / `CHAIN_ID`      | Same as other on-chain reads                                                       |

Fill `config/token-catalog.json` `chains.<id>.tokens` with addresses logged by `DeployTokenCatalog` before the keeper can update prices.

## Environment

Copy `.env.example` to `.env` for local development when bindings and secrets are added. For local deploy, export the same `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` values (or run `wrangler login`).

Set `ENABLE_SWAGGER=false` to disable `GET /docs` (returns 404). This is useful for deployments where only machine-readable discovery (`/docs/swagger.json`, `/llms.txt`) should remain exposed.

## Health check

`GET /health` returns `{ "status": "ok", "service": "alphagrid-api" }`.
