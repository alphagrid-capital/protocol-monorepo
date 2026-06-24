# Frontend Integration — Stats & Endpoints

## 1. Purpose

Simple map from **UI stats** to **HTTP API** routes for the AlphaGrid app. Use this when wiring agent profiles, dashboards, and position views.

**API reference:** [`api/README.md`](../api/README.md), OpenAPI at `GET /docs/swagger.json`.  
**Agent launch wizard:** [`11_agent_launch_frontend.md`](11_agent_launch_frontend.md).  
**Build status:** [`09_implementation_status.md`](09_implementation_status.md).

**Prerequisites:** Point the app at the API Worker for your chain (`arbitrum-sepolia`, `robinhood-testnet`, or `arbitrum-one` — see `api/README.md`). The Worker needs `CHAIN_ID` + `RPC_URL` for on-chain reads. Amounts are USDC **base units** (6 decimals) unless noted.

---

## 2. Agent identity & status

| UI stat | Endpoint | Response field(s) |
| --- | --- | --- |
| Agent id | `GET /agents/{agentId}` | `agentId` |
| Display name | `GET /agents/{agentId}` | `agent.name` |
| Owner | `GET /agents/{agentId}` | `agent.owner` |
| Signer (trading key) | `GET /agents/{agentId}` | `agent.signer` |
| Vault | `GET /agents/{agentId}` | `agent.vault` |
| Track (Challenge / Funded / Prime) | `GET /agents/{agentId}` | `agent.track` (`0` / `1` / `2`) |
| Status (Active, Failed, …) | `GET /agents/{agentId}` | `agent.status` |
| Registered at | `GET /agents/{agentId}` | `agent.createdAt` |
| Managed flag | `GET /agents/{agentId}` | `managed.isManaged`, `managed.archivedAt` |
| ERC-8004 linked | `GET /agents/{agentId}` | `agent.hasERC8004Identity`, `agent.erc8004AgentId` |
| Agents for connected wallet | `GET /agents/by-owner/{owner}` | `agents[].agentId`, `agents[].agent`, `agents[].managed` |
| Managed agent list | `GET /managed-agents/me` (Privy) | `agents[]`, `activeCount`, `maxAgents` |
| Archived flag | `GET /agents/by-owner/{owner}` or `GET /managed-agents/{agentId}` | `managed.archivedAt` or `profile.archivedAt` |

---

## 3. Account risk & performance (live, on-chain v1)

Single call for dashboard risk header:

| UI stat | Endpoint | Response field(s) |
| --- | --- | --- |
| Allocation cap | `GET /agents/{agentId}/risk-state` | `allocation.cap` |
| Allocation used | `GET /agents/{agentId}/risk-state` | `allocation.used` |
| Allocation available | `GET /agents/{agentId}/risk-state` | `allocation.available` |
| Max drawdown limit (policy) | `GET /agents/{agentId}/risk-state` | `accountRiskBounds.maxDrawdownBps` |
| Max daily loss limit (policy) | `GET /agents/{agentId}/risk-state` | `accountRiskBounds.maxDailyLossBps` |
| Peak equity | `GET /agents/{agentId}/risk-state` | `equity.peakUsdc` |
| Current equity | `GET /agents/{agentId}/risk-state` | `equity.currentUsdc` |
| Current drawdown (bps) | `GET /agents/{agentId}/risk-state` | `equity.currentDrawdownBps` |
| Lifetime realized PnL | `GET /agents/{agentId}/risk-state` | `pnl.lifetimeRealizedUsdc` (signed) |
| Today realized PnL | `GET /agents/{agentId}/risk-state` | `pnl.dailyRealizedUsdc` (signed) |
| Positions opened (lifetime) | `GET /agents/{agentId}/risk-state` | `positions.opened` |
| Positions closed (lifetime) | `GET /agents/{agentId}/risk-state` | `positions.closed` |
| Open position count | `GET /agents/{agentId}/risk-state` | `positions.openCount` |
| Drawdown breach flag | `GET /agents/{agentId}/risk-state` | `breaches.drawdown` (advisory) |
| Daily loss breach flag | `GET /agents/{agentId}/risk-state` | `breaches.dailyLoss` (advisory) |
| Account return (bps vs cap) | `GET /agents/{agentId}/risk-state` | `derived.returnBps` |
| Account unrealized PnL | `GET /agents/{agentId}/risk-state` | `derived.unrealizedPnlUsdc` |
| Drawdown limit utilization | `GET /agents/{agentId}/risk-state` | `derived.drawdownUtilizationBps` |
| Daily loss ceiling / used | `GET /agents/{agentId}/risk-state` | `derived.maxDailyLossUsdc`, `derived.dailyLossUsedUsdc`, `derived.dailyLossUtilizationBps` |
| Promotion checklist | `GET /agents/{agentId}/risk-state` | `promotionReadiness` (`meetsMinTrades`, `meetsEvaluationPeriod`, `blockers`; `alphaScore` always `null`) |

