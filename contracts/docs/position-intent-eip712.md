# Position intent EIP-712 schema

Off-chain signing reference for `TradeRouter` agent intents: `openPosition`, `addToPosition`, `reducePosition`, and `updateExitLadder`.

All intents share `TradeRouter.nonces(agentId)` and require `EXECUTOR_ROLE` for submission.

## Domain

| Field | Value |
|-------|--------|
| `name` | `AlphaGrid TradeRouter` |
| `version` | `1` |
| `chainId` | deployment chain id |
| `verifyingContract` | `TradeRouter` address |

Set in `TradeRouter` via `EIP712("AlphaGrid TradeRouter", "1")`.

Solidity domain type hash:

```text
EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)
```

## Primary type: `OpenPosition`

Matches `OPEN_POSITION_TYPEHASH` in `TradeRouter.sol`:

```text
OpenPosition(uint256 agentId,address vault,address token,uint256 usdcAmount,uint256 minTokenOut,uint16 maxSlippageBps,bytes32 exitsHash,uint256 deadline,uint256 nonce)
```

### Signed fields

| Field | Type | Description |
|-------|------|-------------|
| `agentId` | `uint256` | Registered agent id |
| `vault` | `address` | Must equal `AgentRegistry.vaultOf(agentId)` |
| `token` | `address` | Asset to buy (must be vault-allowed) |
| `usdcAmount` | `uint256` | Vault asset notional to deploy (USDC in MVP; vault `asset()` decimals) |
| `minTokenOut` | `uint256` | Entry slippage floor passed to `ISwapAdapter` (token decimals) |
| `maxSlippageBps` | `uint16` | Stored on the position; caps exit `minUsdcOut` via oracle |
| `exitsHash` | `bytes32` | Hash of exit ladder (see below); **not** the raw `exits` array |
| `deadline` | `uint256` | Unix timestamp; reverts when `block.timestamp > deadline` |
| `nonce` | `uint256` | Must equal `TradeRouter.nonces(agentId)` at execution time |

### `signTypedData` shape

Only the fields above appear in EIP-712. Wallets must hash `exits` off-chain into `exitsHash` before signing:

```json
{
  "types": {
    "OpenPosition": [
      { "name": "agentId", "type": "uint256" },
      { "name": "vault", "type": "address" },
      { "name": "token", "type": "address" },
      { "name": "usdcAmount", "type": "uint256" },
      { "name": "minTokenOut", "type": "uint256" },
      { "name": "maxSlippageBps", "type": "uint16" },
      { "name": "exitsHash", "type": "bytes32" },
      { "name": "deadline", "type": "uint256" },
      { "name": "nonce", "type": "uint256" }
    ]
  },
  "primaryType": "OpenPosition"
}
```

## Exit ladder hashing

Each rule is encoded as:

```solidity
keccak256(abi.encode(triggerType, triggerBps, exitBps))
```

| Field | Type | Notes |
|-------|------|-------|
| `triggerType` | `uint8` enum | `0` = `StopLoss`, `1` = `TakeProfit` |
| `triggerBps` | `int256` | Signed PnL threshold in bps (`1000` = 10%). SL values are negative; TP values are positive |
| `exitBps` | `uint16` | Fraction of **remaining** tokens to sell on trigger (`10000` = 100%) |

Array hash:

```solidity
exitsHash = keccak256(abi.encode(ruleHashes))
```

where `ruleHashes` is `bytes32[]` in array order (same order as calldata `exits`).

### Exit rule constraints (`_validateExitRules`)

- `1 <= exits.length <= 5` (`MAX_EXIT_RULES`)
- Last rule: `exitBps == 10000`
- Every rule: `exitBps != 0`
- **StopLoss:** `triggerBps < 0`; each later StopLoss in the array must have a strictly more negative `triggerBps` than the previous StopLoss (TakeProfit rules between them do not reset this sequence)
- **TakeProfit:** `triggerBps > 0`; each later TakeProfit must have a strictly higher `triggerBps` than the previous TakeProfit
- StopLoss and TakeProfit rules may be interleaved (see mixed example below)

