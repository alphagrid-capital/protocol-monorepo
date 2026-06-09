# AlphaGrid Technical PRD

## 1. Purpose

This document defines the technical architecture for AlphaGrid.

It describes system components, smart contracts, backend services, indexers, data models, APIs, agent execution, intent settlement, executor infrastructure, and security assumptions.

---

## 2. Architecture Summary

AlphaGrid should be designed as a hybrid on-chain/off-chain system.

Core principle:

> Agents decide. Vaults constrain. Executors settle. Contracts enforce.

Capital custody, allocations, critical permissions, vault constraints, and settlement should be enforced on-chain where possible.

Scoring, indexing, dashboards, analytics, and some risk monitoring can be handled off-chain initially, with transparent methodology and verifiable event history.

AlphaGrid should support an intent-based execution model:

```text
Agent signs trade intent
  ↓
AlphaGrid validates agent/vault/risk rules
  ↓
Execution Gateway / Executor Network routes intent
  ↓
Smart contracts enforce final validity
  ↓
Trade settles through approved venue adapter
```

The system should be designed to become **OIF-compatible**, but should not depend on full OIF integration for MVP.

---

## 3. High-Level Architecture

```text
Frontend App
  ↓
Backend API / Auth / Admin
  ↓
Agent Registry Service
  ↓
Intent Gateway / MCP Server
  ↓
Execution Gateway
  ↓
Executor Network / Solver Layer
  ↓
Smart Contracts / Vaults / Trade Router
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

Long-term execution path:

```text
AI Agent
  ↓ signed intent
AlphaGrid Intent API / MCP
  ↓ validation
OIF-Compatible Intent Layer
  ↓
Approved Executors / Solvers
  ↓
AlphaGrid TradeRouter
  ↓
Vault + Risk Validation
  ↓
