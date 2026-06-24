# AlphaGrid Implementation Status

## 1. Purpose

This document is the **single source of truth** for AlphaGrid build progress: what is implemented in `contracts/` and `api/`, what is partial, and what remains for MVP.

Other PRD files describe **requirements and design**. When implementation changes, update **this document first**, then adjust linked specs only if behavior or scope changed.

**Operational references:** [`contracts/README.md`](../contracts/README.md), [`api/README.md`](../api/README.md), [`contracts/docs/position-intent-eip712.md`](../contracts/docs/position-intent-eip712.md).

---

## 2. Snapshot

**Last updated:** 2026-06-24

| Layer | Status | Summary |
| --- | --- | --- |
| **On-chain (`contracts/`)** | MVP complete | Agent onboarding, Genesis vault, allocation, trading settlement + position adjust intents |
| **Off-chain (`api/`)** | Partial | Vaults, tokens, prices, agent register/read, open + adjust trade path, positions/risk derived reads, MCP, oracle keeper, Privy auth, agent launch (D1), strategy runner scaffold |
| **Product (indexer, perf, UI)** | Not started | Leaderboard, profiles UI, admin, frontend |

**MVP demo loop gap:** Agents can register, open, adjust, and read on-chain risk/position stats via the API, but there is no indexer, Alpha Score, or leaderboard yet.

---

## 3. On-chain components

Deploy in order:

1. `DeployAgentCore` — `FeeManager`, `VaultTrackRegistry`, `AgentRegistry`
2. `DeployVaultInfrastructure` — agent core + `TokenRegistry` + Genesis `MandateVault` clone + `AllocationManager`
3. Track configs — CHALLENGE / FUNDED / PRIME (wired into `DeployVaultInfrastructure` / `DeployFullStack` via `VaultTrackPolicies`)
4. `DeployTrading` — `PositionManager`, `TradeRouter`, swap adapter; wire roles
5. *(Optional)* `DeployPriceOracle`, `DeployTokenCatalog`, `SetRegistrationFee`