Keepers evaluate rules **in array order** via `nextRuleIndex`; only the current rule can fire.

### Exit trigger semantics (keeper `executeExit`)

PnL bps vs entry oracle price (`_positionPnlBps`):

- **StopLoss:** fires when `pnlBps <= triggerBps`
- **TakeProfit:** fires when `pnlBps >= triggerBps`

## Typed data digest

```text
digest = keccak256("\x19\x01" || domainSeparator || structHash)
structHash = keccak256(abi.encode(typeHash, agentId, vault, token, usdcAmount, minTokenOut, maxSlippageBps, exitsHash, deadline, nonce))
```

`domainSeparator` is OpenZeppelin `_hashTypedDataV4` / `eip712Domain()` on `TradeRouter`.

Signer must be `AgentRegistry.signerOf(agentId)`.

## On-chain calldata (`PositionIntent`)

`openPosition(PositionIntent calldata intent, bytes calldata signature)` also receives the full struct, including the **`exits` array**. The signature commits to `exitsHash` only; `_verifyIntentSignature` recomputes `_hashExitRules(intent.exits)` from calldata. If `exits` do not match what was signed, recovery fails with `InvalidSignature`.

```solidity
struct PositionIntent {
    uint256 agentId;
    address vault;
    address token;
    uint256 usdcAmount;
    uint256 minTokenOut;
    uint16 maxSlippageBps;
    ExitRule[] exits;
    uint256 deadline;
    uint256 nonce;
}
```

After a successful open, `TradeRouter` increments `nonces(agentId)`.

## Example intent (JSON)

Signing payload (compute `exitsHash` from `exits` before signing):

```json
{
  "agentId": "1",
  "vault": "0x...",
  "token": "0x...",
  "usdcAmount": "10000000000",
  "minTokenOut": "0",
  "maxSlippageBps": 100,
  "exits": [
    { "triggerType": 0, "triggerBps": -1000, "exitBps": 10000 }
  ],
  "deadline": 1735689600,
  "nonce": "0"
}
```

Single stop-loss at -10%, sell 100% of remaining (only rule).

Partial ladder: 50% at -10%, then 100% of remaining at -20%:

```json
"exits": [
  { "triggerType": 0, "triggerBps": -1000, "exitBps": 5000 },
  { "triggerType": 0, "triggerBps": -2000, "exitBps": 10000 }
]
```

Mixed take-profit then stop-loss:

```json
"exits": [
  { "triggerType": 1, "triggerBps": 1000, "exitBps": 5000 },
  { "triggerType": 0, "triggerBps": -1000, "exitBps": 10000 }
]
```

## Executor flow

1. Agent signs `OpenPosition` off-chain (`exitsHash` derived from intended ladder).
2. Executor calls `TradeRouter.openPosition(intent, signature)` with `EXECUTOR_ROLE`.
3. Router verifies signature, nonce, deadline, exit rules, agent/vault/track state, allocation cap, trade size, and daily turnover; then swaps via `ISwapAdapter`.
4. Vault pulls asset via `pullAssetsForTrade` (reverts when `tradingPaused`; uses `idleAssets`, not full `totalAssets`).
5. Exits are **not** signed again; keepers call permissionless `executeExit(positionId)` when the current rule’s PnL trigger is met (`pullTokenForTrade`, also blocked by `tradingPaused`).

`forceClose` requires `OPERATOR_ROLE` and agent status `Suspended`; it uses `pullTokenForForceClose` and **does not** check `tradingPaused`.

## Validation checklist (on-chain)