Tokenized Stock Venue Adapter
```

---

## 4. Main Components

| Component              | Purpose                                                                      |
| ---------------------- | ---------------------------------------------------------------------------- |
| Frontend App           | User interface for agents, capital providers, leaderboard, and admin.        |
| Backend API            | Business logic, metadata, admin actions, read APIs.                          |
| MCP Server             | AI-native interface for agents to read state and submit intents.             |
| Agent Registry Service | Manages off-chain agent profiles, credentials, lifecycle, and metadata.      |
| Smart Contracts        | Registry, vaults, allocation, fees, execution permissions, risk constraints. |
| Intent Gateway         | Receives signed agent intents and performs initial validation.               |
| Execution Gateway      | Routes valid intents to AlphaGrid executor or external executors.            |
| Executor Network       | Trusted or permissioned executors/solvers that settle valid intents.         |
| TradeRouter            | On-chain entrypoint for execution through approved venue adapters.           |
| Indexer                | Reads on-chain and execution events.                                         |
| Performance Engine     | Calculates PnL, return, drawdown, Alpha Score.                               |
| Risk Engine            | Detects rule breaches and triggers actions.                                  |
| Database               | Stores metadata, analytics, cached states.                                   |
| Admin Console          | Operator controls, monitoring, and emergency actions.                        |

---

## 5. Smart Contract Architecture

### 5.0 Implementation status

On-chain and off-chain build progress (component tables, deploy order, API/MCP surface, MVP phases) is maintained in **`09_implementation_status.md`**. This section describes contract **design**; that document tracks what is **shipped**.

---

### 5.1 Core Contracts

Recommended contracts:

1. `AgentRegistry`
2. `VaultTrackRegistry`
3. `MandateVault` (ERC-4626 instances via `MandateVaultFactory`)
4. `TokenRegistry`
5. `AllocationManager`
6. `PositionManager`
7. `TradeRouter` _(includes MVP intent validation + executor gating)_
8. `FeeManager`
9. `ISwapAdapter` _(venue-specific; not a core registry)_
10. `ExecutorRegistry` _(deferred post-MVP)_
11. `RiskManager` _(partial; remainder off-chain in MVP)_
12. `Treasury` _(deferred; configurable recipients today)_

MVP consolidates separate `IntentValidator` and `ExecutionController` designs into `TradeRouter` to reduce contract surface area while preserving the same security properties.

---

## 5.2 AgentRegistry

### Purpose

Stores canonical agent identities and ownership.

### Responsibilities

- register agent via `REGISTRAR_ROLE` (`registerAgent`) or agent-signed `selfRegisterAgent`
- collect registration fee via `FeeManager` (skipped on-chain when registrar path uses API x402 settlement)
- bind agent to exactly one vault at registration
- enter Challenge track on that vault
- update metadata URI
- assign owner, signer, and payout recipient
- optional ERC-8004 identity link
- track agent status and current track within vault
- emit lifecycle events

### Key Functions

```solidity
registerAgent(owner, vault, name, metadataURI, signer, linkERC8004, erc8004AgentId) // REGISTRAR_ROLE
selfRegisterAgent(vault, name, metadataURI, signer, linkERC8004, erc8004AgentId, deadline, signature)
updateAgentMetadata(agentId, metadataURI)
linkERC8004Identity(agentId, erc8004AgentId)
setAgentSigner(agentId, signer)
setPayoutRecipient(agentId, payoutRecipient)
transferAgentOwnership(agentId, newOwner)
setAgentStatus(agentId, status) // OPERATOR_ROLE
promoteAgent(agentId, targetTrack) // OPERATOR_ROLE; FeeManager promotion fee; no on-chain rule checks in MVP
ownerOf(agentId)
vaultOf(agentId)
trackOf(agentId)
signerOf(agentId)
getAgentByERC8004(erc8004AgentId)
```

**Deferred in MVP:** separate `executionAddress` / `setExecutionAddress` — `signer` is the runtime intent key.

### Events

```solidity
AgentRegistered(agentId, vault, owner, signer, metadataURI, track)
AgentMetadataUpdated(agentId, metadataURI)
AgentStatusChanged(agentId, oldStatus, newStatus)
AgentSignerUpdated(agentId, signer)
AgentOwnershipTransferred(agentId, from, to)
PayoutRecipientUpdated(agentId, payoutRecipient)
AgentPromoted(agentId, vault, fromTrack, toTrack)
ERC8004IdentityLinked(agentId, erc8004IdentityRegistry, erc8004ChainId, erc8004AgentId, owner)
```

---

## 5.3 VaultTrackRegistry

### Purpose

Stores **track types** (lifecycle stages) and **per-vault track configuration**.

**Implementation:** `contracts/src/core/VaultTrackRegistry.sol`

### Responsibilities

- define global track types (Challenge, Funded, Prime)
- configure `VaultTrackConfig` for each vault + track pair
- register approved vault addresses
- expose effective rules to allocation and execution contracts
- store promotion criteria fields for **off-chain** eligibility checks in MVP

### Track Type

```solidity
struct TrackType {
    uint256 trackId;
    bytes32 name; // e.g. CHALLENGE, FUNDED, PRIME
    CapitalMode capitalMode; // Simulated or Real
    bool active;
}
```

### VaultTrackConfig

```solidity
struct VaultTrackConfig {
    address vault;
    uint256 trackId;
    uint256 initialAllocation;
    uint256 maxAllocation;
    uint256 maxDrawdownBps;
    uint256 maxTradeSizeBps;
    uint256 maxDailyTurnoverBps;
    uint256 maxDailyLossBps;     // realized daily loss cap vs allocation.cap; 0 = disabled
    uint256 evaluationPeriod;
    uint256 minTrades;
    uint256 promotionScore;
    bool active;
    uint256 maxStopLossBps;      // per-position SL cap in bps; 0 = no cap (not coupled to maxDrawdownBps)
    uint256 minTakeProfitBps;    // minimum TP trigger in bps; 0 = no floor
    uint256 maxTakeProfitBps;    // maximum TP trigger in bps; 0 = no cap
    bool requireStopLoss;        // when true, exit ladders must include at least one StopLoss rule
    bool requireTakeProfit;      // when true, exit ladders must include at least one TakeProfit rule
}
```

`TradeRouter._validateExitRulesForTrack` enforces exit-bound fields on `openPosition` and `updateExitLadder`. Defaults in `script/config/VaultTrackPolicies.sol` (applied by `DeployVaultInfrastructure` / `DeployFullStack`): Challenge SL ≤15%, TP uncapped, `requireTakeProfit` false; Funded SL ≤12%, TP +2%–+80%, `requireTakeProfit` true; Prime SL ≤10%, TP +5%–+50%, `requireTakeProfit` true; all tracks require at least one stop-loss on open/update.

Promotion fees are configured in `FeeManager` per `(vault, fromTrack, toTrack)`, not in `VaultTrackConfig`. Tradable assets are enforced via vault + `TokenRegistry` allowlists, not per-track asset lists.

---

## 5.4 MandateVault (ERC-4626)

### Purpose

Tokenized capital pool for a thematic mandate. Capital providers deposit; agents on Funded/Prime receive allocation from the same vault they are bound to.

### Standard

Implement [ERC-4626](https://eips.ethereum.org/EIPS/eip-4626) Tokenized Vault Standard.

### Responsibilities

- accept deposits / process withdrawals (shares)
- expose total assets, idle vs allocated capital
- store vault-level configuration and enforceable rules
- restrict which tokens the vault may hold
- restrict trade execution to approved controllers/routers
- receive profits/losses from agent activity

### Vault Config (per deployment)

```solidity
struct VaultConfig {
    address vault;
    bytes32 name; // e.g. FOUNDATION, TECH, VOLATILITY, MACRO
    address depositAsset; // e.g. USDC
    address[] allowedHoldTokens;
    address[] allowedTradeAssets;
    address[] allowedVenues;
    bool active;
}
```

### MVP Design

Deploy **4 ERC-4626 vault instances** with distinct mandates (e.g. Foundation, Tech, Volatility, Macro).

Agents bind to one vault for their full lifecycle.

Challenge uses **simulated allocation** scoped to `(agentId, vaultId, Challenge)` — no provider principal at risk.

Funded and Prime allocate **real vault capital** to promoted agents.

Vault factory pattern is recommended for scaling beyond MVP.

---

## 5.5 AllocationManager

### Purpose

Controls capital assigned to agents.

### Responsibilities

- create initial allocation
- increase allocation
- reduce allocation
- remove allocation
- enforce vault + track caps
- expose current allocation to execution/risk contracts
- emit allocation events
- support simulated allocations for Challenge

### Allocation State

```solidity
struct Allocation {
    uint256 agentId;
    address vault;
    uint256 trackId;
    uint256 amount;
    bool isSimulated;
    uint256 createdAt;
    uint256 updatedAt;
    AllocationStatus status;
}
```

---

## 5.6 FeeManager

### Purpose

Defines and collects protocol fees for agent registration and track promotion.

### Responsibilities

- set registration fee (asset + amount; default USDC)
- set promotion fees per `(vault, fromTrack, toTrack)` transition
- collect fees to treasury or configured recipients
- expose fee quotes to frontend/MCP
- verify fee payment before registration or promotion completes

### Key Functions

```solidity
setRegistrationFee(address asset, uint256 amount)
setPromotionFee(address vault, uint256 fromTrackId, uint256 toTrackId, address asset, uint256 amount)
getRegistrationFee() returns (address asset, uint256 amount)
getPromotionFee(address vault, uint256 fromTrackId, uint256 toTrackId) returns (address asset, uint256 amount)
payRegistrationFee(address payer, uint256 agentId)
payPromotionFee(address payer, uint256 agentId, uint256 toTrackId)
```

### Events

```solidity
RegistrationFeePaid(agentId, payer, asset, amount)
PromotionFeePaid(agentId, vault, fromTrackId, toTrackId, payer, asset, amount)
```

---

## 5.7 IntentValidator

### Purpose

Validates signed agent trade intents before execution.

**MVP implementation:** Validation is performed inside `TradeRouter.openPosition` (EIP-712 `OpenPosition` type, nonce, deadline, agent signer, track/vault rules). A standalone contract is deferred unless multi-router settlement is needed.

### Responsibilities

- verify EIP-712 agent signature
- verify nonce
- verify deadline
- verify agent status
- verify track/vault permission
- verify asset allowlist
- verify venue/adapter allowlist
- verify intent constraints
- prevent replay attacks

### Trade Intent

```solidity
struct TradeIntent {
    uint256 chainId;
    uint256 agentId;
    uint256 trackId;
    address vault;
    address inputAsset;
    address outputAsset;
    uint256 inputAmount;
    uint256 minOutputAmount;
    uint256 maxSlippageBps;
    uint256 deadline;
    uint256 nonce;
}
```

### Key Functions

```solidity
validateTradeIntent(intent, signature)
consumeNonce(agentId, nonce)
isNonceUsed(agentId, nonce)
```

---

## 5.8 ExecutionController

### Purpose

Controls who can submit execution transactions and under what conditions.

**MVP implementation:** Replaced by role gating on `TradeRouter`:

- `EXECUTOR_ROLE` — may relay signed `openPosition`, `addToPosition`, `reducePosition`, and `updateExitLadder` intents
- `OPERATOR_ROLE` — may call `forceClose` when agent is `Suspended`
- Any address — may call `executeExit` when an exit rule triggers (keeper bounty)

### Responsibilities

- verify executor is approved
- verify agent is active
- verify allocation is available
- enforce route/venue whitelist
- enforce execution adapter whitelist
- emit trade intent and execution events

### MVP Approach

For MVP, use:

```text
Agent signed intent
  ↓
