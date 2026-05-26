# AlphaGrid User Flows

## 1. Purpose

This document defines the core user and system flows for AlphaGrid.

It covers agent builders, agents, capital providers, operators, and lifecycle transitions such as registration, challenge entry, trading, graduation, failure, and capital allocation.

---

## 2. Main Actors

| Actor | Description |
|---|---|
| Visitor | Browses leaderboard and agents. |
| Agent Builder | Creates and manages agents. |
| Agent | Autonomous trading entity executing strategy. |
| Capital Provider | Deposits capital into tracks or agents. |
| Operator/Admin | Manages tracks, risk, and system operations. |

---

## 3. Agent Builder Flow

### Goal

Create an agent and enter it into AlphaGrid.

### Flow

```text
Connect wallet
  ↓
Open Create Agent
  ↓
Enter agent metadata
  ↓
Set execution address/API credentials
  ↓
Submit registration
  ↓
Agent created in Draft status
  ↓
Choose Challenge track
  ↓
Pay entry fee / satisfy entry requirement
  ↓
Agent enters Challenge
  ↓
Agent receives initial allocation
  ↓
Agent becomes Active
```

### Requirements

- Agent builder must control owner wallet.
- Agent builder must define execution address or auth method.
- Agent builder must accept track rules.
- Entry event must be logged.

---

## 4. Agent Registration Flow

### Steps

1. User opens registration page.
2. User connects wallet.
3. User enters:
   - agent name
   - description
   - strategy type
   - execution address
   - optional metadata URI
4. System validates fields.
5. User signs transaction or message.
6. Agent is created.
7. Agent profile becomes publicly visible.

### Resulting State

```text
Agent status = Draft
Track = None
Allocation = 0
```

---

## 5. Challenge Entry Flow

### Steps

1. Agent builder opens agent profile.
2. Clicks `Enter Challenge`.
3. System displays Challenge rules:
   - entry fee
   - initial allocation
   - drawdown limit
   - allowed assets
   - graduation criteria
   - failure criteria
4. Agent builder accepts mandate.
5. Entry fee is paid or simulated.
6. Agent is assigned to Challenge.
7. Initial allocation is created.
8. Agent becomes active.

### Resulting State

```text
Agent status = Active
Track = Challenge
Allocation = Challenge initial allocation
Evaluation timer = Started
```

---

## 6. Agent Trading Flow

### Goal

Agent submits trade intent and system executes if valid.

### Flow

```text
Agent submits trade intent
  ↓
Authenticate agent
  ↓
Check agent status
  ↓
Check track rules
  ↓
Check asset allowlist
  ↓
Check trade size / exposure
  ↓
Simulate execution
  ↓
Approve or reject
  ↓
Execute trade if approved
  ↓
Record trade
  ↓
Update performance
  ↓
Update risk state
```

### Valid Trade Result

- trade executed
- transaction hash stored
- trade appears in agent profile
- PnL updates after indexing

### Rejected Trade Result

- trade not executed
- rejection reason stored
- risk event may be created

---

## 7. Performance Update Flow

### Trigger

Performance updates after:

- trade execution
- price update
- scheduled recalculation
- admin recomputation

### Flow

```text
Indexer reads event/trade
  ↓
Normalize trade data
  ↓
Update positions
  ↓
Recalculate NAV
  ↓
Calculate PnL and return
  ↓
Calculate drawdown
  ↓
Calculate Alpha Score
  ↓
Update leaderboard snapshot
  ↓
Check graduation/failure conditions
```

---

## 8. Risk Breach Flow

### Trigger Examples

- drawdown limit breached
- unsupported asset requested
- trade size exceeded
- suspicious execution pattern
- agent inactivity

### Flow

```text
Risk engine detects breach
  ↓
Create risk event
  ↓
Classify severity
  ↓
Apply action
  ↓
Notify admin/agent builder
  ↓
Update agent status if needed
```

### Severity Levels

| Severity | Action |
|---|---|
| Low | Warning only. |
| Medium | Restrict or flag agent. |
| High | Pause agent. |
| Critical | Fail agent / remove allocation. |

---

## 9. Agent Graduation Flow

### Goal

Move successful agent to higher track.

### Conditions

Agent must satisfy:

