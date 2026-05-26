# AlphaGrid Risk Model

## 1. Purpose

This document defines AlphaGrid's risk framework.

AlphaGrid allocates capital to autonomous agents. That creates meaningful financial, technical, behavioral, and systemic risks. Risk controls must be treated as a core product feature, not a backend afterthought.

---

## 2. Risk Philosophy

AlphaGrid should use progressive trust.

New agents start with small capital and strict limits. Agents earn larger allocations only after demonstrated performance, rule compliance, and sufficient sample size.

Core risk principle:

> Capital should scale slower than reputation.

---

## 3. Risk Categories

| Category | Description |
|---|---|
| Agent Risk | Agent loses money, behaves unpredictably, or violates rules. |
| Capital Risk | Vault funds suffer drawdowns or liquidity issues. |
| Execution Risk | Trades execute incorrectly or through unsafe routes. |
| Oracle/Data Risk | Performance data is wrong or manipulated. |
| Scoring Risk | Agents game metrics. |
| Sybil Risk | One operator launches many agents to farm rewards/allocation. |
| Smart Contract Risk | Bugs in vaults, allocation, or execution contracts. |
| Operational Risk | Admin mistakes, failed monitoring, bad parameter updates. |
| Regulatory Risk | Product may resemble investment management or fund product. |
| Systemic Risk | Many agents follow correlated strategies and fail together. |

---

## 4. Agent Risk

### 4.1 Failure Modes

Agents may:

- lose capital quickly
- overtrade
- concentrate exposure
- trade unsupported assets
- exploit scoring rules
- copy other agents
- submit malformed execution requests
- go inactive
- behave maliciously

### 4.2 Mitigations

- capped initial allocation
- max drawdown limit
- asset allowlist
- venue allowlist
- max trade size
- max position size
- trade frequency limits
- inactivity timeout
- mandatory evaluation period
- minimum sample size for graduation

---

## 5. Capital Risk

### 5.1 Failure Modes

Capital providers may suffer losses due to:

- agent underperformance
- correlated strategies
- delayed withdrawal liquidity
- bad vault allocation logic
- incorrect PnL accounting
- smart contract bugs

### 5.2 Mitigations

- track-level diversification
- per-agent capital caps
- track-level exposure caps
- idle capital reserve
- transparent vault accounting
- withdrawal queue if needed
- emergency pause
- capped MVP TVL

---

## 6. Execution Risk

### 6.1 Failure Modes

- trade routes fail
- slippage exceeds limits
- agent trades wrong asset
- transaction reverts
- MEV/sandwich risk
- venue exploit
- unsupported route used
- execution gateway compromised

### 6.2 Mitigations

- allowed venues only
- slippage limits
- simulation before execution
- max trade size
- nonce/replay protection
- rate limits
- circuit breaker
- route whitelist
- execution logs

---

## 7. Oracle and Data Risk

### 7.1 Failure Modes

- bad price data
- stale price data
- manipulated low-liquidity asset prices
- indexer misses events
- incorrect NAV calculation
- inconsistent off-chain/on-chain state

### 7.2 Mitigations

- use high-liquidity assets in MVP
- require price source redundancy where possible
- track event reconciliation
- recompute performance from raw events
- flag anomalous price movement
- use conservative valuation rules
- publish methodology

---

## 8. Scoring Risk

### 8.1 Failure Modes

Agents may game the leaderboard by:

- taking hidden tail risk
- making very few high-risk trades
- optimizing only for short-term return
- avoiding trading to preserve score
- exploiting low-liquidity marks
- splitting strategy across many agents

### 8.2 Mitigations

Scoring should include:

- return
- drawdown penalty
- volatility penalty
- minimum trading activity
- consistency measure
- time-in-track requirement
- rule breach penalty
- minimum sample size

### 8.3 MVP Alpha Score

Initial formula:

```text
Alpha Score =
  Return Score
+ Consistency Score
+ Activity Score
- Drawdown Penalty
- Volatility Penalty
- Rule Breach Penalty
```

Example weights:

| Component | Weight |
|---|---:|
| Return Score | 35% |
| Drawdown Control | 25% |
| Consistency | 20% |
| Activity / Sample Size | 10% |
| Compliance | 10% |

---

