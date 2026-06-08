# AlphaGrid Implementation Status

## 1. Purpose

This document is the **single source of truth** for AlphaGrid build progress: what is implemented in `contracts/` and `api/`, what is partial, and what remains for MVP.

Other PRD files describe **requirements and design**. When implementation changes, update **this document first**, then adjust linked specs only if behavior or scope changed.

**Operational references:** [`contracts/README.md`](../contracts/README.md), [`api/README.md`](../api/README.md), [`contracts/docs/position-intent-eip712.md`](../contracts/docs/position-intent-eip712.md).

---

## 2. Snapshot

**Last updated:** 2026-06-07

| Layer | Status | Summary |
| --- | --- | --- |
| **On-chain (`contracts/`)** | MVP complete | Agent onboarding, four vaults, allocation, trading settlement |
| **Off-chain (`api/`)** | Partial | Vaults, tokens, prices, agent register/read, open-position trade path, MCP, oracle keeper |
| **Product (indexer, perf, UI)** | Not started | Leaderboard, profiles, admin, frontend, trade executor |

**MVP demo loop gap:** Agents can register and open positions via the API when the executor is configured, but there is no indexer, performance display, or leaderboard ranking yet.

---

## 3. On-chain components

Deploy in order:

1. `DeployAgentCore` — `FeeManager`, `VaultTrackRegistry`, `AgentRegistry`
2. `DeployVaultInfrastructure` — agent core + `TokenRegistry` + four `MandateVault` clones + `AllocationManager`
3. `ConfigureVaultTracks` — vault registration + CHALLENGE / FUNDED / PRIME configs
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
| `PositionManager` | Done | Per-agent token ledger and positions; router-only mutations |
| `TradeRouter` | Done | `openPosition`, `executeExit`, `forceClose` |
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
- [x] Four ERC-4626 `MandateVault` instances (Foundation, Tech, Volatility, Macro)
- [x] `FeeManager` (registration + promotion fees)
- [x] `TokenRegistry` + vault token allowlist
- [x] `AllocationManager`
- [x] `PositionManager` + per-agent ledger
- [x] `TradeRouter` — open, keeper exit, operator force-close
- [x] `ISwapAdapter` implementations + Foundry tests
- [x] Deploy scripts: `DeployAgentCore`, `DeployVaultInfrastructure`, `ConfigureVaultTracks`, `DeployTrading`

---

## 4. Off-chain components

Stack: **Cloudflare Worker** (`api/`, Hono + TypeScript). No PostgreSQL or indexer yet — reads use RPC (`viem`).

| Component | Status | Notes |
| --- | --- | --- |
| HTTP API | Partial | Health, vaults, tokens, prices, agent get/register, open-position quote/submit/positions, OpenAPI, discovery |
| MCP server | Partial | Tools mirror implemented HTTP routes; trade history/risk/intent status still `NOT_IMPLEMENTED` |
| x402 registration fee | Done | USDC via x402; relayer submits `registerAgent` (on-chain fee skipped) |
| Oracle price keeper | Done | Cron + `POST /prices/refresh` → `MockPriceOracle` (Finnhub) |
| PostgreSQL / indexer | Not built | No event index; no cached agent list |
| Intent gateway + executor | Partial | Open-position quote, EIP-712 verify, `EXECUTOR_ROLE` relay to `TradeRouter.openPosition`; no DB intent store |
| Performance engine | Not built | PnL, drawdown, Alpha Score |
| Risk event engine | Not built | Drawdown breach → automated status changes |
| Leaderboard API | Not built | Vault + track filters |
| Admin console / APIs | Not built | Operator actions via contracts only |
| Frontend | Not built | Landing PRD only (`prd/landing_website/`) |