**Also on open-intent quote** (pre-trade context): `GET /agents/{agentId}/trade-intents/quote` → `allocation`, `accountRiskBounds`, `dailyRealizedPnlUsdc`.

**Note:** Drawdown breach is **not enforced on-chain** in MVP; flags compare live views to track policy. Peak equity ratchets on trade events only.

---

## 4. Open positions (live)

| UI stat | Endpoint | Response field(s) |
| --- | --- | --- |
| Position list | `GET /agents/{agentId}/positions` | `positions[]` |
| Symbol | `GET /agents/{agentId}/positions` | `positions[].symbol` |
| Token address | `GET /agents/{agentId}/positions` | `positions[].token` |
| Size (tokens) | `GET /agents/{agentId}/positions` | `positions[].tokenAmount` |
| Entry price (USDC) | `GET /agents/{agentId}/positions` | `positions[].entryPriceUsdc` |
| Cost basis (USDC) | `GET /agents/{agentId}/positions` | `positions[].usdcCostBasis` |
| Unrealized PnL | `GET /agents/{agentId}/positions` | `positions[].unrealizedPnlUsdc` (signed) |
| Exit rules (full ladder) | `GET /agents/{agentId}/positions` | `positions[].exitRules` |
| Pending TP/SL rules | `GET /agents/{agentId}/positions` | `positions[].pendingRules` |
| Next ladder step | `GET /agents/{agentId}/positions` | `positions[].nextRuleIndex` |
| Opened at | `GET /agents/{agentId}/positions` | `positions[].openedAt` |
| Position return (bps) | `GET /agents/{agentId}/positions` | `positions[].derived.returnBps` |
| Position total PnL | `GET /agents/{agentId}/positions` | `positions[].derived.totalPnlUsdc` |

---

## 5. Closed positions (bounded scan)

| UI stat | Endpoint | Response field(s) |
| --- | --- | --- |
| Closed position list | `GET /agents/{agentId}/closed-positions?limit=50` | `positions[]` (newest first, max 100 rows) |
| Per-position derived | same | `positions[].derived`, `positions[].realizedPnlUsdc` |

Scans up to **500** global position ids per request (MVP/testnet). Replace with indexer for production scale.

For a **chronological activity feed** (opens, adds, reduces, keeper exits), prefer `GET /agents/{agentId}/trades` (§6). Closed-positions is position-level snapshots; trades is event-level timeline.

---

## 6. Trade activity (on-chain v1)

Chronological feed from `TradeRouter` + `PositionManager` events. `source` is `indexed` when the API has `SUBGRAPH_URL` (Arbitrum Sepolia / Arbitrum One); otherwise `on-chain-events` (RPC log scan).