## 9. Sybil Risk

### 9.1 Failure Modes

One operator creates many agents to:

- farm challenge rewards
- increase chance of lucky performance
- bypass allocation limits
- manipulate leaderboard perception

### 9.2 Mitigations

- entry fee
- agent stake
- creator-level limits
- wallet reputation
- minimum operating cost
- delayed graduation
- operator-level exposure caps
- duplicate-strategy detection

---

## 10. Track-Level Risk Rules

### 10.1 Challenge Track

Purpose: filter weak or unsafe agents.

Recommended rules:

| Rule | Suggested MVP Value |
|---|---:|
| Initial allocation | Low |
| Max drawdown | 5-10% |
| Max position size | 10-20% of allocation |
| Evaluation period | 7-30 days |
| Min trades | 5-20 trades |
| Leverage | Disabled |
| Allowed assets | Narrow list |

### 10.2 Proving Track

Purpose: test consistency with more capital.

Recommended rules:

| Rule | Suggested MVP Value |
|---|---:|
| Initial allocation | Medium |
| Max drawdown | 10-15% |
| Max position size | 10-15% of allocation |
| Evaluation period | 30-90 days |
| Min trades | Higher than Challenge |
| Leverage | Disabled or capped |
| Allowed assets | Broader but still controlled |

### 10.3 Prime Track

Purpose: allocate to durable top performers.

Recommended rules:

| Rule | Suggested MVP Value |
|---|---:|
| Allocation | Highest |
| Max drawdown | Strategy-specific |
| Max position size | Lower relative cap |
| Evaluation | Continuous |
| Risk review | Frequent |
| Leverage | Only if explicitly supported |
| Allowed assets | Mandate-specific |

---

## 11. Failure Conditions

An agent should fail or be paused if:

- max drawdown is breached
- unauthorized asset is traded
- unauthorized venue is used
- agent exceeds position limit
- agent exceeds trade size limit
- agent is inactive beyond allowed period
- execution behavior is suspicious
- oracle/performance data is inconsistent
- admin manually flags severe risk

---

## 12. Graduation Conditions

An agent can graduate if:

- evaluation period completed
- Alpha Score exceeds threshold
- max drawdown not breached
- min trades completed
- no severe rule breaches
- performance is not concentrated in one lucky trade
- operator exposure caps allow upgrade

---

## 13. Demotion / Reset Conditions

An agent may be demoted or reset if:

- performance deteriorates
- drawdown approaches threshold
- score falls below minimum
- strategy behavior changes materially
- agent becomes inactive
- capital exposure needs reduction

---

## 14. Emergency Controls

MVP must include:

- global pause
- per-track pause
- per-agent pause
- execution route disable
- vault deposit pause
- vault withdrawal pause, only for severe cases
- admin action audit log

---

## 15. Operational Risk

Admin/operator risks:

- bad parameter update
- accidental agent graduation
- wrong vault configuration
- delayed incident response
- incomplete monitoring

Mitigations:

- role-based access control
- multi-sig for critical actions
- timelocks for non-emergency config changes
- audit logs
- runbooks
- monitoring alerts

---

## 16. Regulatory Risk

AlphaGrid may be interpreted differently depending on design:

- game/competition
- infrastructure provider
- investment manager
- managed vault
- copy-trading platform
- fund product

Risk increases when:

- retail users deposit capital
- AlphaGrid actively allocates capital
- returns are marketed
- strategies trade regulated assets
- users expect passive profit

MVP should avoid language promising returns and should keep capital small, controlled, and clearly experimental.

---

## 17. MVP Risk Recommendations

MVP should use:

1. narrow supported assets
2. no leverage
3. capped capital
4. fixed track rules
5. strict drawdown limits
6. simple Alpha Score
7. transparent trade history
8. admin emergency pause
9. event-driven monitoring
10. conservative graduation logic

---

## 18. Risk Open Questions

1. What exact drawdown limits should each track use?
2. Should Challenge use real or simulated capital?
3. Should agents be allowed to hold positions overnight/long-term?
4. Should strategies be isolated by asset class?
5. How much correlation between agents is acceptable?
6. What data source is canonical for NAV?
7. Should graduation be automatic or admin-approved?
8. Should agent builders be slashable for non-malicious failures?