### Implemented HTTP routes

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/health` | Liveness |
| `GET` | `/vaults` | Vault catalog + on-chain track config |
| `GET` | `/vaults/{id}/tokens` | Vault mandate tokens + oracle prices |
| `GET` | `/tokens` | Global token catalog |
| `GET` | `/prices` | Oracle quotes by symbol |
| `POST` | `/prices/refresh` | Manual oracle update |
| `GET` | `/agents/{agentId}` | On-chain agent record |
| `GET` | `/agents/by-erc8004/{id}` | Reverse lookup by ERC-8004 id |
| `GET` | `/agents/register/quote` | EIP-712 + x402 registration quote |
| `POST` | `/agents/register` | Register via relayer (x402 when fee > 0) |
| `POST` | `/agents/{agentId}/erc8004/link` | Link ERC-8004 identity |
| `GET` | `/agents/{agentId}/trade-intents/quote` | EIP-712 quote (nonce, vault, allocation, allowed symbols) |
| `POST` | `/agents/{agentId}/trade-intents` | Verify signed open intent; relay `openPosition` (201) |
| `GET` | `/agents/{agentId}/positions` | Open positions via RPC (`PositionManager`) |
| `GET` | `/`, `/llms.txt`, `/docs/swagger.json` | Discovery / OpenAPI |
| `POST` | `/mcp` | MCP Streamable HTTP |

### Trading API stubs (501)

Routes are registered in OpenAPI but return **501 Not Implemented** (`code: NOT_IMPLEMENTED`).

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/intents/trade` | Global trade intent gateway |
| `GET` | `/agents/{agentId}/trades` | Agent trade history |
| `GET` | `/agents/{agentId}/risk-state` | Agent risk state |
| `GET` | `/intents/{intentId}` | Intent status lookup |

| MCP tool | HTTP equivalent |
| --- | --- |
| `alphagrid_get_trade_history` | `GET /agents/{agentId}/trades` |
| `alphagrid_get_risk_state` | `GET /agents/{agentId}/risk-state` |
| `alphagrid_get_intent_status` | `GET /intents/{intentId}` |

### Implemented trading (open position)

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/agents/{agentId}/trade-intents/quote` | Nonce, EIP-712 domain, vault, allocation cap/used |
| `POST` | `/agents/{agentId}/trade-intents` | Agent-friendly body + signature → on-chain open |
| `GET` | `/agents/{agentId}/positions` | RPC scan of open positions for catalog tokens |

| MCP tool | HTTP equivalent |
| --- | --- |
| `alphagrid_submit_trade_intent` | `POST /agents/{agentId}/trade-intents` |
| `alphagrid_get_agent_positions` | `GET /agents/{agentId}/positions` |

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
```

### Planned MCP / API (not yet implemented)

```text
get_track_rules / get_vault_state / get_portfolio
get_market_data / submit_rebalance_intent / get_performance_metrics
GET /leaderboard / GET /agents (list) / admin routes / vault deposit APIs
POST /intents/{id}/cancel / GET /intents/{id}/execution
```

Trade history, risk state, and global intent gateway routes listed in § Trading API stubs are **501** only.

### Off-chain checklist

- [x] HTTP API scaffold + OpenAPI + discovery
- [x] Vault catalog + on-chain track config reads
- [x] Token catalog + oracle prices
- [x] Agent registration (x402 + relayer) and agent read by id / ERC-8004
- [x] MCP tools for implemented routes
- [x] Mock oracle price keeper
- [x] Trading API + MCP stubs (501; OpenAPI/discovery wired)
- [x] Open-position trade path (quote, EIP-712 submit, positions read; executor relay)
- [ ] Contract event indexing
- [ ] Agent list, search, and allocation history cache
- [ ] Trade intent gateway + AlphaGrid executor service (close/rebalance, intent store)
- [ ] Trade history reads for agents
- [ ] Performance engine (PnL, drawdown, Alpha Score)
- [ ] Risk event engine
- [ ] Leaderboard API
- [ ] Admin APIs and console
- [ ] Frontend app

---

## 5. MVP build phases

Phases describe the **full MVP product**. Status as of 2026-06-07:

### Phase 1 — Product Foundation

**Status:** Not started

- app shell, wallet/auth, agent registry UI, track pages, agent profile skeleton, admin skeleton

### Phase 2 — Contracts and Core State

**On-chain:** Done (`AgentRegistry`, `FeeManager`, `VaultTrackRegistry`, `TokenRegistry`, `AllocationManager`, four vaults).

**Partial (`api/`):** vault catalog, tokens, prices, agent registration.

**Remaining:** event indexing, agent list/search, cached allocation history.

### Phase 3 — Execution and Indexing

**On-chain:** Done (`PositionManager`, `TradeRouter`, swap adapters, EIP-712 opens, keeper exits, `forceClose`).

**Partial (`api/`):** trading HTTP/MCP open-position path (quote, submit, positions); history/risk/intent status remain 501.

**Remaining:** intent store, trade history indexer, close/rebalance API, frontend execution visibility.

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

1. ~~Trade intent submission path (API → executor → `TradeRouter.openPosition`)~~ — open position path implemented; trade history and indexer still missing
2. Indexer recording positions, trades, allocations
3. Performance engine updating PnL, drawdown, Alpha Score
4. Leaderboard ranking agents
5. Agent profile pages with metrics and trade history
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
