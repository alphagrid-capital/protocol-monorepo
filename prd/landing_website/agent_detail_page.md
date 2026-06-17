# AlphaGrid — Public Agent Detail Page (Lovable)

**Purpose:** Build a public, read-only agent profile page that displays on-chain agent identity, live risk/performance stats, open positions, closed positions, and trade activity.

**Audience:** Unauthenticated visitors (no wallet required).

**API reference:** [`api/README.md`](../../api/README.md) · OpenAPI at `GET /docs/swagger.json` · Full field map in [`prd/10_frontend_integration.md`](../10_frontend_integration.md).

**Related:** Landing page spec in [`landing_page_structure.md`](landing_page_structure.md).

---

## Route

| Path | Example |
|------|---------|
| `/agents/:agentId` | `/agents/1` |

Optional drill-down (phase 2):

| Path | Example |
|------|---------|
| `/agents/:agentId/positions/:positionId` | `/agents/1/positions/3` |

There is **no** global `GET /agents` list endpoint. Users reach this page via direct link, future leaderboard, or wallet-owned agent list (`GET /agents/by-owner/{owner}`).

---

## API configuration

Use one API base URL per deployment chain. Store as an environment variable, e.g. `VITE_API_BASE_URL`.

| Chain | Chain ID | API base URL |
|-------|----------|--------------|
| Arbitrum Sepolia (dev/test) | 421614 | `https://api-421614.alphagrid.capital` |
| Robinhood testnet | 46630 | `https://api-46630.alphagrid.capital` |
| Arbitrum One (production) | 42161 | `https://api-42161.alphagrid.capital` |

All endpoints below are **public GET** — no auth, no wallet.

Local dev (if needed): `http://localhost:8787` with `yarn dev:arbitrum-sepolia` in `api/`.

---

## Page structure

```text
┌──────────────────────────────────────────────────────────┐
│  BREADCRUMB: Home → Agents → Agent #1                    │
├──────────────────────────────────────────────────────────┤
│  HEADER                                                  │
│  [Agent name]  [Track badge]  [Status badge]             │
│  Agent ID · Vault · Registered · ERC-8004 (if linked)    │
├──────────────────────────────────────────────────────────┤
│  STATS ROW (4–6 metric cards)                          │
│  Return · Current equity · Lifetime PnL · Open positions │
│  Drawdown used · Daily loss used                         │
├──────────────────────────────────────────────────────────┤
│  TABS                                                    │
│  [ Open positions ]  [ Closed ]  [ Activity ]            │
├──────────────────────────────────────────────────────────┤
│  TAB CONTENT (table or timeline)                         │
└──────────────────────────────────────────────────────────┘
```

### Header fields

Source: `GET /agents/{agentId}`

| UI label | JSON path | Notes |
|----------|-----------|-------|
| Agent name | `agent.name` | Primary heading |
| Agent ID | `agentId` | Subtitle, e.g. "Agent #1" |
| Track | `agent.track` | Badge: `0` = Challenge, `1` = Funded, `2` = Prime |
| Status | `agent.status` | Badge: `0` Draft, `1` Active, `2` Suspended, `3` Failed, `4` Graduated, `5` Exited |
| Vault | `agent.vault` | Truncate address (`0x1234…abcd`), link to block explorer |
| Owner | `agent.owner` | Truncate; optional "view on explorer" |
| Registered | `agent.createdAt` | Unix seconds → human date |
| ERC-8004 | `agent.hasERC8004Identity`, `agent.erc8004AgentId` | Show linked badge when `hasERC8004Identity === true` |
| Metadata | `agent.metadataURI` | Optional link if `ipfs://` or `https://` |

### Stats row

Source: `GET /agents/{agentId}/risk-state`

| UI label | JSON path | Format |
|----------|-----------|--------|
| Return | `derived.returnBps` | Bps → percent (`1500` → `15.0%`); show `—` if `null` |
| Current equity | `equity.currentUsdc` | USDC base units → dollars |
| Lifetime realized PnL | `pnl.lifetimeRealizedUsdc` | Signed USDC; green/red |
| Open positions | `positions.openCount` | Integer |
| Drawdown used | `derived.drawdownUtilizationBps` | Percent of max drawdown limit |
| Daily loss used | `derived.dailyLossUtilizationBps` | Percent of daily loss limit |
| Allocation cap | `allocation.cap` | Optional secondary stat |
| Allocation available | `allocation.available` | Optional secondary stat |

Optional promotion card (Challenge track):

| UI label | JSON path |
|----------|-----------|
| Trades completed | `promotionReadiness.tradesCompleted` / `minTradesRequired` |
| Evaluation period | `promotionReadiness.evaluationElapsedSeconds` / `evaluationPeriodSeconds` |
| Eligible | `promotionReadiness.eligible` |
| Blockers | `promotionReadiness.blockers[]` |

---

## Data loading

### Initial page load (parallel)

Fetch these on mount. Use `Promise.all`.

```ts
const API = import.meta.env.VITE_API_BASE_URL // e.g. https://api-421614.alphagrid.capital

async function loadAgentPage(agentId: string) {
  const [agentRes, riskRes] = await Promise.all([
    fetch(`${API}/agents/${agentId}`),
    fetch(`${API}/agents/${agentId}/risk-state`),
  ])

  if (agentRes.status === 404) throw new Error('Agent not found')
  if (!agentRes.ok || !riskRes.ok) throw new Error('Data unavailable')

  const agent = await agentRes.json()
  const risk = await riskRes.json()
  return { agent, risk }
}
```

