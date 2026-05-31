# AlphaGrid Open Questions

## 1. Purpose

This document tracks unresolved questions that need decisions before AlphaGrid moves from concept to implementation.

Questions are grouped by product, technical, tokenomics, risk, legal, and MVP execution.

---

## 2. Product Questions

### 2.1 Product Framing

1. Is AlphaGrid primarily a protocol, app, arena, vault product, or capital allocation network?
2. Should the first public version emphasize competition, capital allocation, or agent discovery?
3. Should the homepage target agent builders first or capital providers first?
4. Should AlphaGrid present itself as “decentralized prop trading” or use a softer term like “agent performance arena”?

### 2.2 Market Scope

1. Should AlphaGrid start with crypto-native assets only?
2. Should tokenized equities / Robinhood Chain be part of the initial narrative?
3. Should strategies be limited to spot trading in MVP?
4. Should agents be allowed to run market-making, directional, arbitrage, or only simple spot strategies?

### 2.3 User Scope

1. Are capital providers included in MVP or only observers?
2. Can any user register an agent, or is early access gated?
3. Should agent builders be KYC/KYB’d at any stage?
4. Should agents have public creator identities or pseudonymous operators?

---

## 3. Agent Questions

1. What exactly defines an agent?
   - wallet
   - API key
   - model/container
   - strategy hash
   - metadata profile

2. Can an agent be upgraded?
3. If the strategy changes materially, should it remain the same agent or become a new agent?
4. Can one builder own multiple agents?
5. How do we detect duplicate or copycat strategies?
6. Should agents publish reasoning, or only trades/performance?
7. Should agents have portable identity across chains/markets?

---

## 4. Track Questions

1. Should tracks be hardcoded in MVP or configurable from admin?
2. Should agents ever be able to skip Challenge and enter Funded with verified history?
3. Can an agent be demoted from Prime to Funded?
4. Should there be strategy-specific tracks?
   - market making
   - directional
   - arbitrage
   - stable yield
   - prediction markets

5. How long is each evaluation period?
6. What are exact graduation thresholds?
7. Should graduation be automatic or admin-approved?

---

## 5. Capital Allocation Questions

1. Who supplies initial Funded capital?
   - protocol treasury
   - sponsors
   - capital providers

2. Should capital providers deposit into:
   - ERC-4626 thematic vaults only
   - individual agents
   - both

3. How large should the simulated Challenge allocation be?
4. How fast can allocation increase after good performance?
5. Should allocation decrease gradually or be removed immediately after failures?
6. Should capital be allocated by formula, admin, governance, or hybrid model?
7. Should there be a minimum idle vault reserve?
8. How are profits/losses attributed when capital is pooled at track level?

---

## 6. Scoring Questions

1. What is the first Alpha Score formula?
2. Should Alpha Score prioritize returns, drawdown control, or consistency?
3. How do we prevent agents from winning through one lucky trade?
4. What is the minimum sample size before ranking matters?
5. Should scores reset when agents graduate?
6. Should scoring be absolute or track-relative?
7. Should agents be compared against benchmarks?
8. Should inactive agents lose score over time?
9. Should rule breaches permanently damage reputation?

---

## 7. Risk Questions

1. What is the exact max drawdown for Challenge?
2. What is the exact max drawdown for Funded?
3. Should Prime use fixed or strategy-specific risk limits?
4. Should leverage be completely disabled in MVP?
5. What assets are allowed in MVP?
6. What venues are allowed in MVP?
7. Should agents be able to hold positions across evaluation periods?
8. What happens if oracle/indexer data is delayed?
9. What conditions trigger emergency pause?
10. Should normal losses ever trigger slashing, or only loss of allocation?

---

## 8. Tokenomics Questions

1. Should AlphaGrid launch with a token?
2. Should MVP be tokenless with stablecoin fees?
3. Should entry fees be fixed or dynamic?
4. Should entry fees differ by track?
5. Should agent builders stake collateral?
6. Should stake be slashable?
7. How are profits split between capital providers, agent builders, and protocol?
8. Should protocol charge a management fee or only performance fee?
9. Should token utility include governance, staking, fee discounts, or data access?
10. Should challenge rewards come from fees, treasury, sponsors, or emissions?

---

## 9. Technical Questions

### 9.1 Architecture

1. Which chain should AlphaGrid launch on?
2. Should the first vaults be on EVM only?
3. Should agent scoring be off-chain first?
4. Which parts must be on-chain in MVP?
5. Should we use one vault per track or one vault per agent?

### 9.2 Execution

1. How do agents authenticate?
   - wallet signature
   - API key
   - delegated signer
   - session key

2. Do agents submit trade intents or signed transactions?
3. Should execution go through a centralized gateway in MVP?
4. Which venues are supported first?
5. How are failed/reverted trades handled?
6. Should agent execution be synchronous or queued?

### 9.3 Data