AlphaGrid backend validation
  ↓
AlphaGrid-controlled executor
  ↓
on-chain permission checks
```

Avoid arbitrary execution and direct agent transactions in MVP.

---

## 5.9 TradeRouter

### Purpose

On-chain execution entrypoint for all approved trade settlement. **Only** path that may move vault assets for agent trades.

### Responsibilities

- validate EIP-712 position intents (agent signature, nonce, deadline)
- enforce agent status, vault track active, allocation, max trade size, max daily turnover, and per-track exit bounds
- open and adjust positions via approved `ISwapAdapter`
- execute exit ladder rules (`StopLoss` / `TakeProfit`; partial exits of remaining size)
- pay keeper bounty on permissionless `executeExit`
- operator `forceClose` when agent is `Suspended` (bypasses vault trading pause)
- maintain per-agent nonces and daily turnover accounting
- emit position and execution events for indexer consumption

### Position intents

Agents sign EIP-712 intents; schema: `contracts/docs/position-intent-eip712.md`.

| Intent | Purpose |
|--------|---------|
| `OpenPosition` | Open a new position with exit ladder (`exitsHash`) |
| `AddToPosition` | Buy more into an open position; blended entry price; ladder unchanged |
| `ReducePosition` | Discretionary partial or full sell (`exitBps` of **remaining** tokens; `10000` = full close) |
| `UpdateExitLadder` | Replace **pending** rules from `nextRuleIndex` onward; consumed steps unchanged |

```solidity
struct PositionIntent {
    uint256 agentId;
    address vault;
    address token;
    uint256 usdcAmount;
    uint256 minTokenOut;
    uint16 maxSlippageBps;
    ExitRule[] exits;   // last rule must exit 100% of remaining
    uint256 deadline;
    uint256 nonce;
}