| UI stat | Endpoint | Response field(s) |
| --- | --- | --- |
| Activity list | `GET /agents/{agentId}/trades?limit=50` | `trades[]` (newest first, max 100) |
| Scan lower bound | same | `scannedFromBlock` (chain deploy block unless `?fromBlock=` overrides) |
| Event type | same | `trades[].type` — `PositionOpened`, `PositionIncreased`, `PositionReduced`, `ExitLadderUpdated`, `ExitExecuted`, `PositionForceClosed`, `PositionClosed` |
| Position id | same | `trades[].positionId` |
| Time | same | `trades[].timestamp` (block unix seconds) |
| Tx link | same | `trades[].transactionHash`, `trades[].blockNumber` |
| Symbol (opens) | same | `trades[].symbol` when `type === PositionOpened` |
| USDC in/out | same | `trades[].usdcIn`, `trades[].usdcOut` (when present) |
| Realized PnL (final close) | same | `trades[].realizedPnlUsdc` when `type === PositionClosed` |
| Keeper exit detail | same | `trades[].ruleIndex`, `trades[].keeper`, `trades[].keeperBounty` on `ExitExecuted` |

**RPC note:** Scans backwards from latest in ≤999-block windows. Default lower bound is the chain **trading deploy block** (`tradingLogFromBlock` in `contracts.ts`, overridable via `?fromBlock=` or `TRADING_LOG_FROM_BLOCK`). Stops at deploy — never scans from genesis block 0.

### After intent submit

Submit routes return `transactionHash` (201). Confirm landing before refreshing positions:

| UI stat | Endpoint | Response field(s) |
| --- | --- | --- |
| Tx pending / success / reverted | `GET /transactions/{txHash}` | `status` — `pending`, `success`, `reverted` |
| Block time | same | `blockTimestamp` (when mined) |
| Block number | same | `blockNumber` |

Poll until `status !== pending`, then refresh `GET /agents/{id}/positions` or `GET /agents/{id}/trades`. No UUID intent-id lookup — submit is synchronous via the executor.

---

## 6b. Strategy runs (off-chain, owner-only)

After launch, the backend cron evaluates each agent on `botFrequency` (`1h` / `1d`). Today `decideStrategy` returns hold (no trades); runs are still persisted for observability.

| UI stat | Endpoint | Response field(s) |
| --- | --- | --- |
| Current strategy profile | `GET /managed-agents/{agentId}` | `profile.strategy`, `profile.botFrequency`, `profile.nextRunAt`, `profile.archivedAt` (Privy; on-chain owner) |
| Update future strategy runs | `PATCH /managed-agents/{agentId}` | body: `strategy` and/or `botFrequency`; returns updated `profile` (archived agents → **400**) |
| Archive managed agent | `POST /managed-agents/{agentId}/archive` | returns archived `profile`; stops strategy runs; frees slot toward 5-agent limit (Privy; on-chain owner) |
| Active managed count / limit | `GET /managed-agents/me` | `activeCount`, `maxAgents` (currently 5) |
| Run history | `GET /agents/{agentId}/strategy-runs?limit=20` | `runs[]` (Privy; caller must be agent owner) |
| Run status | same | `runs[].status` — `running`, `completed`, `failed` |
| Decision summary | same | `runs[].summary` |
| Planned actions | same | `runs[].actions[]` (`open`, `close`, `add`, `reduce`) |
| Execution results | same | `runs[].execution[]` (`status`, `txHash`, `error`) |
| Timestamps | same | `runs[].startedAt`, `runs[].completedAt` |

`strategy` and `botFrequency` are **not** returned by on-chain `GET /agents/{id}`; they stay in D1 `agent_profiles`. Owners can read/update them through `/managed-agents/{id}` (not when archived); archive via `POST /managed-agents/{agentId}/archive`. Public views should show only run outcomes unless a separate public strategy field is added later.

---

## 7. Position detail (open or closed)

Use when user opens a row or navigates to `/agents/{id}/positions/{positionId}`:

| UI stat | Endpoint | Response field(s) |
| --- | --- | --- |
| Full position | `GET /agents/{agentId}/positions/{positionId}` | `position` |
| Status Open / Closed | `GET /agents/{agentId}/positions/{positionId}` | `position.status` |
| Unrealized PnL (open) | `GET /agents/{agentId}/positions/{positionId}` | `position.unrealizedPnlUsdc` |
| Realized PnL (closed) | `GET /agents/{agentId}/positions/{positionId}` | `position.realizedPnlUsdc` |
| Position return / total PnL | `GET /agents/{agentId}/positions/{positionId}` | `position.derived` |

Use `GET /closed-positions` for a list, or fetch by id when you know `positionId`.

---

## 8. Vault, market, and catalog

| UI stat | Endpoint | Response field(s) |
| --- | --- | --- |
| Vault list + track rules | `GET /vaults` | `vaults[]`, `vaultTrackConfigs` per vault |
| Vault detail | `GET /vaults/{id}` | vault metadata + `vaultTrackConfigs` |
| Tradable symbols (vault) | `GET /vaults/{id}/tokens` | tokens + prices |
| Global token catalog | `GET /tokens` | registered tokens |
| Live oracle prices | `GET /prices` | quotes by symbol |

Track limits (`maxDrawdownBps`, `maxDailyLossBps`, `maxTradeSizeBps`, …) live on `vaultTrackConfigs` from `GET /vaults` — cross-check with `risk-state` for the agent’s current vault + track.

---

## 9. Not available yet (do not wire)

| UI stat (planned) | Planned endpoint | Status |
| --- | --- | --- |
| Performance / Alpha Score | `GET /agents/{agentId}/performance` | Not built |
| Leaderboard rank | `GET /leaderboard` | Not built |
| Per-fill history (venue, fees) | Indexer + `trades` table | Not built — use §6 event feed for MVP |
| Async intent status (UUID) | DB intent store | Not built — use §6 tx lookup + positions |
| Strategy text (off-chain) | `GET /managed-agents/{agentId}` | Done — on-chain owner via Privy |
| Autonomous strategy trading | Cron + `decideStrategy` | Scaffold only — decisions are hold stub |

**Partial (wire when `SUBGRAPH_URL` is set on the target chain):** `GET /agents/{agentId}/equity-history` — trade-boundary equity snapshots; flat between trades; optional live `current` tip from risk-state.

---

## 10. Suggested page → API bundle

Minimal fetch sets for common screens:

| Screen | Calls |
| --- | --- |
| Agent launch wizard | See [`prd/11_agent_launch_frontend.md`](../prd/11_agent_launch_frontend.md) |
| My agents dashboard | `GET /agents/by-owner/{owner}` + `GET /managed-agents/me` |
| Agent profile header | `GET /agents/{id}` + `GET /agents/{id}/risk-state` |
| Strategy run log (owner) | `GET /agents/{id}/strategy-runs?limit=20` (Privy) |
| Performance chart | `GET /agents/{id}/equity-history` (requires `SUBGRAPH_URL`) |
| Positions tab | `GET /agents/{id}/positions` + `GET /agents/{id}/closed-positions` |
| Activity / history tab | `GET /agents/{id}/trades?limit=50` |
| Position drawer | `GET /agents/{id}/positions/{positionId}` |
| Open trade form | `GET /agents/{id}/trade-intents/quote?symbol=…` + `GET /prices` |
| After intent submit | `GET /transactions/{txHash}` until mined → refresh positions or trades |
| Wallet agent list | `GET /agents/by-owner/{owner}` (`managed.isManaged`, `managed.archivedAt`) |
| Vault picker | `GET /vaults` |

Poll `risk-state`, `positions`, and `trades` on an interval or after successful intent submit; no WebSocket yet.

---

## 11. Formatting notes

- **USDC amounts:** strings in base units (`1000000` = 1 USDC). Divide by `10^6` for display.
- **Bps:** `1500` = 15%. Drawdown and policy limits use basis points.
- **Signed PnL:** negative string = loss (`"-2500000"` = −2.5 USDC).
- **Errors:** `404` agent/position/transaction not found; `503` missing RPC or executor config on writes.
