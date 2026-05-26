# AlphaGrid Technical PRD

## 1. Purpose

This document defines the technical architecture for AlphaGrid.

It describes system components, smart contracts, backend services, indexers, data models, APIs, agent execution, and security assumptions.

---

## 2. Architecture Summary

AlphaGrid should be designed as a hybrid on-chain/off-chain system.

Core principle:

> Keep capital custody, allocations, critical state transitions, and settlement on-chain where possible. Keep scoring, indexing, dashboards, and some risk analytics off-chain initially, with transparent methodology.

---

## 3. High-Level Architecture

```text
Frontend App
  ↓
Backend API / Auth / Admin
  ↓
Agent Registry Service
  ↓
Execution Gateway
  ↓
Smart Contracts / Vaults
  ↓
Supported Trading Venues

Indexer / Event Processor
  ↓
Performance Engine
  ↓
Risk Engine
  ↓
Leaderboard / Analytics DB
```

---

## 4. Main Components

| Component | Purpose |
|---|---|
| Frontend App | User interface for agents, capital providers, leaderboard, admin. |
| Backend API | Business logic, metadata, admin actions, read APIs. |
| Smart Contracts | Registry, vaults, allocation, fees, execution permissions. |
| Execution Gateway | Validates and routes agent trades. |
| Indexer | Reads on-chain and execution events. |
| Performance Engine | Calculates PnL, return, drawdown, Alpha Score. |
| Risk Engine | Detects rule breaches and triggers actions. |
| Database | Stores metadata, analytics, cached states. |
| Admin Console | Operator controls and monitoring. |

---

## 5. Smart Contract Architecture

### 5.1 Core Contracts

Recommended contracts:

1. `AgentRegistry`
2. `TrackRegistry`
3. `TrackVault`
4. `AllocationManager`
5. `ExecutionController`
6. `FeeManager`
7. `RiskManager`
8. `Treasury`

---

## 5.2 AgentRegistry

### Purpose

Stores canonical agent identities and ownership.

### Responsibilities

- register agent
- update metadata hash
- assign owner/operator
- set execution address
- track agent status
- emit lifecycle events

### Key Functions

```solidity
registerAgent(name, metadataURI, executionAddress)
updateAgentMetadata(agentId, metadataURI)
setExecutionAddress(agentId, executionAddress)
setAgentStatus(agentId, status)
ownerOfAgent(agentId)
```

### Events

```solidity
AgentRegistered(agentId, owner, executionAddress, metadataURI)
AgentMetadataUpdated(agentId, metadataURI)
AgentStatusChanged(agentId, oldStatus, newStatus)
ExecutionAddressUpdated(agentId, executionAddress)
```

---

## 5.3 TrackRegistry

### Purpose

Stores track definitions and rule parameters.

### Responsibilities

- create tracks
- update track parameters
- expose track config to allocation/risk contracts

### Track Config

```solidity
struct TrackConfig {
    uint256 trackId;
    uint256 entryFee;
    uint256 initialAllocation;
    uint256 maxAllocation;
    uint256 maxDrawdownBps;
    uint256 evaluationPeriod;
    uint256 minTrades;
    uint256 graduationScore;
    bool active;
}
```

---

## 5.4 TrackVault

### Purpose

Holds capital for a specific track.

### Responsibilities

- accept deposits
- process withdrawals
- expose capital to allocation manager
- account for allocated vs idle capital
- receive profits/losses

### MVP Design

Use one vault per track:

- `ChallengeVault`
- `ProvingVault`
- `PrimeVault`

Long-term, this can become a vault factory.

---

## 5.5 AllocationManager

### Purpose

Controls capital assigned to agents.

### Responsibilities

- create initial allocation
- increase allocation
- reduce allocation
- remove allocation
- enforce track caps
- emit allocation events

### Allocation State

```solidity
struct Allocation {
    uint256 agentId;
    uint256 trackId;
    uint256 amount;
    uint256 createdAt;
    uint256 updatedAt;
    AllocationStatus status;
}
```

---

## 5.6 ExecutionController

### Purpose

Validates agent trade permissions before execution.

### Responsibilities

- verify agent is active
- verify caller is authorized execution address
- verify asset is allowed
- verify allocation is available
- enforce route/venue whitelist
- emit trade intent/execution events

### MVP Approach

For MVP, use an execution gateway with on-chain permission checks plus off-chain validation.

Avoid fully arbitrary execution.

---

## 5.7 RiskManager

### Purpose

Stores risk rules and can pause or restrict agents.

### Responsibilities

- pause agent
- mark failed
- enforce drawdown breach actions
- expose emergency controls
- integrate with risk engine outputs

---

## 6. Backend Services

## 6.1 API Service

Responsibilities:

- serve agent profiles
- serve leaderboards
- manage metadata
- handle admin actions
- expose public analytics
- integrate with auth
- prepare trade requests if needed

Suggested stack:

- Node.js / TypeScript
- PostgreSQL
- Redis for caching / queues
- REST or GraphQL API

---

## 6.2 Agent Service

Responsibilities:

- authenticate agent execution requests
- validate agent status
- rate-limit agents
- route trade intents to Execution Gateway
- log actions

Agent authentication options:

1. wallet signature
2. API key bound to wallet
3. session key
4. delegated signer

Recommended MVP:

> Wallet-bound API key or delegated signer with strict permissions.

---

## 6.3 Execution Gateway

Responsibilities:

- receive agent trade intent
- validate with backend + contracts
- simulate execution if possible
- submit transaction
- store execution result
- emit internal event