struct AddToPositionIntent {
    uint256 agentId;
    uint256 positionId;
    uint256 usdcAmount;
    uint256 minTokenOut;
    uint16 maxSlippageBps;
    uint256 deadline;
    uint256 nonce;
}

struct ReducePositionIntent {
    uint256 agentId;
    uint256 positionId;
    uint16 exitBps;
    uint256 deadline;
    uint256 nonce;
}

struct UpdateExitLadderIntent {
    uint256 agentId;
    uint256 positionId;
    ExitRule[] exits;   // pending rules only; hashed as exitsHash in signature
    uint256 deadline;
    uint256 nonce;
}
```

### Keeper vs agent exits

| Path | Who | Trigger | Advances ladder |
|------|-----|---------|-----------------|
| `executeExit` | Anyone (keeper bounty) | Current rule PnL trigger | Yes (`applyLadderExit`) |
| `reducePosition` | Agent (signed) | Anytime | No (`applyDiscretionaryReduce`) |
| `updateExitLadder` | Agent (signed) | Changes future automation | No |
| `forceClose` | Operator | Agent `Suspended` | No (discretionary) |

### Key functions

```solidity
openPosition(PositionIntent calldata intent, bytes calldata signature)           // EXECUTOR_ROLE
addToPosition(AddToPositionIntent calldata intent, bytes calldata signature)     // EXECUTOR_ROLE
reducePosition(ReducePositionIntent calldata intent, bytes calldata signature) // EXECUTOR_ROLE
updateExitLadder(UpdateExitLadderIntent calldata intent, bytes calldata signature) // EXECUTOR_ROLE
executeExit(uint256 positionId) external                                         // permissionless keeper
forceClose(uint256 positionId) external                                          // OPERATOR_ROLE; agent Suspended
```

### Design rules

- Executors do not control vault withdrawals or admin actions.
- Opens and adds respect `AgentRegistry` pause and vault `tradingPaused`; routine pulls blocked when trading paused.
- `forceClose` remains available when trading is paused so operators can flatten suspended agents.
- Registry pause blocks **new opens and adds**; reduce, ladder update, keeper exits, and force-close policies differ (see pause matrix).
- `updateExitLadder` reverts `PendingRuleAlreadyTriggered` when the first new pending rule would already fire; agent must `reducePosition` instead.
- Swap adapters receive pulled assets in-transaction; no standalone agent wallet execution.

### Pause matrix

| Intent | `AgentRegistry` paused | Vault `tradingPaused` |
|--------|------------------------|------------------------|
| `openPosition` | Block | Block |
| `addToPosition` | Block | Block |
| `reducePosition` | Allow | Block |
| `updateExitLadder` | Allow | Allow |
| `executeExit` | Allow | Block |
| `forceClose` | Allow | Allow |

### Related contracts

- `PositionManager` — stores positions and per-agent token ledger; `applyLadderExit` (keeper) vs `applyDiscretionaryReduce` (agent/operator); `increasePosition`, `updatePendingExitRules`; only `TradeRouter` may mutate.
- `MandateVault` — `TRADE_ROUTER_ROLE` for `pullUsdcForTrade` / `pullTokenForTrade` / force-close pulls.
- `AllocationManager` — `TRADE_ROUTER_ROLE` for allocation usage updates on open and add.

---

## 5.10 ExecutorRegistry

### Purpose

Manages approved executors/solvers.

### Responsibilities

- register executor
- set executor status
- track executor reputation
- optionally require stake/bond
- optionally slash objectively invalid behavior
- expose executor permissions to `ExecutionController`

### Executor Types

| Type               | Description                                       |
| ------------------ | ------------------------------------------------- |
| AlphaGrid Executor | Default MVP executor operated by AlphaGrid.       |
| Approved Executor  | Trusted external party allowed to settle intents. |
| Solver             | Competes to provide best valid execution.         |
| Fallback Executor  | Emergency executor for liveness.                  |

### Long-Term Incentives

Executors may earn:

```text
base fee
+ execution bps
+ price improvement bonus
- penalties for failed/spam execution
```

---

## 5.11 RiskManager

### Purpose

Stores risk rules and can pause or restrict agents.

**MVP implementation:** On-chain guardrails are split across contracts:

- `VaultTrackRegistry` — `maxTradeSizeBps`, `maxDailyTurnoverBps`, exit bounds (`maxStopLossBps`, `minTakeProfitBps`, `maxTakeProfitBps`, `requireStopLoss`, `requireTakeProfit`), track caps; promotion criteria stored for off-chain use
- `TradeRouter` — enforces trade size and daily turnover on open/add/reduce; exit bounds on open and ladder update
- `AgentRegistry` — agent status, global pause (blocks opens and adds; reduce/ladder update allowed)
- `MandateVault` — `liquidityPaused` / `tradingPaused`, token allowlist

Drawdown breach, Alpha Score graduation, and automated fail/promote actions remain **off-chain** (performance + risk engines) with operator execution on-chain in MVP.

### Responsibilities

- pause agent
- mark failed
- enforce drawdown breach actions
- enforce max trade size
- enforce max exposure
- enforce max turnover
- expose emergency controls
- integrate with risk engine outputs

---

## 6. Backend Services

## 6.1 API Service

**Implementation status:** see `09_implementation_status.md` §4 (routes, MCP tools, checklists). Operational detail: `api/README.md`.

Responsibilities (full MVP):

- serve agent profiles
- serve leaderboards
- manage metadata
- handle admin actions
- expose public analytics
- integrate with auth
- prepare trade requests if needed

Suggested stack for remaining MVP services:

- TypeScript (Worker or Node)
- PostgreSQL _(deferred until indexer/leaderboard; current API uses RPC reads)_
- Redis for caching / queues _(optional)_
- REST or GraphQL API

---

## 6.2 Agent Service

Responsibilities:

- authenticate agent execution requests
- validate agent status
- rate-limit agents
- expose agent config
- expose vault/track rules
- route trade intents to Intent Gateway
- log actions

Agent authentication options:

1. wallet signature
2. API key bound to wallet
3. delegated signer
4. session key

Recommended MVP:

> Wallet-bound API key plus agent signing key.

API key controls access.

Agent signature proves intent authorship.

---

## 6.3 MCP Server

### Purpose

Provides AI-native access to AlphaGrid.

Agents should use MCP tools to inspect state and submit actions without needing to understand the full frontend or raw contract interface.

### Recommended Tools

```text
get_agent_status
get_available_tracks
get_track_rules
get_vault_state
get_portfolio
get_positions
get_market_data
submit_trade_intent
submit_rebalance_intent
get_trade_history
get_performance_metrics
get_risk_state
```

### Restricted Tools

MCP should not expose:

```text
withdraw
transfer
change_vault_config
increase_limits
change_owner
change_execution_address
```

---

## 6.4 Intent Gateway

### Purpose

Receives signed agent intents and prepares them for execution.

Responsibilities:

- receive agent trade intent
- verify API auth
- verify agent signature
- validate schema
- validate nonce/deadline
- run off-chain risk pre-check
- simulate execution if possible
- route to AlphaGrid executor or executor network
- store intent state
- emit internal event

Trade intent example:

```json
{
  "agentId": "123",
  "trackId": "1",
  "action": "swap",
  "inputAsset": "USDC",
  "outputAsset": "NVDA",
  "amount": "1000",
  "minOutputAmount": "5.32",
  "maxSlippageBps": 50,
  "venue": "approved_tokenized_stock_venue",
  "deadline": 1710000000,
  "nonce": 42,
  "signature": "0x..."
}
```

---

## 6.5 Execution Gateway

### Purpose

Routes validated intents to executors.

Responsibilities:

- pick execution path
- submit transaction via AlphaGrid executor in MVP
- route to approved executor network later
- monitor tx status
- retry failed execution where safe
- store execution result
- expose execution status to agent
- emit execution events

Execution modes:

| Mode                   | Description                                     | Protocol rollout    |
| ---------------------- | ----------------------------------------------- | ------------------- |
| Central Executor       | AlphaGrid submits txs.                          | MVP                 |
| Permissioned Executors | Approved external executors can settle intents. | Later               |
| Solver Auction         | Solvers compete for best execution.             | Later               |
| Direct Agent Execution | Agents submit constrained txs directly.         | Advanced / optional |

---

## 6.6 OIF Compatibility Layer

### Purpose

Make AlphaGrid intents compatible with Open Intents Framework-style execution without depending on it for MVP.

AlphaGrid should maintain its own intent schema but design it so it can map into OIF-compatible order formats later.

### Responsibilities

- map `AlphaGridTradeIntent` to OIF-compatible intent format
- support external solvers/executors
- support cross-chain settlement where relevant
- preserve AlphaGrid-specific validation before settlement
- keep agent/vault/risk logic independent from OIF

### Design Principle

OIF can help answer:

```text
Was the intent fulfilled?
```

AlphaGrid must answer:

```text
Was this trade allowed for this agent, vault, track, and risk state?
```

The second layer remains AlphaGrid-specific.

---

## 6.7 Indexer

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

## 6.8 Performance Engine

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

## 6.9 Risk Engine

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
- invalid venue
- abnormal execution pattern
- repeated failed intents

---

## 7. Database Model

**Implementation note:** The `api/` Worker does not use PostgreSQL yet. Agent and vault reads go through RPC (`viem`). Progress on indexer and DB: `09_implementation_status.md` §4. The schema below is the target model once an indexer and leaderboard land.

### 7.1 Tables

Recommended MVP tables:

- `users`
- `agents`
- `agent_credentials`
- `tracks`
- `agent_track_entries`
- `vaults`
- `allocations`
- `trade_intents`
- `trades`
- `executors`
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
  signer_address TEXT NOT NULL,
  payout_recipient TEXT,
  erc8004_agent_id NUMERIC,
  name TEXT NOT NULL,
  description TEXT,
  metadata_uri TEXT,
  status TEXT NOT NULL,
  vault_address TEXT NOT NULL,
  current_track_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

**Deferred:** separate `execution_address` column — MVP uses `signer_address` for intent signing.

---

## 7.3 Trade Intents Table

```sql
CREATE TABLE trade_intents (
  id UUID PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id),
  track_id UUID NOT NULL REFERENCES tracks(id),
  intent_hash TEXT NOT NULL UNIQUE,
  input_asset TEXT NOT NULL,
  output_asset TEXT NOT NULL,
  input_amount NUMERIC NOT NULL,
  min_output_amount NUMERIC,
  max_slippage_bps INTEGER,
  venue TEXT,
  nonce NUMERIC NOT NULL,
  deadline TIMESTAMP NOT NULL,
  signature TEXT NOT NULL,
  status TEXT NOT NULL,
  rejection_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## 7.4 Trades Table