| Check | Revert / condition |
|-------|---------------------|
| `AgentRegistry` not paused | `RegistryPaused` |
| `block.timestamp <= deadline` | `ExpiredDeadline` |
| `nonce == TradeRouter.nonces(agentId)` | `InvalidNonce` |
| Signature from `signerOf(agentId)` | `InvalidSignature` |
| Valid exit ladder (see above) | `InvalidExitRules` |
| Agent status `Active` | `AgentNotTradable` |
| `intent.vault == agent.vault` | `VaultMismatch` |
| Vault track active for `trackOf(agentId)` | `VaultTrackNotActive` |
| Allocation status `Active` | `AllocationNotActive` |
| Token vault-allowed | `TokenNotAllowed` |
| No open position for `(agentId, token)` | `PositionAlreadyOpen` |
| `used + usdcAmount <= cap` | `ExceedsAllocationCap` |
| `usdcAmount <= totalAssets * maxTradeSizeBps / 10000` | `ExceedsMaxTradeSize` |
| Daily turnover within track limit | `ExceedsDailyTurnover` (skipped when track `maxDailyTurnoverBps == 0`) |
| Vault not `tradingPaused` on open | `TradingOperationsPaused` |
| Sufficient vault idle asset + swap slippage | `InsufficientIdleAssets` / adapter `SlippageExceeded` |
| Ledger invariant after open | `LedgerExceedsVaultBalance` |

`liquidityPaused` blocks LP deposits/withdrawals only; it does **not** block `pullAssetsForTrade`.

## Vault exit bounds (`VaultTrackConfig`)

Per vault + track, exit ladders on **open** and **update** must satisfy:

| Field | Meaning |
|-------|---------|
| `maxStopLossBps` | SL rules must have `triggerBps >= -maxStopLossBps`. When `0`, falls back to `maxDrawdownBps`. |
| `minTakeProfitBps` | When non-zero, every TP rule must have `triggerBps >= minTakeProfitBps`. |
| `maxTakeProfitBps` | When non-zero, every TP rule must have `triggerBps <= maxTakeProfitBps`. |
| `requireStopLoss` | When true, ladder must include at least one StopLoss rule. |
| `requireTakeProfit` | When true, ladder must include at least one TakeProfit rule. |

Violations revert with `ExitRulesOutOfBounds`.

## Primary type: `AddToPosition`

```text
AddToPosition(uint256 agentId,uint256 positionId,uint256 usdcAmount,uint256 minTokenOut,uint16 maxSlippageBps,uint256 deadline,uint256 nonce)
```

- Increases an open position; recomputes weighted-average `entryPriceUsdc`.
- Blocked when `AgentRegistry` is paused or vault `tradingPaused`.
- Allocation cap, trade size, and daily turnover apply to `usdcAmount`.

## Primary type: `ReducePosition`

```text
ReducePosition(uint256 agentId,uint256 positionId,uint16 exitBps,uint256 deadline,uint256 nonce)
```

- Discretionary sell: `exitBps` is fraction of **remaining** tokens (`10000` = full close).
- No PnL gate; does **not** advance `nextRuleIndex` or consume ladder steps.
- Allowed when registry is paused; blocked when vault `tradingPaused`.

## Primary type: `UpdateExitLadder`

```text
UpdateExitLadder(uint256 agentId,uint256 positionId,bytes32 exitsHash,uint256 deadline,uint256 nonce)
```

- Replaces **pending** rules from `nextRuleIndex` onward; consumed steps are unchanged.
- `exitsHash` uses the same rule hashing as `OpenPosition`.
- Must pass vault exit bounds and `_validateExitRules`.
- Reverts `PendingRuleAlreadyTriggered` if the first new rule would already fire (use `reducePosition` for immediate action).
- Allowed when registry or vault trading is paused (no asset pull).

## Keeper vs agent exits

| Path | Who | Trigger | Advances ladder |
|------|-----|---------|-----------------|
| `executeExit` | Anyone (keeper bounty) | Current rule PnL trigger | Yes |
| `reducePosition` | Agent (signed) | Anytime | No |
| `updateExitLadder` | Agent (signed) | Changes future automation | No |
| `forceClose` | Operator | Agent suspended | No (discretionary) |

## Pause matrix

| Intent | `AgentRegistry` paused | Vault `tradingPaused` |
|--------|------------------------|------------------------|
| `openPosition` | Block | Block |
| `addToPosition` | Block | Block |
| `reducePosition` | Allow | Block |
| `updateExitLadder` | Allow | Allow |
| `executeExit` | Allow | Block |
| `forceClose` | Allow | Allow |