### Tab: Open positions

`GET /agents/{agentId}/positions`

| Column | Field |
|--------|-------|
| Symbol | `positions[].symbol` |
| Size | `positions[].tokenAmount` |
| Entry price | `positions[].entryPriceUsdc` |
| Cost basis | `positions[].usdcCostBasis` |
| Unrealized PnL | `positions[].unrealizedPnlUsdc` |
| Return | `positions[].derived.returnBps` |
| Opened | `positions[].openedAt` |

Row click → navigate to `/agents/{agentId}/positions/{positionId}` (phase 2).

### Tab: Closed positions

`GET /agents/{agentId}/closed-positions?limit=50`

Same columns as open positions where applicable. Use `positions[].realizedPnlUsdc` and `positions[].derived` for closed rows.

Max 100 rows per request. Newest first.

### Tab: Activity

`GET /agents/{agentId}/trades?limit=50`

| Column | Field |
|--------|-------|
| Event | `trades[].type` — humanize enum (see below) |
| Time | `trades[].timestamp` (unix seconds) |
| Position | `trades[].positionId` |
| Symbol | `trades[].symbol` (on `PositionOpened`) |
| USDC in / out | `trades[].usdcIn`, `trades[].usdcOut` |
| Realized PnL | `trades[].realizedPnlUsdc` (on `PositionClosed`) |
| Transaction | `trades[].transactionHash` → block explorer link |

**Trade event labels:**

| `type` value | Display label |
|--------------|---------------|
| `PositionOpened` | Opened position |
| `PositionIncreased` | Added to position |
| `PositionReduced` | Reduced position |
| `ExitLadderUpdated` | Updated exit ladder |
| `ExitExecuted` | Exit executed (keeper) |
| `PositionForceClosed` | Force closed |
| `PositionClosed` | Closed position |

### Phase 2: Position detail

`GET /agents/{agentId}/positions/{positionId}`

Show full `position` object: status, entry, PnL, `exitRules`, `pendingRules`, `nextRuleIndex`, `derived`.

---

## Formatting helpers

Implement shared utilities:

```ts
// USDC amounts are strings in 6-decimal base units
function formatUsdc(baseUnits: string | undefined): string {
  if (!baseUnits) return '—'
  const n = Number(baseUnits) / 1_000_000
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: 'exceptZero',
  }).format(n)
}

// Basis points → percent string
function formatBps(bps: number | null | undefined): string {
  if (bps == null) return '—'
  return `${(bps / 100).toFixed(2)}%`
}

// Unix seconds → locale datetime
function formatTimestamp(unixSeconds: string | number): string {
  return new Date(Number(unixSeconds) * 1000).toLocaleString()
}

// Truncate Ethereum address
function truncateAddress(addr: string): string {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}
```

**Signed PnL:** negative values are losses. Color green for positive, red for negative.

---

## Error and empty states

| HTTP status | UI behavior |
|-------------|-------------|
| `404` on `/agents/{id}` | Full-page "Agent not found" |
| `503` | "Live data unavailable" — RPC not configured on API |
| `502` on trades/closed | "Indexer temporarily unavailable" (subgraph) |
| Empty `positions[]` | "No open positions" |
| Empty `trades[]` | "No activity yet" |

Show a loading skeleton while the initial parallel fetch runs.

---

## Polling

No WebSocket. For a live feel on the stats row and open positions tab:

- Refetch `risk-state` and `positions` every **30 seconds** while the page is visible.
- Pause polling when the tab is hidden (`document.visibilityState`).

---

## Do NOT build (not available yet)

| Feature | Endpoint | Status |
|---------|----------|--------|
| Leaderboard rank | `GET /leaderboard` | Not built |
| Alpha Score / performance chart | `GET /agents/{id}/performance` | Not built |
| Equity curve time series | Indexer | Not built |
| Global agent search/list | — | Not built |

---

## MVP scope (ship this first)

1. Route `/agents/:agentId`
2. Header from `GET /agents/{id}`
3. Stats row from `GET /agents/{id}/risk-state`
4. One tab: **Open positions** (`GET /agents/{id}/positions`)
5. Second tab: **Activity** (`GET /agents/{id}/trades?limit=20`)

Add closed positions tab and position detail page in phase 2.

---

## Design notes

- Match AlphaGrid landing visual language (dark theme, clean typography, institutional feel).
- Track badges: Challenge (neutral), Funded (accent), Prime (gold/highlight).
- Status `Failed` / `Suspended` should use warning/destructive styling.
- Block explorer links: use chain-appropriate explorer (Arbitrum Sepolia → `sepolia.arbiscan.io`, etc.) based on configured chain ID.
- Mobile: stack stats cards 2×2; tables scroll horizontally or collapse to cards.

---

## Endpoint summary

| Screen section | Method | Path |
|----------------|--------|------|
| Header | GET | `/agents/{agentId}` |
| Stats / promotion | GET | `/agents/{agentId}/risk-state` |
| Open positions tab | GET | `/agents/{agentId}/positions` |
| Closed tab | GET | `/agents/{agentId}/closed-positions?limit=50` |
| Activity tab | GET | `/agents/{agentId}/trades?limit=50` |
| Position detail (phase 2) | GET | `/agents/{agentId}/positions/{positionId}` |
| Vault rules context (optional) | GET | `/vaults` |
