// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IPositionTypes } from "./IPositionTypes.sol";

/// @title ITradeRouter
/// @notice Entrypoint for agent position opens, adjustments, and permissionless keeper exits.
interface ITradeRouter is IPositionTypes {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event PositionOpenedFromIntent(
        uint256 indexed positionId, uint256 indexed agentId, address indexed vault, address token, uint256 usdcIn
    );

    event PositionIncreasedFromIntent(
        uint256 indexed positionId, uint256 indexed agentId, uint256 usdcIn, uint256 tokensAdded
    );

    event PositionReducedFromIntent(
        uint256 indexed positionId, uint256 indexed agentId, uint16 exitBps, uint256 usdcOut
    );

    event PositionExitLadderUpdatedFromIntent(uint256 indexed positionId, uint256 indexed agentId, uint8 nextRuleIndex);

    event ExitExecuted(
        uint256 indexed positionId,
        uint256 indexed agentId,
        uint8 ruleIndex,
        address indexed keeper,
        uint256 usdcOut,
        uint256 keeperBounty
    );

    event KeeperBountyUpdated(uint256 keeperBountyBps, uint256 maxKeeperBounty);

    event PositionForceClosed(
        uint256 indexed positionId, uint256 indexed agentId, address indexed operator, uint256 usdcOut
    );

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function keeperBountyBps() external view returns (uint256);

    function maxKeeperBounty() external view returns (uint256);

    function nonces(uint256 agentId) external view returns (uint256);

    /// @notice Cumulative USDC notional traded by `agentId` on UTC day `day` (timestamp / 1 days).
    function dailyTurnoverUsdc(uint256 agentId, uint256 day) external view returns (uint256);

    /// @notice Net realized PnL from sells on UTC day `day` (negative = net loss vs cost basis released).
    function dailyRealizedPnlUsdc(uint256 agentId, uint256 day) external view returns (int256);

    /// @notice Cumulative net realized PnL from all sells (negative = net loss vs cost basis released).
    function lifetimeRealizedPnlUsdc(uint256 agentId) external view returns (int256);

    // -------------------------------------------------------------------------
    // Execution
    // -------------------------------------------------------------------------

    function openPosition(PositionIntent calldata intent, bytes calldata signature)
        external
        returns (uint256 positionId);

    function addToPosition(AddToPositionIntent calldata intent, bytes calldata signature)
        external
        returns (uint256 tokensAdded);

    function reducePosition(ReducePositionIntent calldata intent, bytes calldata signature)
        external
        returns (uint256 usdcOut);

    function updateExitLadder(UpdateExitLadderIntent calldata intent, bytes calldata signature) external;

    function executeExit(uint256 positionId) external returns (uint256 usdcOut);

    /// @notice Operator-only market flatten when the agent is suspended.
    function forceClose(uint256 positionId) external returns (uint256 usdcOut);
}