```sql
CREATE TABLE trades (
  id UUID PRIMARY KEY,
  intent_id UUID REFERENCES trade_intents(id),
  agent_id UUID NOT NULL REFERENCES agents(id),
  track_id UUID NOT NULL REFERENCES tracks(id),
  executor_id UUID,
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

## 7.5 Executors Table

```sql
CREATE TABLE executors (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  status TEXT NOT NULL,
  type TEXT NOT NULL,
  reputation_score NUMERIC,
  successful_trades INTEGER NOT NULL DEFAULT 0,
  failed_trades INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT now(),
  updated_at TIMESTAMP NOT NULL DEFAULT now()
);
```

---

## 7.6 Performance Snapshots

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
POST /agents/:id/enter-challenge
POST /agents/:id/promote
POST /agents/:id/trade-intents
GET /agents/:id/status
GET /agents/:id/config
GET /agents/:id/positions
GET /agents/:id/risk-state
```

### Intent / Execution APIs

```text
POST /intents/trade
GET /intents/:id
GET /intents/:id/execution
POST /intents/:id/cancel
```

### MCP Tools

```text
get_agent_status
get_track_rules
get_portfolio
get_positions
get_market_data
submit_trade_intent
get_intent_status
get_performance_metrics
get_risk_state
```

### Capital Provider APIs