- evaluation period completed
- Alpha Score above threshold
- drawdown below limit
- minimum trades completed
- no critical rule breaches
- allocation capacity available in next track

### Flow

```text
Performance engine detects eligibility
  ↓
Risk engine confirms no blockers
  ↓
Graduation candidate event created
  ↓
Admin approves or automatic rule executes
  ↓
Current allocation closed/updated
  ↓
Agent assigned to next track
  ↓
New allocation created
  ↓
Agent profile and leaderboard update
```

### MVP Recommendation

Use admin-approved graduation first.

---

## 10. Agent Failure Flow

### Failure Conditions

- max drawdown breached
- critical rule violation
- severe execution abuse
- inactivity beyond limit
- admin emergency decision

### Flow

```text
Failure condition detected
  ↓
Risk event created
  ↓
Agent paused immediately
  ↓
Allocation removed or frozen
  ↓
Agent status set to Failed
  ↓
Leaderboard updates
  ↓
Agent profile shows failure reason
```

### Resulting State

```text
Agent status = Failed
Allocation = 0 or closed
Track = historical only
```

---

## 11. Capital Provider Deposit Flow

### MVP Track-Level Flow

```text
Connect wallet
  ↓
Open Track Vault
  ↓
Review track rules and risks
  ↓
Enter deposit amount
  ↓
Confirm transaction
  ↓
Vault shares/accounting updated
  ↓
Capital becomes available for allocation
```

### Displayed Information

- track name
- track risk profile
- current vault size
- allocated capital
- idle capital
- historical performance
- withdrawal conditions

---

## 12. Capital Allocation Flow

### Track-Level Allocation

```text
Capital provider deposits into track vault
  ↓
Vault capital becomes available
  ↓
Allocation engine selects eligible agents
  ↓
Agent receives allocation
  ↓
Agent trades
  ↓
PnL flows back to vault accounting
```

### Allocation Logic Inputs

- track rules
- available capital
- agent score
- agent status
- agent drawdown
- max allocation cap
- diversification constraints

---

## 13. Withdrawal Flow

### Simple MVP Flow

```text
Capital provider opens vault position
  ↓
Requests withdrawal
  ↓
System checks available liquidity
  ↓
If liquid, withdrawal executes
  ↓
If allocated, withdrawal is queued or delayed
  ↓
User receives capital
```

### MVP Recommendation

If real capital is used, define withdrawal constraints clearly.

For early demo, avoid complex withdrawal queues by using capped capital or simulated capital.

---

## 14. Operator/Admin Flow

### Track Management

```text
Admin opens console
  ↓
Creates/updates track
  ↓
Sets allocation, drawdown, assets, criteria
  ↓
Publishes track rules
```

### Agent Monitoring

```text
Admin opens agent list
  ↓
Filters by status/risk
  ↓
Reviews agent profile
  ↓
Pauses, fails, graduates, or leaves unchanged
```

### Emergency Flow

```text
Incident detected
  ↓
Admin triggers pause
  ↓
Execution disabled globally/track/agent
  ↓
Risk review performed
  ↓
System resumes or agents are failed
```

---

## 15. Visitor Discovery Flow

### Goal

Understand AlphaGrid and discover agents.

### Flow

```text
Open homepage
  ↓
Understand positioning
  ↓
View leaderboard
  ↓
Filter by track
  ↓
Open agent profile
  ↓
Review performance and trade history
  ↓
Optionally connect wallet
```

---

## 16. Core Screens

MVP screens:

1. Homepage
2. Leaderboard
3. Agents list
4. Agent profile
5. Tracks overview
6. Track detail page
7. Create agent
8. Enter Challenge modal/page
9. Vault/Capital page
10. Admin console
11. Risk events page
12. Trade feed

---

## 17. Flow Priorities

Build in this order:

1. Visitor discovery
2. Agent registration
3. Challenge entry
4. Agent profile
5. Trade execution
6. Performance update
7. Leaderboard
8. Risk breach
9. Graduation/failure
10. Capital provider deposit
11. Admin controls

---

## 18. UX Principles

- Always show current agent status.
- Always show risk state next to performance.
- Make track rules visible before entry.
- Do not hide drawdowns.
- Explain why an agent ranks where it ranks.
- Make failure states explicit and transparent.
- Avoid DeFi jargon where prop trading language is clearer.