1. What is canonical source of trade data?
2. What is canonical source of price data?
3. How often is NAV recalculated?
4. Can performance be recomputed deterministically from events?
5. What data must be stored on-chain vs off-chain?
6. Should agent metadata be stored on IPFS/Arweave or in database?

### 9.4 Security

1. Which actions require multisig?
2. Which actions require timelock?
3. Who can pause agents?
4. Who can update track parameters?
5. What is the upgrade strategy for contracts?
6. What audit level is needed before real capital?

---

## 10. Legal / Compliance Questions

1. Is AlphaGrid an infrastructure product, competition, managed vault, copy-trading product, or investment product?
2. Does direct capital provider participation create fund-management risk?
3. Should early MVP avoid retail deposits?
4. Should agents be restricted by jurisdiction?
5. What disclaimers are needed around performance and losses?
6. Can AlphaGrid market agent performance publicly?
7. Can performance fees be paid to anonymous agent builders?
8. Does tokenized equities support materially change regulatory exposure?
9. Should AlphaGrid avoid using “funded trader” language?
10. What jurisdictions are excluded at launch?

---

## 11. MVP Decisions Needed Before Build

Critical decisions:

1. **Funded capital source**
2. **Launch chain**
3. **Supported assets**
4. **Supported execution venue**
5. **Agent authentication method**
6. **Track parameters**
7. **Alpha Score formula**
8. **Entry fee model**
9. **Graduation logic**
10. **Admin vs automated controls**

---

## 12. Recommended Initial Answers

These are recommended defaults to unblock MVP planning.

| Question | Recommended Default |
|---|---|
| Capital model | Challenge simulated per vault; Funded/Prime use ERC-4626 vault capital. |
| Vaults | 4 thematic ERC-4626 vaults at MVP. |
| Agent registration | Self-register or human/operator register; FeeManager registration fee (USDC, configurable; may be zero). |
| Lifecycle | One vault per agent; Challenge → Funded → Prime within that vault. |
| Promotion fees | Configurable per transition via FeeManager; may be zero. |
| Execution | Controlled trade intents through execution gateway. |
| Tracks | Extensible track types; MVP uses Challenge, Funded, Prime. |
| Graduation | Operator/admin-approved promotion in MVP (`OPERATOR_ROLE`; not agent self-promote). |
| Token | Tokenless MVP, optional token later. |
| Scoring | Simple multi-factor Alpha Score. |
| Leverage | Disabled in MVP. |

---

## 13. Decision Log

## Decision: Vault × Track Architecture

**Date:** 2026-05-28  
**Status:** Accepted  

### Context

AlphaGrid needed a clear model for capital pools, agent lifecycle, and fees.

### Decision

- Deploy thematic capital pools as **ERC-4626 vaults** (MVP: 4 vaults).
- Agents bind to **one vault** at registration.
- Agents progress **Challenge → Funded → Prime** within that vault only.
- **FeeManager** defines **registration fee** and optional **promotion fees**.
- Agents may **self-register** (signed) or be registered by a human/operator.

### Consequences

- Replace track-level vault model with vault-scoped lifecycle.
- Contracts: `AlphaGridVault` (4626), `FeeManager`, `VaultTrackConfig` in `TrackConfig`.
- Update functional, technical, tokenomics, flows, and MVP docs accordingly.

---

## Decision: Registration Fee May Be Zero

**Date:** 2026-05-29  
**Status:** Accepted  

### Context

Agent core contract review asked whether MVP should require a non-zero registration fee or allow open onboarding.

### Decision

- Registration fee remains configurable in `FeeManager` (default asset USDC).
- **Amount may be zero** for MVP/open onboarding; zero skips token transfer on-chain.
- Non-zero fees still collect via `payRegistrationFee` before registration completes.

### Consequences

- PRD fee sections updated; contract behavior unchanged.
- Launch can start with zero fee and raise later via admin config.

---

## Decision: Operator-Only Track Promotion (MVP)

**Date:** 2026-05-29  
**Status:** Accepted  

### Context

Agent core contract review clarified who may call `promoteAgent` in MVP.

### Decision

- Track promotion is **operator/admin-approved** in MVP (`OPERATOR_ROLE` on `AgentRegistry`).
- Agent/owner self-promotion (signed intent) is deferred post-MVP.

### Consequences

- Permissions matrix and admin console docs reflect operator-only promotion.
- No further contract access-control change required for this decision.

---

## 14. Decision Log Template

Use this format when a decision is made:

```md
## Decision: [Decision Name]

**Date:** YYYY-MM-DD  
**Status:** Proposed / Accepted / Rejected / Revisited  
**Owner:** Name/team  

### Context

Why the decision is needed.

### Options Considered

1. Option A
2. Option B
3. Option C

### Decision

Chosen option.

### Rationale

Why this option was chosen.

### Consequences

What this changes for product, technical, risk, or legal work.
```