```text
GET /vaults
GET /vaults/:vaultId
POST /vaults/:vaultId/deposit
POST /vaults/:vaultId/withdraw
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
POST /admin/executors
PATCH /admin/executors/:id
POST /admin/system/emergency-pause
```

---

## 9. Execution Design

### MVP Recommendation

Do not allow agents to execute arbitrary transactions.

Use a constrained intent model:

```text
Agent signs position intent (OpenPosition / AddToPosition / ReducePosition / UpdateExitLadder)
  ↓
API validates schema and EIP-712 signature (open + adjust paths implemented)
  ↓
Risk engine validates limits (off-chain; partial mirror on-chain)
  ↓
AlphaGrid executor (EXECUTOR_ROLE) relays signed intent to TradeRouter
  ↓
TradeRouter verifies signature, nonce, deadline, track exit bounds (open/update), allocation, trade size
  ↓
Vault + AllocationManager + PositionManager updated; adapter swaps on open/add/reduce
  ↓
Keepers call executeExit when price triggers fire (permissionless); agent may reduce or update pending ladder earlier
  ↓
Indexer records result (off-chain; not yet built)
```

---

## 9.1 Execution Modes

### Mode 1: Centralized AlphaGrid Executor

MVP default.

```text
Agent signs intent
  ↓
AlphaGrid validates
  ↓
AlphaGrid executes
```

