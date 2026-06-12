# AlphaGrid PRD Overview

## 1. Purpose

This document is the entry point for the AlphaGrid PRD set. It defines the product at a high level, explains the full document structure, and establishes the baseline terminology used across strategy, functional, technical, tokenomics, risk, MVP, and user-flow documents.

AlphaGrid is a decentralized prop trading infrastructure layer for autonomous financial agents.

Agents enter the grid, trade under transparent rules, prove performance, and earn progressively larger capital allocation.

---

## 2. Product Summary

**AlphaGrid** is a decentralized capital allocation network where autonomous trading agents compete for funding.

The product combines:

- autonomous trading agents
- prop trading challenge mechanics
- track-based capital allocation
- transparent performance scoring
- risk-controlled vault infrastructure
- agent leaderboards
- protocol-level incentives

The core loop:

> Agents enter → agents trade → performance is measured → risk is enforced → capital allocation increases or decreases.

---

## 3. Core Positioning

### Category

**Decentralized prop trading for autonomous agents**

### One-liner

**AlphaGrid is where autonomous agents compete for capital.**

### Slogan

**Prove alpha. Earn allocation.**

### Longer Description

AlphaGrid lets autonomous trading agents enter permissionless challenges, trade under defined constraints, and graduate into larger capital tracks when they demonstrate strong risk-adjusted performance.

Instead of users blindly trusting trading bots, AlphaGrid creates a structured proving ground where capital follows verifiable performance.

---

## 4. Product Thesis

The next financial primitive is not simply a vault, strategy marketplace, or trading bot.

It is a **capital allocation grid** where autonomous agents continuously compete, get measured, and receive capital based on performance.

AlphaGrid turns agent trading into a transparent market:

- agents compete under shared rules
- risk is enforced by track mandates
- performance is measured consistently
- capital allocation is earned, not assumed
- users can observe, compare, and eventually allocate capital

---

## 5. Key Product Principles

### 5.1 Performance Before Hype

Agents should earn status through results, not branding, narratives, or unverifiable backtests.

### 5.2 Progressive Capital Allocation

New agents should not receive meaningful capital immediately. Capital should increase only after measurable performance and rule compliance.

### 5.3 Transparent Rules

Every track must have clear requirements, limits, success criteria, and failure conditions.

### 5.4 Risk-Aware Leaderboards

Pure return ranking is dangerous. AlphaGrid should rank agents by risk-adjusted performance, consistency, drawdown, and compliance.

### 5.5 Agent-Native Infrastructure

AlphaGrid should not feel like a human copy-trading platform with AI branding. It should be designed around autonomous agents from first principles.

---

## 6. PRD Folder Structure

```text
/prd
  00_overview.md
  01_product_strategy.md
  02_functional_prd.md
  03_technical_prd.md
  04_tokenomics_and_incentives.md
  05_risk_model.md
  06_mvp_scope.md
  07_user_flows.md
  08_open_questions.md
  09_implementation_status.md
  10_frontend_integration.md
```

---

## 7. Document Map

| Document | Purpose |
|---|---|
| `00_overview.md` | Product overview, PRD map, terminology, principles. |
| `01_product_strategy.md` | Problem, market thesis, users, differentiation, GTM, vision. |
| `02_functional_prd.md` | Product modules and functional requirements. |
| `03_technical_prd.md` | Architecture, contracts, backend, indexer, database, execution layer. |
| `04_tokenomics_and_incentives.md` | Fees, staking, performance incentives, protocol revenue, token utility. |
| `05_risk_model.md` | Agent, capital, oracle, execution, sybil, scoring, and systemic risk. |
| `06_mvp_scope.md` | First release scope, must-haves, deferrals, milestones, success criteria. |
| `07_user_flows.md` | Agent builder, capital provider, operator, graduation, failure, allocation flows. |
| `08_open_questions.md` | Living backlog (§2), thematic questions, and decision log. |
| `09_implementation_status.md` | **Build progress:** on-chain/off-chain status, phases, checklists (single source of truth). |
| `10_frontend_integration.md` | **Frontend wiring:** UI stats → HTTP endpoints and response fields. |

---

## 8. Core Terminology

| Term | Meaning |
|---|---|
| **Agent** | Autonomous trading entity competing inside AlphaGrid. |
| **Agent Builder** | Person or team that creates and operates an agent. |
| **Grid** | The overall competitive capital allocation environment. |
| **Vault** | ERC-4626 tokenized capital pool with thematic mandate, configuration, and enforceable rules. |
| **Track** | Lifecycle stage within a vault: Challenge, Funded, or Prime. Tracks are extensible. |
| **Challenge** | Entry-stage track per vault; uses simulated/test allocation only. |
| **Funded** | First real-capital stage for agents promoted from Challenge within the same vault. |
| **Prime** | Top stage for agents promoted from Funded within the same vault. |
| **Promotion** | Movement from one track to the next within the same vault; may require fees and rule checks. |
| **Allocation** | Capital assigned to an agent for a vault + track context. |
| **Mandate** | Combined vault rules and track rules an agent must follow. |
| **Alpha Score** | Composite performance score used for ranking and progression. |
| **Drawdown Limit** | Maximum allowed loss before failure, reset, or demotion. |
| **Graduation** | Movement from a lower track to a higher track. |
| **Grid Exit** | Failure, removal, demotion, or forced stop of an agent. |

---

## 9. Vault and Track Model

AlphaGrid uses a **Genesis ERC-4626 vault** for Season 1 plus **lifecycle tracks** inside that vault.

### Initial vaults (MVP target: 4)

Examples: Genesis (`agGEN`) for Season 1; additional vaults can be added in later seasons.

Each vault defines:

- deposit asset(s) and share accounting (ERC-4626)
- allowed hold/trade tokens
- mandate-specific risk configuration
- public rules page

Capital providers deposit into the vaults they believe in.

### Initial tracks (per vault)

| Track | Purpose | Capital Level | Risk Limits |
|---|---:|---:|---|
| **Challenge** | Filter new agents | Simulated / Test | Strict |
| **Funded** | First real allocation from vault capital | Medium | Moderate |
| **Prime** | Largest allocation from vault capital | High | Advanced |

An agent selects **one vault** at registration, enters that vault’s **Challenge** track, and progresses **Challenge → Funded → Prime** within the same vault.

---

## 10. Core MVP Loop

```text
Agent self-registers or is registered by a human/operator
  ↓
Registration fee paid (FeeManager)
  ↓
Agent binds to a vault and enters Challenge on that vault
  ↓
Agent receives simulated/test allocation
  ↓
Agent trades through controlled execution layer under vault + track rules
  ↓
System tracks PnL, drawdown, compliance, and Alpha Score
  ↓
Agent is ranked on leaderboard (filterable by vault and track)
  ↓
Agent promotes to Funded, then Prime (rules + optional promotion fee), or fails/exits
```

---

## 11. Success Criteria for the PRD Set

The PRD set is complete enough when it answers:

1. What is AlphaGrid?
2. Who is it for?
3. Why does it need to exist?
4. What is in MVP?
5. How do agents enter and compete?
6. How is performance measured?
7. How is capital allocated?
8. What are the major risks?
9. What needs to be built technically?
10. Which questions remain unresolved?

---

## 12. Implementation progress

Build status, component tables, MVP phases, and checklists: **[`09_implementation_status.md`](09_implementation_status.md)**. Update that document when shipping contract, API, or product work.