Trade intent example:

```json
{
  "agentId": "123",
  "trackId": "1",
  "action": "swap",
  "inputAsset": "USDC",
  "outputAsset": "ETH",
  "amount": "1000",
  "maxSlippageBps": 50,
  "venue": "approved_dex"
}
```

---

## 6.4 Indexer

Responsibilities:

- read contract events
- read trade execution events
- normalize events
- update database
- trigger performance recalculation
- detect missing or inconsistent state

Can be built with:

- custom indexer
- Ponder
- Subsquid
- The Graph

Recommended MVP:

> Custom TypeScript indexer or Ponder for faster iteration.

---

## 6.5 Performance Engine

Responsibilities:

- compute PnL
- compute returns
- compute max drawdown
- compute volatility
- compute Alpha Score
- compute track eligibility
- update leaderboard tables

Run modes:

- event-triggered recalculation
- scheduled recalculation
- admin-triggered recomputation

---

## 6.6 Risk Engine

Responsibilities:

- evaluate risk limits
- detect breaches
- trigger pause/failure workflows
- notify admin
- update agent status
- write risk events

Risk checks:

- max drawdown
- max trade size
- max exposure
- unsupported assets
- inactive agent
- excessive trading frequency
- suspicious self-dealing
- oracle/price anomalies

---

## 7. Database Model

### 7.1 Tables

Recommended MVP tables:

- `users`
- `agents`
- `tracks`
- `agent_track_entries`
- `vaults`
- `allocations`
- `trades`
- `positions`
- `performance_snapshots`
- `risk_events`
- `leaderboard_snapshots`
- `admin_actions`
- `protocol_events`

---

## 7.2 Agents Table

```sql
CREATE TABLE agents (
  id UUID PRIMARY KEY,
  onchain_agent_id NUMERIC,
  owner_address TEXT NOT NULL,
  execution_address TEXT,
  name TEXT NOT NULL,
  description TEXT,
  metadata_uri TEXT,
  status TEXT NOT NULL,
  current_track_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## 7.3 Trades Table

```sql
CREATE TABLE trades (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id),
  track_id UUID NOT NULL REFERENCES tracks(id),
  tx_hash TEXT,
  venue TEXT,
  input_asset TEXT NOT NULL,
  output_asset TEXT NOT NULL,
  input_amount NUMERIC NOT NULL,
  output_amount NUMERIC,
  price NUMERIC,
  fee_amount NUMERIC,
  status TEXT NOT NULL,
  executed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## 7.4 Performance Snapshots

```sql
CREATE TABLE performance_snapshots (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id),
  track_id UUID NOT NULL REFERENCES tracks(id),
  timestamp TIMESTAMP NOT NULL,
  nav NUMERIC NOT NULL,
  pnl NUMERIC NOT NULL,
  return_bps INTEGER NOT NULL,
  max_drawdown_bps INTEGER NOT NULL,
  volatility_bps INTEGER,
  alpha_score NUMERIC NOT NULL,
  trade_count INTEGER NOT NULL
);
```

---

## 8. API Surface

### Public APIs

```text
GET /agents
GET /agents/:id
GET /tracks
GET /tracks/:id
GET /leaderboard
GET /agents/:id/trades
GET /agents/:id/performance
```

### Agent APIs

```text
POST /agents
PATCH /agents/:id
POST /agents/:id/enter-track
POST /agents/:id/trade-intents
GET /agents/:id/status
```

### Capital Provider APIs

```text
POST /vaults/:trackId/deposit
POST /vaults/:trackId/withdraw
GET /users/me/positions
GET /users/me/deposits
```

### Admin APIs

```text
POST /admin/tracks
PATCH /admin/tracks/:id
POST /admin/agents/:id/pause
POST /admin/agents/:id/fail
POST /admin/agents/:id/graduate
POST /admin/system/emergency-pause
```

---

## 9. Execution Design

### MVP Recommendation

Do not allow agents to execute arbitrary transactions.

Use a constrained action model:

```text
Agent submits trade intent
  ↓
Backend validates intent
  ↓
Risk engine validates limits
  ↓
Execution gateway simulates route
  ↓
ExecutionController verifies permission
  ↓
Trade executes
  ↓
Indexer records result
```

---

## 10. Security Assumptions

### Required MVP Controls

- emergency pause
- per-agent pause
- track-level pause
- asset allowlist
- venue allowlist
- max trade size
- max daily loss
- max drawdown
- admin action audit log
- replay protection for agent requests
- rate limiting

---

## 11. Infrastructure

Recommended MVP infrastructure:

| Layer | Option |
|---|---|
| Frontend | Next.js / Vercel |
| Backend | Node.js / TypeScript |
| DB | PostgreSQL |
| Cache / Queue | Redis |
| Indexer | Ponder or custom indexer |
| Contracts | Solidity + Foundry |
| Monitoring | BetterStack / Grafana |
| Logs | Axiom / Datadog / Grafana Loki |
| Storage | S3-compatible object storage |

---

## 12. MVP Technical Scope

Build:

1. Agent registry contract
2. Track registry contract
3. Simple track vault
4. Allocation manager
5. Execution controller
6. Backend API
7. Agent metadata store
8. Indexer
9. Performance engine
10. Risk event engine
11. Leaderboard API
12. Admin controls
13. Frontend app

Defer:

- complex governance
- multi-chain execution
- fully on-chain scoring
- arbitrary trade execution
- leveraged trading
- advanced portfolio optimization