Pros:

- fastest MVP
- safest capital control
- easiest debugging
- best operational control

Cons:

- more centralized
- AlphaGrid handles execution liveness

---

### Mode 2: Permissioned Executor Network

Recommended after MVP (permissioned executor network).

```text
Agent signs intent
  ↓
AlphaGrid validates
  ↓
approved executors compete / route
  ↓
contracts enforce final validity
```

Pros:

- more decentralized
- better liveness
- external execution competition
- cleaner separation between strategy and execution

Cons:

- executor registry required
- incentive model required
- monitoring/reputation needed

---

### Mode 3: OIF-Compatible Solver Layer

Recommended after permissioned executors (solver / OIF layer).

```text
Agent signs AlphaGrid intent
  ↓
intent maps to OIF-compatible format
  ↓
solvers compete
  ↓
AlphaGrid contracts enforce vault/risk validity
  ↓
trade settles
```

Pros:

- open execution infrastructure
- cross-chain extensibility
- solver ecosystem compatibility

Cons:

- additional integration complexity
- AlphaGrid-specific risk logic still required
- not necessary for MVP

---

### Mode 4: Direct Agent Execution

Advanced optional mode.

```text
Agent signs and submits tx directly
  ↓
TradeRouter validates constraints
  ↓
trade executes
```

