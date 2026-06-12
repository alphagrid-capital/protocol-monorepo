// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title IPositionTypes
/// @notice Shared types for position intents and on-chain positions.
interface IPositionTypes {
    enum TriggerType {
        StopLoss,
        TakeProfit
    }

    enum PositionStatus {
        Open,
        Closed
    }

    struct ExitRule {
        TriggerType triggerType;
        int256 triggerBps;
        uint16 exitBps;
    }

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
        ExitRule[] exits;
        uint256 deadline;
        uint256 nonce;
    }

    struct Position {
        uint256 positionId;
        uint256 agentId;
        address vault;
        address token;
        uint256 tokenAmount;
        uint256 entryPriceUsdc;
        uint256 usdcCostBasis;
        uint16 maxSlippageBps;
        PositionStatus status;
        uint8 nextRuleIndex;
        uint64 openedAt;
        int256 realizedPnlUsdc;
    }
}