| Component | Status | Notes |
| --- | --- | --- |
| `AgentRegistry` | Done | Registrar + self-register; vault binding; optional ERC-8004 link; operator-only promotion |
| `VaultTrackRegistry` | Done | Global track types + per-vault `VaultTrackConfig` |
| `FeeManager` | Done | Registration + promotion fees (USDC; amount may be zero) |
| `TokenRegistry` | Done | Tradable token + price feed registration |
| `AllocationManager` | Done | Simulated Challenge + real Funded/Prime caps; cap updates on promotion |
| `MandateVault` | Done | ERC-4626 via EIP-1167 `MandateVaultFactory`; liquidity/trading pause; router-only pulls |
| `PositionManager` | Done | Per-agent ledger; `applyLadderExit` / `applyDiscretionaryReduce`, `increasePosition`, `updatePendingExitRules` |
| `TradeRouter` | Done | `openPosition`, `addToPosition`, `reducePosition`, `updateExitLadder`, `executeExit`, `forceClose`; per-track exit bounds |
| `ISwapAdapter` | Done | `MockSwapAdapter` (dev/tests), `InventorySwapAdapter` (pre-funded inventory) |
| `IntentValidator` | Consolidated | EIP-712, nonce, deadline checks in `TradeRouter` |
| `ExecutionController` | Consolidated | `EXECUTOR_ROLE` / `OPERATOR_ROLE` on `TradeRouter` |
| `RiskManager` | Partial | On-chain: trade size, daily turnover, pauses; drawdown / Alpha Score off-chain |
| `ExecutorRegistry` | Deferred | Single executor EOA with `EXECUTOR_ROLE` in MVP |
| Dedicated `Treasury` | Deferred | Configurable recipients on `FeeManager` / vaults |
| Portfolio 2/20 fees | Open | [OQ-001](08_open_questions.md#oq-001-portfolio-220-fee-model) |
| ERC-8004 | Partial | Identity link in registry + API; no Reputation Registry — [OQ-002](08_open_questions.md#oq-002-erc-8004-trustless-agents) |
| Robinhood RFQ adapter | Open | No production venue adapter — [OQ-003](08_open_questions.md#oq-003-robinhood-rfq-engine) |

### On-chain checklist

- [x] Agent registry — registrar + self-register; optional ERC-8004 link
- [x] Track configuration — `VaultTrackRegistry` + `VaultTrackConfig`
- [x] One Genesis ERC-4626 `MandateVault` instance (`agGEN`; reuses former Tech vault address on testnet)
- [x] `FeeManager` (registration + promotion fees)
- [x] `TokenRegistry` + vault token allowlist
- [x] `AllocationManager`
- [x] `PositionManager` + per-agent ledger
- [x] `TradeRouter` — open, add, reduce, update pending ladder, keeper exit, operator force-close; vault exit bounds
- [x] `ISwapAdapter` implementations + Foundry tests
- [x] Deploy scripts: `DeployAgentCore`, `DeployVaultInfrastructure`, `DeployTrading`, `DeployFullStack`

---

## 4. Off-chain components

Stack: **Cloudflare Worker** (`api/`, Hono + TypeScript). Per-chain **Cloudflare D1** for users, agent launch drafts, agent profiles, and strategy run history. On-chain reads use RPC (`viem`); optional **subgraph** when `SUBGRAPH_URL` is set (Arbitrum Sepolia / Arbitrum One).

| Component | Status | Notes |
| --- | --- | --- |
| HTTP API | Partial | Health, vaults, tokens, prices, agent get/register, open + adjust quote/submit, positions/risk reads with derived stats, OpenAPI, discovery |
| Privy auth + user profiles | Done | `GET /auth/me`, `GET|PATCH /users/me`; D1 `users` table |
| Agent launch API | Done | Draft wizard; custodial signer; x402 + relayer launch → `agent_profiles`; max 5 active managed agents; `/managed-agents/*` lifecycle; `managed` flag on `/agents/*` reads |
| Strategy runner | Partial | Cron tick (`*/10 * * * *`); `decideStrategy` stub (hold, no trades); execution plumbing wired; `GET /agents/{id}/strategy-runs` for owner |
| MCP server | Partial | Tools mirror implemented HTTP routes; trade activity from subgraph or RPC event logs |
| x402 registration fee | Done | USDC via x402; relayer submits `registerAgent` (on-chain fee skipped) |
| Oracle price keeper | Done | Cron + `POST /prices/refresh` → `MockPriceOracle` (Finnhub) |
| Subgraph-backed reads | Partial | When `SUBGRAPH_URL` set: `/trades`, `/closed-positions`, `/equity-history` use indexed data |
| PostgreSQL / full indexer | Not built | D1 is launch + strategy runs only; no event index; no cached agent list |
| Intent gateway + executor | Partial | Open + adjust position quote/submit, EIP-712 verify, `EXECUTOR_ROLE` relay; no DB intent store |
| Performance engine | Not built | PnL, drawdown, Alpha Score |
| Risk event engine | Not built | Drawdown breach → automated status changes |
| Leaderboard API | Not built | Vault + track filters |
| Admin console / APIs | Not built | Operator actions via contracts only |
| Frontend | Not built | Landing PRD (`prd/landing_website/`); API wiring map in [`10_frontend_integration.md`](10_frontend_integration.md); launch wizard in [`11_agent_launch_frontend.md`](11_agent_launch_frontend.md) |

### Implemented HTTP routes

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness |
| `GET` | `/auth/me` | Privy session + user profile summary |
| `POST` | `/auth/logout` | Logout acknowledgement |
| `GET` | `/users/me` | Full user profile (Privy) |
| `PATCH` | `/users/me` | Update display name / preferred currency |
| `GET` | `/users/me/agent-drafts` | In-progress launch drafts for wallet |
| `GET` | `/managed-agents/me` | Managed agent profiles for on-chain owner (`activeCount`, `maxAgents`) |
| `POST` | `/agent-drafts` | Create launch draft (Privy) |
| `PUT` | `/agent-drafts/{draftId}` | Update `identity`, `strategy`, `botFrequency` |
| `GET` | `/agent-drafts/{draftId}` | Resume draft |
| `DELETE` | `/agent-drafts/{draftId}` | Abandon draft |
| `POST` | `/agent-drafts/{draftId}/provision-wallet` | Generate custodial signer |
| `POST` | `/agent-drafts/{draftId}/launch` | x402 + on-chain register |
| `GET` | `/vaults` | Vault catalog + on-chain track config |
| `GET` | `/vaults/{id}/tokens` | Vault mandate tokens + oracle prices |
| `GET` | `/tokens` | Global token catalog |
| `GET` | `/prices` | Oracle quotes by symbol |
| `POST` | `/prices/refresh` | Manual oracle update |
| `GET` | `/agents/{agentId}` | On-chain agent record + `managed` flag |
| `GET` | `/agents/by-owner/{owner}` | Agents owned by address + `managed` flag |
| `GET` | `/agents/by-erc8004/{id}` | Reverse lookup by ERC-8004 id |
| `GET` | `/managed-agents/{agentId}` | Owner-only managed agent strategy profile |
| `PATCH` | `/managed-agents/{agentId}` | Update strategy and/or bot frequency for future runs |
| `POST` | `/managed-agents/{agentId}/archive` | Archive managed agent (stops strategy runs; frees slot) |
| `GET` | `/agents/register/quote` | EIP-712 + x402 registration quote |
| `POST` | `/agents/register` | Register via relayer (x402 when fee > 0) |
| `POST` | `/agents/{agentId}/erc8004/link` | Link ERC-8004 identity |
| `GET` | `/agents/{agentId}/trade-intents/quote` | EIP-712 quote (nonce, vault, allocation, `trackId`, `exitBounds`, allowed symbols) |
| `POST` | `/agents/{agentId}/trade-intents` | Verify signed open intent; relay `openPosition` (201) |
| `GET` | `/agents/{agentId}/positions` | Open positions (`getOpenPositionIds`; see § Implemented trading) |
| `GET` | `/agents/{agentId}/add-intents/quote` | Quote for `AddToPosition` (`?positionId=`) |
| `POST` | `/agents/{agentId}/add-intents` | Relay signed add-to-position intent (201) |
| `GET` | `/agents/{agentId}/reduce-intents/quote` | Quote for `ReducePosition` (`?positionId=`) |
| `POST` | `/agents/{agentId}/reduce-intents` | Relay signed reduce intent — partial or full close (201) |
| `GET` | `/agents/{agentId}/exit-ladder-intents/quote` | Quote for `UpdateExitLadder` (`?positionId=`) |
| `POST` | `/agents/{agentId}/exit-ladder-intents` | Relay signed pending TP/SL update (201) |
| `GET` | `/agents/{agentId}/trades` | Trade activity (`source`: `indexed` when `SUBGRAPH_URL` set, else RPC log scan) |
| `GET` | `/agents/{agentId}/equity-history` | Trade-boundary equity snapshots (`SUBGRAPH_URL` required) |
| `GET` | `/agents/{agentId}/strategy-runs` | Strategy runner history for agent owner (Privy) |
| `GET` | `/transactions/{txHash}` | Transaction receipt status |
| `GET` | `/`, `/llms.txt`, `/docs/swagger.json` | Discovery / OpenAPI |
| `POST` | `/mcp` | MCP Streamable HTTP |

### Removed API stubs (2026-06-12)

Former 501 routes dropped in favor of per-agent intent paths and synchronous submit:

| Method | Path | Replacement |
| --- | --- | --- |
| `POST` | `/intents/trade` | `POST /agents/{agentId}/trade-intents` (+ add/reduce/exit-ladder) |
| `GET` | `/intents/{intentId}` | `GET /transactions/{txHash}` after submit |

### Trade history (v1, no indexer)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/agents/{agentId}/trades` | Activity feed from on-chain event logs (not indexed per-fill history) |

| MCP tool | HTTP equivalent |
| --- | --- |
| `alphagrid_get_trade_history` | `GET /agents/{agentId}/trades` |

### Implemented trading (open + adjust)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/agents/{agentId}/trade-intents/quote` | Nonce, EIP-712 domain, vault, allocation, `trackId`, `exitBounds` |
| `POST` | `/agents/{agentId}/trade-intents` | Agent-friendly body + signature → on-chain open |
| `GET` | `/agents/{agentId}/positions` | Open positions via `getOpenPositionIds` + multicall (`unrealizedPnlUsdc`, `derived`) |
| `GET` | `/agents/{agentId}/closed-positions` | Closed positions via bounded global id scan (`?limit=`, `derived`, `realizedPnlUsdc`) |
| `GET` | `/agents/{agentId}/positions/{positionId}` | Single position by id (open or closed; `derived`, realized/unrealized PnL) |
| `GET` | `/agents/{agentId}/risk-state` | On-chain equity, drawdown, PnL, `derived`, `promotionReadiness`, advisory breach flags |
| `GET` | `/agents/{agentId}/add-intents/quote` | Add-to-position quote (`?positionId=`) |
| `POST` | `/agents/{agentId}/add-intents` | Signed `AddToPosition` → on-chain add |
| `GET` | `/agents/{agentId}/reduce-intents/quote` | Reduce quote (`?positionId=`) |
| `POST` | `/agents/{agentId}/reduce-intents` | Signed `ReducePosition` → partial or full close |
| `GET` | `/agents/{agentId}/exit-ladder-intents/quote` | Pending ladder update quote (`?positionId=`) |
| `POST` | `/agents/{agentId}/exit-ladder-intents` | Signed `UpdateExitLadder` → replace pending rules |

| MCP tool | HTTP equivalent |
| --- | --- |
| `alphagrid_submit_trade_intent` | `POST /agents/{agentId}/trade-intents` |
| `alphagrid_get_agent_positions` | `GET /agents/{agentId}/positions` |
| `alphagrid_list_closed_positions` | `GET /agents/{agentId}/closed-positions` |
| `alphagrid_get_agent_position` | `GET /agents/{agentId}/positions/{positionId}` |
| `alphagrid_get_risk_state` | `GET /agents/{agentId}/risk-state` |
| `alphagrid_get_add_intent_quote` | `GET /agents/{agentId}/add-intents/quote` |
| `alphagrid_submit_add_intent` | `POST /agents/{agentId}/add-intents` |
| `alphagrid_get_reduce_intent_quote` | `GET /agents/{agentId}/reduce-intents/quote` |
| `alphagrid_submit_reduce_intent` | `POST /agents/{agentId}/reduce-intents` |
| `alphagrid_get_exit_ladder_intent_quote` | `GET /agents/{agentId}/exit-ladder-intents/quote` |
| `alphagrid_submit_exit_ladder_intent` | `POST /agents/{agentId}/exit-ladder-intents` |

Requires `EXECUTOR_PRIVATE_KEY`, `TRADE_ROUTER_ADDRESS` (or `contracts.ts`), and `RPC_URL` / `CHAIN_ID`. See [`api/README.md`](../api/README.md) and [`contracts/docs/position-intent-eip712.md`](../contracts/docs/position-intent-eip712.md).

### Implemented MCP tools

```text
alphagrid_list_vaults
alphagrid_list_tokens
alphagrid_list_vault_tokens
alphagrid_get_prices
alphagrid_get_agent
alphagrid_get_agent_by_erc8004
alphagrid_link_agent_erc8004
alphagrid_get_agent_registration_quote
alphagrid_register_agent
alphagrid_submit_trade_intent
alphagrid_get_agent_positions
alphagrid_list_closed_positions
alphagrid_get_agent_position
alphagrid_get_risk_state
alphagrid_get_add_intent_quote
alphagrid_submit_add_intent
alphagrid_get_reduce_intent_quote
alphagrid_submit_reduce_intent
alphagrid_get_exit_ladder_intent_quote
alphagrid_submit_exit_ladder_intent
alphagrid_get_trade_history
```

### Planned MCP / API (not yet implemented)

```text
get_track_rules / get_vault_state / get_portfolio
get_market_data / submit_rebalance_intent / get_performance_metrics
GET /leaderboard / GET /agents (list) / admin routes / vault deposit APIs
POST /intents/{id}/cancel / GET /intents/{id}/execution
```

Per-fill indexed history and async intent store remain future work (see § Trade history v1).

### Off-chain checklist

- [x] HTTP API scaffold + OpenAPI + discovery
- [x] Vault catalog + on-chain track config reads
- [x] Token catalog + oracle prices
- [x] Agent registration (x402 + relayer) and agent read by id / ERC-8004
- [x] MCP tools for implemented routes
- [x] Mock oracle price keeper
- [x] On-chain trade activity v1 (`GET /agents/{id}/trades`, MCP `alphagrid_get_trade_history`)
- [x] Transaction status lookup (`GET /transactions/{txHash}`)
- [x] Open + adjust position trade path (quote, EIP-712 submit, positions read; executor relay)
- [x] Privy auth + D1 user profiles
- [x] Agent launch wizard API (drafts, custodial signer, x402 launch)
- [x] Strategy runner scaffold (cron, D1 `strategy_runs`, execution plumbing; decision engine is stub)
- [x] Subgraph-backed reads when `SUBGRAPH_URL` configured (`/trades`, `/closed-positions`, `/equity-history`)
- [ ] Contract event indexing (full PostgreSQL / indexer)
- [ ] Agent list, search, and allocation history cache
- [ ] Trade intent gateway + intent store (DB-backed status/history)
- [ ] Indexed per-fill trade history (DB indexer; v1 uses subgraph or RPC event logs)
- [x] On-chain risk-state v1 + API derived stats (`derived`, `promotionReadiness`; Alpha Score still off-chain)
- [ ] Performance engine (Alpha Score, historical analytics; equity-history is subgraph trade-boundary only)
- [ ] LLM / rules-based strategy decision engine (real `decideStrategy` logic)
- [ ] Risk event engine
- [ ] Leaderboard API
- [ ] Admin APIs and console
- [ ] Frontend app

---

## 5. MVP build phases

Phases describe the **full MVP product**. Status as of 2026-06-24:

### Phase 1 — Product Foundation

**Status:** Not started (frontend); **partial API** for agent launch wizard (Privy + D1)

- app shell, wallet/auth, agent registry UI, track pages, agent profile skeleton, admin skeleton

### Phase 2 — Contracts and Core State

**On-chain:** Done (`AgentRegistry`, `FeeManager`, `VaultTrackRegistry`, `TokenRegistry`, `AllocationManager`, Genesis vault).

**Partial (`api/`):** vault catalog, tokens, prices, agent registration, agent launch API, strategy runner scaffold.

**Remaining:** event indexing, agent list/search, cached allocation history, real strategy decision engine.

### Phase 3 — Execution and Indexing

**On-chain:** Done (`PositionManager`, `TradeRouter`, swap adapters, EIP-712 open + adjust intents, keeper exits, `forceClose`, vault exit bounds).

**Partial (`api/`):** trading HTTP/MCP open + adjust paths; positions, closed-positions, risk-state, trade activity (subgraph or RPC); transaction status lookup; strategy runner cron + run history.

**Remaining:** DB indexer (per-fill history), intent store, frontend execution visibility, real strategy decisions.

### Phase 4 — Performance and Risk

**Status:** Not started

- PnL, drawdown, Alpha Score, risk events, failure/graduation automation (off-chain)

### Phase 5 — Leaderboard and Public Demo

**Status:** Not started

- leaderboard, agent profiles, track dashboards, performance charts, public trade feed

### Phase 6 — Admin and Hardening

**Status:** Not started

- admin controls UI, monitoring, audit logs, QA (on-chain emergency pause exists)

---

## 6. Remaining MVP product loop

These block the MVP demo script in `06_mvp_scope.md` §11:

1. ~~Trade intent submission path (API → executor → `TradeRouter`)~~ — open + adjust position paths implemented; trade activity v1 from event logs; DB indexer still missing
2. Indexer recording positions, trades, allocations
3. Performance engine updating PnL, drawdown, Alpha Score
4. Leaderboard ranking agents
5. Agent profile pages with trade history (risk/position derived stats available via API today)
6. Frontend tying the above together
7. Admin console for operator promotion, pause, and fail workflows

---

## 7. Open questions — implementation baseline

Summary for backlog items; full questions in `08_open_questions.md`.

| ID | Topic | Implementation today |
| --- | --- | --- |
| [OQ-001](08_open_questions.md#oq-001-portfolio-220-fee-model) | 2/20 portfolio fees | `FeeManager`: registration + promotion only; `MandateVault`: `setFeeRecipient`, no mgmt/performance accrual |
| [OQ-002](08_open_questions.md#oq-002-erc-8004-trustless-agents) | ERC-8004 | Optional identity link in `AgentRegistry` + API; no Reputation/Validation Registry |
| [OQ-003](08_open_questions.md#oq-003-robinhood-rfq-engine) | Robinhood RFQ | `MockSwapAdapter` + `InventorySwapAdapter` only; no RFQ client or executor |

---

## 8. Deferred (post-MVP)

- Full OIF integration, permissionless solvers, multi-chain execution
- Fully on-chain scoring, arbitrary agent execution, leverage
- `ExecutorRegistry` with staking/slashing, solver auctions
- Advanced portfolio optimization, dedicated treasury contract
- Separate `executionAddress` on agents (MVP uses `signer` for intents)
- Per-track `allowed_assets` (vault + `TokenRegistry` allowlist today)
- Agent `pending_review` status and approval gate

---

## 9. Maintenance

When shipping contract, API, or product work:

1. Update the relevant tables and checklists in this file.
2. Bump **Last updated** in §2.
3. If scope or behavior changed, update the affected requirement doc (`02`, `03`, or `06`).
4. Log product decisions in `08_open_questions.md` §14 Decision log.