This should not be the default.

Use only for:

- Prime agents
- strict session keys
- limited vaults
- limited assets
- low-risk execution paths

Risks:

- agent key compromise
- nonce/RPC/gas failures
- spam trades
- poor execution quality
- weaker control over execution path

---

## 10. Security Assumptions

### Required MVP Controls

- emergency pause
- per-agent pause
- track-level pause
- asset allowlist
- venue allowlist
- adapter allowlist
- max trade size
- max daily loss
- max drawdown
- max turnover
- admin action audit log
- replay protection for agent requests
- EIP-712 signed intents
- nonce management
- deadline enforcement
- rate limiting
- executor allowlist
- execution simulation where possible

---

## 10.1 Executor Security

Executors must not be able to:

```text
withdraw funds
transfer vault assets directly
change vault config
change risk limits
change agent status
change allocation
execute unsupported routes
```

Executors can only:

```text
submit valid signed intents
route through approved adapters
receive execution fee if successful
```

Slashable or punishable behavior should only include objectively provable failures:

```text
executing expired intent
submitting invalid route
using unauthorized adapter
repeated spam/reverts
manipulated execution proof
```

---

## 11. Infrastructure

Recommended MVP infrastructure:

| Layer           | Option                                              |
| --------------- | --------------------------------------------------- |
| Frontend        | Next.js / Vercel                                    |
| Backend         | Cloudflare Workers (`api/`) or Node.js / TypeScript |
| DB              | PostgreSQL _(when indexer/leaderboard land)_        |
| Cache / Queue   | Redis                                               |
| Indexer         | Ponder or custom indexer                            |
| Contracts       | Solidity + Foundry                                  |
| Monitoring      | BetterStack / Grafana                               |
| Logs            | Axiom / Datadog / Grafana Loki                      |
| Storage         | S3-compatible object storage                        |
| Agent Interface | REST API + MCP server                               |
| Execution       | AlphaGrid executor first, executor network later    |

---

## 12. MVP Technical Scope

On-chain, off-chain, and remaining MVP scope (checklists and phases) are maintained in **`09_implementation_status.md`** §3–§6. This section is intentionally brief to avoid duplicating that document.

**Design targets not yet built:** indexer, intent gateway, executor service, performance/risk engines, leaderboard, admin console, frontend. **Deferred post-MVP on-chain:** OIF, solvers, multi-chain, on-chain scoring, leverage, executor staking — see `09_implementation_status.md` §8.

---

## 13. Recommended Technical Direction

AlphaGrid should start with:

```text
Agent signed intents
+ AlphaGrid-controlled execution
+ on-chain vault/risk enforcement
```

Then evolve into:

```text
Agent signed intents
+ permissioned executor network
+ OIF-compatible solver layer
+ on-chain settlement enforcement
```

Direct agent execution should remain an advanced mode, not the default.

Final target architecture:

```text
Agents decide.
Vaults constrain.
Executors settle.
Contracts enforce.
OIF-compatible infrastructure expands execution reach.
```
