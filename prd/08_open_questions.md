# AlphaGrid Open Questions

## 1. Purpose

This document is the **living backlog** of unresolved product, technical, and go-to-market questions for AlphaGrid.

- **§2 Active backlog** — specific items we are actively tracking (ID, status, owners, next steps).
- **§3–13** — thematic question lists for discovery and planning.
- **§14 Decision log** — accepted or rejected decisions with consequences.
- **§15 Decision log template** — format for new decisions.

When a backlog item is decided, move it to the decision log and update linked PRDs (`04_tokenomics`, landing page, contracts README).

**Implementation baseline** for open questions: `09_implementation_status.md` §7.

---

## 2. Active backlog (tracked)

Use IDs when discussing items in issues or PRs (`OQ-001`, etc.). Update **Status** and **Last updated** when progress changes.

| ID | Title | Status | Areas |
| --- | --- | --- | --- |
| [OQ-001](#oq-001-portfolio-220-fee-model) | Portfolio 2/20 fee model | Open | Homepage, tokenomics, contracts |
| [OQ-002](#oq-002-erc-8004-trustless-agents) | ERC-8004 (Trustless Agents) alignment | Open | Identity, discovery, reputation, contracts |
| [OQ-003](#oq-003-robinhood-rfq-engine) | Robinhood RFQ engine — research & integration | Open | Execution, adapters, Robinhood Chain, executor |

---

### OQ-001: Portfolio 2/20 fee model

**Status:** Open  
**Raised:** 2026-05-29  
**Last updated:** 2026-05-29  
**Areas:** `prd/landing_website/`, `prd/04_tokenomics_and_incentives.md`, `FeeManager` / vault profit settlement

#### Question

Should AlphaGrid adopt a **2/20-style portfolio fee** for vault capital (classic **2% management fee on AUM** + **20% performance fee on profits**), and make that a **primary homepage narrative**?

#### Context

- Landing and tokenomics today describe a **profit split** (e.g. 75–80% LPs / 15–20% builder / 5% protocol) and **entry/promotion fees** via `FeeManager` — not a 2/20 hedge-fund-style schedule.
- Contracts implement **registration** and **promotion** fees only (`FeeManager`); no on-chain management or performance fee accrual on vault PnL yet.
- A clear 2/20 story may resonate with capital providers and differentiate the product vs generic “protocol fee” wording.

#### Open sub-questions

1. **Scope:** 2/20 on **vault-level** (ERC-4626) only, or also on simulated Challenge “portfolio”?
2. **Basis:** Management fee on `totalAssets()` (annualized)? Performance fee on net new profits per period (high-water mark?)?
3. **Split:** Does 20% performance fee map to **agent builder** share, **protocol** share, or split between them (e.g. 15% builder + 5% protocol)?
4. **Homepage:** Hero, vault cards, FAQ — how prominently vs registration/promotion fees?
5. **Contracts:** Extend `FeeManager` vs new `PerformanceFeeModule` / vault hooks on withdraw/settle?
6. **Legal:** Does marketing “2/20” change positioning vs “experimental arena” disclaimers?

#### Current implementation

See `09_implementation_status.md` §7 (OQ-001).

#### Next steps (suggested)

1. Product decision on whether 2/20 is **launch messaging** vs **actual fee policy**.
2. If yes: define exact bps, period, high-water mark, and LP/builder/protocol split in `04_tokenomics`.
3. Spec contract changes (accrual, collection on realize/withdraw).
4. Update landing hero, vault cards, and FAQ to lead with 2/20 where appropriate.

#### Related docs

- `prd/04_tokenomics_and_incentives.md` §8.1 Performance Fee
- `prd/landing_website/landing_page_structure.md` (fees / FAQ section)

---

### OQ-002: ERC-8004 (Trustless Agents)

**Status:** Open (identity partially implemented)  
**Raised:** 2026-05-29  
**Last updated:** 2026-06-06  
**Areas:** Agent identity, discovery, reputation, interoperability

#### Question

Should AlphaGrid **integrate with or align to [ERC-8004: Trustless Agents](https://eips.ethereum.org/EIPS/eip-8004)** (draft) for agent discovery and on-chain reputation, instead of (or alongside) a fully custom `AgentRegistry` identity model?

#### Context

**ERC-8004** is a draft Ethereum application-layer standard for AI agents that are **discoverable and reputationally trackable** across organizations without pre-existing trust. It defines three on-chain registries (deployable per chain):

1. **Identity Registry** — ERC-721-style `agentId` + `agentURI` (registration JSON: name, services, MCP/A2A endpoints, etc.).
2. **Reputation Registry** — standardized interface for signed feedback signals; aggregation on- and off-chain.
3. **Validation Registry** — hooks for validators to record scores (0–100) for independent verification (zkML, TEE, re-execution, etc.).

Reference implementations exist (e.g. [erc-8004-contracts](https://github.com/erc-8004/erc-8004-contracts)); spec status remains **Draft** (EIP-8004, Aug 2025).

AlphaGrid uses a **custom** `AgentRegistry` (vault binding, tracks, signer, metadata URI) for prop-trading lifecycle, with **optional ERC-8004 Identity Registry linkage** at registration or after via `linkERC8004Identity`. Reputation and validation registries are not integrated yet.

#### Open sub-questions

1. **Identity:** Mint/link ERC-8004 `agentId` at registration, or mirror AlphaGrid `agentId` ↔ 8004 id?
2. **Discovery:** Expose `agentURI` / services in registration file for external indexers and agent marketplaces?
3. **Reputation:** Feed AlphaGrid performance (Alpha Score, graduation, failures) into 8004 Reputation Registry, or keep reputation internal only?
4. **Validation:** Use Validation Registry for trade/execution proofs, or defer until post-MVP?
5. **Overlap:** What stays in `AgentRegistry` (vault, track, allocation) vs what moves to 8004 registries?
6. **Chain:** Deploy/use canonical 8004 singletons on target L2, or fork/wrap?

#### Current implementation

See `09_implementation_status.md` §3–§4 and §7 (OQ-002).

#### Next steps (suggested)

1. Architecture spike: **adapter** pattern (`AgentRegistry` + optional 8004 Identity Registry registration).
2. Legal/product: discovery-only vs trust/reputation claims on homepage.
3. If aligned: document mapping in `03_technical_prd.md` and add integration milestone post-MVP contracts freeze.

#### References

- [EIP-8004: Trustless Agents](https://eips.ethereum.org/EIPS/eip-8004)
- [Ethereum Magicians discussion](https://ethereum-magicians.org/t/erc-8004-trustless-agents/25098)
- [erc-8004-contracts](https://github.com/erc-8004/erc-8004-contracts)

---

### OQ-003: Robinhood RFQ engine — research & integration

**Status:** Open  
**Raised:** 2026-05-29  
**Last updated:** 2026-05-29  
**Areas:** Execution layer, `ISwapAdapter`, AlphaGrid executor, Robinhood Chain, landing narrative

#### Question

How should AlphaGrid **research and integrate Robinhood’s RFQ (request-for-quote) engine** as the production execution path for tokenized equities on Robinhood Chain — from quote request through fill settlement — while preserving the on-chain `TradeRouter` + vault safety model?

#### Context

- **Product / landing:** AlphaGrid already positions **Robinhood Chain** and tokenized equities in the homepage PRD (`prd/landing_website/landing_page_structure.md`); strategy docs mention RH L2 as a maturing rail (`prd/01_product_strategy.md`).
- **Contracts:** Settlement is abstracted via `ISwapAdapter`. MVP ships `MockSwapAdapter` (oracle/mint, tests) and `InventorySwapAdapter` (pre-funded inventory). **No Robinhood-specific adapter or RFQ client exists.**
- **Infra:** `foundry.toml` defines `robinhood` RPC (`ROBINHOOD_RPC_URL`); chain deploy targets Robinhood testnet/mainnet when ready.
- **Architecture:** `TradeRouter` pulls vault assets → adapter swap in one tx. An RFQ flow may be **hybrid**: off-chain quote/bid window + on-chain settlement hook — needs explicit design so executors cannot re-price after intent commitment.

#### Open sub-questions

1. **API surface:** Official Robinhood RFQ API docs, auth (API keys, OAuth, allowlisted IPs), sandbox vs production, rate limits?
2. **RFQ lifecycle:** Request creation, maker/taker roles, bid window, fill confirmation, cancellation, partial fills?
3. **Settlement:** On-chain leg on Robinhood Chain only, or bridge from vault USDC on another chain? Atomicity guarantees vs HTLC-style designs?
4. **Adapter shape:** `RobinhoodRfqAdapter` implementing `ISwapAdapter` vs off-chain executor that passes `routeData` / fill proofs into router?
5. **Executor:** Does AlphaGrid executor poll RFQ, sign responses, and submit `openPosition` only after firm quote? How are stale quotes rejected?
6. **Assets:** Map RH tokenized tickers (TSLA, AMZN, etc.) to `TokenRegistry` + oracle feeds; 24/5 vs 24/7 market hours?
7. **Risk:** Slippage, min-out, and `maxSlippageBps` on intent vs RFQ fill price; failed RFQ → on-chain revert behavior?
8. **Legal / ops:** Market access, entity structure, and whether agents trade through protocol inventory vs direct RFQ counterparty?
9. **Alternatives:** Community RFQ/AMM on RH testnet vs waiting for canonical Robinhood RFQ — what is in scope for MVP vs pilot?

#### Current implementation

See `09_implementation_status.md` §3 and §7 (OQ-003).

#### Next steps (suggested)

1. **Research spike:** Obtain RFQ engine documentation, sample flows, and test credentials; document request/response schemas in `contracts/docs/` or `prd/`.
2. **Sequence diagram:** RFQ quote → executor validation → `TradeRouter.openPosition` → adapter settlement (single-tx vs two-step).
3. **PoC:** Minimal off-chain client + testnet swap against RH token contracts; measure latency and failure modes.
4. **Contract:** Implement `RobinhoodRfqAdapter` (or clarify adapter-less pattern) and wire in `DeployTrading` behind feature flag.
5. **PRD:** Update `03_technical_prd.md` “Supported Trading Venues” once API contract is known.

#### Related docs

- `prd/03_technical_prd.md` — execution design, `ISwapAdapter`, deploy status
- `prd/landing_website/landing_page_structure.md` — Tradable Universe / Robinhood Chain sections
- `contracts/README.md` — swap adapters
- [Robinhood Chain docs](https://docs.robinhood.com/chain/) (L2 deploy, RPC)

#### References (external — verify with Robinhood)

- Robinhood Chain testnet: chain id `46630`, RPC in `foundry.toml` / [deploy guide](https://docs.robinhood.com/chain/deploy-smart-contracts/)
- Add official RFQ API links here when available from partner/docs review

---

## 3. Product Questions

### 3.1 Product Framing

1. Is AlphaGrid primarily a protocol, app, arena, vault product, or capital allocation network?
2. Should the first public version emphasize competition, capital allocation, or agent discovery?
3. Should the homepage target agent builders first or capital providers first?
4. Should AlphaGrid present itself as “decentralized prop trading” or use a softer term like “agent performance arena”?

### 3.2 Market Scope

1. Should AlphaGrid start with crypto-native assets only?
2. Should tokenized equities / Robinhood Chain be part of the initial narrative? *(Execution path: [OQ-003](08_open_questions.md#oq-003-robinhood-rfq-engine).)*
3. Should strategies be limited to spot trading in MVP?
4. Should agents be allowed to run market-making, directional, arbitrage, or only simple spot strategies?

### 3.3 User Scope

1. Are capital providers included in MVP or only observers?
2. Can any user register an agent, or is early access gated?
3. Should agent builders be KYC/KYB’d at any stage?
4. Should agents have public creator identities or pseudonymous operators?

---

## 4. Agent Questions

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
7. Should agents have portable identity across chains/markets? *(See [OQ-002](08_open_questions.md#oq-002-erc-8004-trustless-agents) — ERC-8004.)*

---

## 5. Track Questions

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

## 6. Capital Allocation Questions

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

## 7. Scoring Questions

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

## 8. Risk Questions

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

## 9. Tokenomics Questions

1. Should AlphaGrid launch with a token?
2. Should MVP be tokenless with stablecoin fees?
3. Should entry fees be fixed or dynamic?
4. Should entry fees differ by track?
5. Should agent builders stake collateral?
6. Should stake be slashable?
7. How are profits split between capital providers, agent builders, and protocol?
8. Should protocol charge a management fee or only performance fee? *(See [OQ-001](08_open_questions.md#oq-001-portfolio-220-fee-model) — 2/20 portfolio fee model.)*
9. Should token utility include governance, staking, fee discounts, or data access?
10. Should challenge rewards come from fees, treasury, sponsors, or emissions?

---

## 10. Technical Questions

### 10.1 Architecture

1. Which chain should AlphaGrid launch on?
2. Should the first vaults be on EVM only?
3. Should agent scoring be off-chain first?
4. Which parts must be on-chain in MVP?
5. Should we use one vault per track or one vault per agent?

### 10.2 Execution

1. How do agents authenticate?
   - wallet signature
   - API key
   - delegated signer
   - session key

2. Do agents submit trade intents or signed transactions?
3. Should execution go through a centralized gateway in MVP?
4. Which venues are supported first? *(See [OQ-003](08_open_questions.md#oq-003-robinhood-rfq-engine) — Robinhood RFQ engine.)*
5. How are failed/reverted trades handled?
6. Should agent execution be synchronous or queued?

### 10.3 Data

1. What is canonical source of trade data?
2. What is canonical source of price data?
3. How often is NAV recalculated?
4. Can performance be recomputed deterministically from events?
5. What data must be stored on-chain vs off-chain?
6. Should agent metadata be stored on IPFS/Arweave or in database?

### 10.4 Security

1. Which actions require multisig?
2. Which actions require timelock?
3. Who can pause agents?
4. Who can update track parameters?
5. What is the upgrade strategy for contracts?
6. What audit level is needed before real capital?
7. Should AlphaGrid integrate [ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) for agent identity/reputation? *(See [OQ-002](08_open_questions.md#oq-002-erc-8004-trustless-agents).)*

---

## 11. Legal / Compliance Questions

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

## 12. MVP Decisions Needed Before Build

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

## 13. Recommended Initial Answers

These are recommended defaults to unblock MVP planning.

| Question | Recommended Default |
|---|---|
| Capital model | Challenge simulated per vault; Funded/Prime use ERC-4626 vault capital. |
| Vaults | One Genesis ERC-4626 vault at MVP (Season 1 Challenge arena). |
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

## 14. Decision Log

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
- Contracts: `MandateVault` (4626), `FeeManager`, `VaultTrackConfig` in `VaultTrackRegistry`.
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
- Non-zero fees collect via `payRegistrationFee` on direct on-chain paths (`selfRegisterAgent`, operator `registerAgent` when fee not skipped).
- **HTTP API path:** non-zero fee may be collected via **x402 (USDC)** to treasury; relayer submits `registerAgent` with on-chain fee skipped.

### Consequences

- PRD fee sections updated; contract supports both on-chain and x402+relayer settlement.
- Launch can start with zero fee and raise later via admin config.

---

## Decision: HTTP Registration via x402 + Relayer

**Date:** 2026-06-06  
**Status:** Accepted  

### Context

The `api/` Worker mediates agent registration for MCP and HTTP clients. Agents sign EIP-712 `SelfRegister`, but the relayer broadcasts `registerAgent` (not `selfRegisterAgent`).

### Decision

- Agent proves intent with **EIP-712 `SelfRegister`** signature.
- When fee > 0, **x402** collects USDC to `FeeManager.treasury` before the relayer tx.
- Relayer (`REGISTRAR_ROLE`) calls `registerAgent` with **`skipRegistrationFee`** so treasury is not charged twice.
- Direct on-chain `selfRegisterAgent` remains available for wallets that pay via `FeeManager` on-chain.

### Consequences

- Documented in `02_functional_prd.md` §4.4 and `03_technical_prd.md` §5.2.
- `api/README.md` is the operational reference for env vars.

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

## 15. Decision Log Template

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
