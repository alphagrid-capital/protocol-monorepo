# Frontend Integration — Stats & Endpoints

## 1. Purpose

Simple map from **UI stats** to **HTTP API** routes for the AlphaGrid app. Use this when wiring agent profiles, dashboards, and position views.

**API reference:** [`api/README.md`](../api/README.md), OpenAPI at `GET /docs/swagger.json`.  
**Build status:** [`09_implementation_status.md`](09_implementation_status.md).

**Prerequisites:** `CHAIN_ID` + `RPC_URL` on the Worker for on-chain reads. Amounts are USDC **base units** (6 decimals) unless noted.

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
| ERC-8004 linked | `GET /agents/{agentId}` | `agent.hasERC8004Identity`, `agent.erc8004AgentId` |
| Agents for connected wallet | `GET /agents/by-owner/{owner}` | `agents[].agentId`, `agents[].agent` |

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

---

## 6. Position detail (open or closed)

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

## 7. Vault, market, and catalog

| UI stat | Endpoint | Response field(s) |
| --- | --- | --- |
| Vault list + track rules | `GET /vaults` | `vaults[]`, `vaultTrackConfigs` per vault |
| Vault detail | `GET /vaults/{id}` | vault metadata + `vaultTrackConfigs` |
| Tradable symbols (vault) | `GET /vaults/{id}/tokens` | tokens + prices |
| Global token catalog | `GET /tokens` | registered tokens |
| Live oracle prices | `GET /prices` | quotes by symbol |

Track limits (`maxDrawdownBps`, `maxDailyLossBps`, `maxTradeSizeBps`, …) live on `vaultTrackConfigs` from `GET /vaults` — cross-check with `risk-state` for the agent’s current vault + track.

---

## 8. Not available yet (do not wire)

| UI stat (planned) | Planned endpoint | Status |
| --- | --- | --- |
| Trade history / fills | `GET /agents/{agentId}/trades` | **501** — needs indexer |
| Performance / Alpha Score | `GET /agents/{agentId}/performance` | Not built |
| Leaderboard rank | `GET /leaderboard` | Not built |
| Equity curve (time series) | Indexer + perf engine | Not built |
| Intent status (DB) | `GET /intents/{intentId}` | **501** — needs intent store |

---

## 9. Suggested page → API bundle

Minimal fetch sets for common screens:

| Screen | Calls |
| --- | --- |
| Agent profile header | `GET /agents/{id}` + `GET /agents/{id}/risk-state` |
| Positions tab | `GET /agents/{id}/positions` + `GET /agents/{id}/closed-positions` |
| Position drawer | `GET /agents/{id}/positions/{positionId}` |
| Open trade form | `GET /agents/{id}/trade-intents/quote?symbol=…` + `GET /prices` |
| Wallet agent list | `GET /agents/by-owner/{owner}` |
| Vault picker | `GET /vaults` |

Poll `risk-state` and `positions` on an interval or after successful intent submit; no WebSocket yet.

---

## 10. Formatting notes

- **USDC amounts:** strings in base units (`1000000` = 1 USDC). Divide by `10^6` for display.
- **Bps:** `1500` = 15%. Drawdown and policy limits use basis points.
- **Signed PnL:** negative string = loss (`"-2500000"` = −2.5 USDC).
- **Errors:** `404` agent/position not found; `503` missing RPC or executor config on writes.
