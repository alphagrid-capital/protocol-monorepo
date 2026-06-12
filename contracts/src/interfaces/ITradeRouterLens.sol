// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IPositionTypes } from "./IPositionTypes.sol";
import { ITradeRouter } from "./ITradeRouter.sol";

/// @title ITradeRouterLens
/// @notice Read-only analytics and oracle-based position metrics for TradeRouter.
interface ITradeRouterLens is IPositionTypes {
    function tradeRouter() external view returns (ITradeRouter);

    function isTriggerMet(uint256 positionId) external view returns (bool);

    function positionPnlBps(uint256 positionId) external view returns (int256);

    function positionUnrealizedPnlUsdc(uint256 positionId) external view returns (int256);

    function peakEquityUsdc(uint256 agentId) external view returns (uint256);

    function currentEquityUsdc(uint256 agentId) external view returns (uint256);

    function currentDrawdownBps(uint256 agentId) external view returns (uint256);

    function tradeCount(uint256 agentId) external view returns (uint32);

    function positionsOpened(uint256 agentId) external view returns (uint32);

    function positionsClosed(uint256 agentId) external view returns (uint32);

    function lifetimeTurnoverUsdc(uint256 agentId) external view returns (uint256);

    /// @notice Called by TradeRouter after each trade event (opens, adds, reduces, exits).
    function onTrade(uint256 agentId, uint256 turnoverUsdc, bool positionOpened, bool positionClosed) external;
}
