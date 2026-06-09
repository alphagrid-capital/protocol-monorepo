// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IPositionTypes } from "./IPositionTypes.sol";

/// @title IPositionManager
/// @notice Stores agent positions and per-agent token ledger balances.
/// @dev Keeper trigger checks live on `ITradeRouter.isTriggerMet`.
interface IPositionManager is IPositionTypes {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event PositionOpened(
        uint256 indexed positionId,
        uint256 indexed agentId,
        address indexed vault,
        address token,
        uint256 tokenAmount,
        uint256 entryPriceUsdc,
        uint256 usdcCostBasis
    );

    event PositionLadderExitApplied(
        uint256 indexed positionId, uint256 indexed agentId, uint8 ruleIndex, uint256 tokenSold, uint256 usdcReleased
    );

    event PositionReduced(uint256 indexed positionId, uint256 indexed agentId, uint256 tokenSold, uint256 usdcReleased);

    event PositionIncreased(
        uint256 indexed positionId,
        uint256 indexed agentId,
        uint256 tokensAdded,
        uint256 usdcAdded,
        uint256 entryPriceUsdc
    );

    event PositionExitLadderUpdated(uint256 indexed positionId, uint256 indexed agentId, uint8 nextRuleIndex);

    event PositionClosed(uint256 indexed positionId, uint256 indexed agentId);

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function tradeRouter() external view returns (address);

    function agentTokenBalance(uint256 agentId, address token) external view returns (uint256);

    function openPositionId(uint256 agentId, address token) external view returns (uint256);

    function getPosition(uint256 positionId) external view returns (Position memory);

    function getExitRules(uint256 positionId) external view returns (ExitRule[] memory);

    function getNextExitRule(uint256 positionId) external view returns (ExitRule memory);

    function positionCount() external view returns (uint256);

    /// @notice Sum of all agent ledger balances for `token`.
    function totalTokenLedger(address token) external view returns (uint256);

    // -------------------------------------------------------------------------
    // TradeRouter hooks
    // -------------------------------------------------------------------------

    function openPosition(
        uint256 agentId,
        address vault,
        address token,
        uint256 tokenAmount,
        uint256 entryPriceUsdc,
        uint256 usdcCostBasis,
        uint16 maxSlippageBps,
        ExitRule[] calldata exits
    ) external returns (uint256 positionId);

    function applyLadderExit(uint256 positionId, uint256 tokenSold, uint256 usdcReleased)
        external
        returns (uint8 ruleIndex);

    function applyDiscretionaryReduce(uint256 positionId, uint256 tokenSold, uint256 usdcReleased) external;

    function increasePosition(
        uint256 positionId,
        uint256 tokensAdded,
        uint256 usdcAdded,
        uint16 maxSlippageBps,
        uint256 newEntryPriceUsdc
    ) external;

    function updatePendingExitRules(uint256 positionId, ExitRule[] calldata newPendingRules) external;
}
