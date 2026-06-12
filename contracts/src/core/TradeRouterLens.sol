// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { IAllocationManager } from "../interfaces/IAllocationManager.sol";
import { IMandateVault } from "../interfaces/IMandateVault.sol";
import { IPositionManager } from "../interfaces/IPositionManager.sol";
import { ITradeRouter } from "../interfaces/ITradeRouter.sol";
import { ITradeRouterLens } from "../interfaces/ITradeRouterLens.sol";
import { OracleLib } from "../libraries/OracleLib.sol";

/// @title TradeRouterLens
/// @notice Offloads analytics views and counters from TradeRouter to stay within EIP-170.
contract TradeRouterLens is ITradeRouterLens {
    uint256 public constant MAX_BPS = 10_000;

    ITradeRouter public immutable tradeRouter;
    IAllocationManager public immutable allocationManager;
    IPositionManager public immutable positionManager;

    mapping(uint256 agentId => uint256 turnoverUsdc) private _lifetimeTurnoverUsdc;
    mapping(uint256 agentId => uint32 trades) private _tradeCount;
    mapping(uint256 agentId => uint32 opened) private _positionsOpened;
    mapping(uint256 agentId => uint32 closed) private _positionsClosed;
    mapping(uint256 agentId => uint256 peakEquity) private _peakEquityUsdc;

    error OnlyTradeRouter();
    error ZeroAddress();

    modifier onlyTradeRouter() {
        _onlyTradeRouter();
        _;
    }

    function _onlyTradeRouter() internal view {
        if (msg.sender != address(tradeRouter)) revert OnlyTradeRouter();
    }

    constructor(ITradeRouter tradeRouter_, IAllocationManager allocationManager_, IPositionManager positionManager_) {
        if (
            address(tradeRouter_) == address(0) || address(allocationManager_) == address(0)
                || address(positionManager_) == address(0)
        ) revert ZeroAddress();

        tradeRouter = tradeRouter_;
        allocationManager = allocationManager_;
        positionManager = positionManager_;
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @inheritdoc ITradeRouterLens
    function isTriggerMet(uint256 positionId) external view returns (bool) {
        Position memory position = positionManager.getPosition(positionId);
        if (position.status != PositionStatus.Open) return false;

        ExitRule memory rule = positionManager.getNextExitRule(positionId);
        int256 pnlBps = _positionPnlBps(position);
        return _isRuleTriggered(rule, pnlBps);
    }

    /// @inheritdoc ITradeRouterLens
    function positionPnlBps(uint256 positionId) external view returns (int256) {
        return _positionPnlBps(positionManager.getPosition(positionId));
    }

    /// @inheritdoc ITradeRouterLens
    function positionUnrealizedPnlUsdc(uint256 positionId) external view returns (int256) {
        return _positionUnrealizedPnlUsdc(positionManager.getPosition(positionId));
    }

    /// @inheritdoc ITradeRouterLens
    function peakEquityUsdc(uint256 agentId) external view returns (uint256) {
        return _peakEquityUsdc[agentId];
    }

    /// @inheritdoc ITradeRouterLens
    function currentEquityUsdc(uint256 agentId) external view returns (uint256) {
        return _currentEquityUsdc(agentId);
    }

    /// @inheritdoc ITradeRouterLens
    function currentDrawdownBps(uint256 agentId) external view returns (uint256) {
        uint256 peak = _peakEquityUsdc[agentId];
        if (peak == 0) return 0;
        uint256 current = _currentEquityUsdc(agentId);
        if (current >= peak) return 0;
        return (peak - current) * MAX_BPS / peak;
    }

    /// @inheritdoc ITradeRouterLens
    function tradeCount(uint256 agentId) external view returns (uint32) {
        return _tradeCount[agentId];
    }

    /// @inheritdoc ITradeRouterLens
    function positionsOpened(uint256 agentId) external view returns (uint32) {
        return _positionsOpened[agentId];
    }

    /// @inheritdoc ITradeRouterLens
    function positionsClosed(uint256 agentId) external view returns (uint32) {
        return _positionsClosed[agentId];
    }

    /// @inheritdoc ITradeRouterLens
    function lifetimeTurnoverUsdc(uint256 agentId) external view returns (uint256) {
        return _lifetimeTurnoverUsdc[agentId];
    }

    // -------------------------------------------------------------------------
    // TradeRouter hooks
    // -------------------------------------------------------------------------

    /// @inheritdoc ITradeRouterLens
    function onTrade(uint256 agentId, uint256 turnoverUsdc, bool positionOpened, bool positionClosed)
        external
        onlyTradeRouter
    {
        _tradeCount[agentId]++;
        if (turnoverUsdc > 0) {
            _lifetimeTurnoverUsdc[agentId] += turnoverUsdc;
        }
        if (positionOpened) {
            _positionsOpened[agentId]++;
        }
        if (positionClosed) {
            _positionsClosed[agentId]++;
        }
        _updatePeakEquity(agentId);
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    function _positionPnlBps(Position memory position) private view returns (int256) {
        IMandateVault vault = IMandateVault(position.vault);
        uint8 tokenDecimals = vault.tokenRegistry().tokenDecimals(position.token);
        uint256 currentPrice = OracleLib.valueInAsset(
            10 ** tokenDecimals,
            vault.tokenRegistry().priceOracle(),
            position.token,
            tokenDecimals,
            vault.assetDecimals(),
            vault.maxPriceAge()
        );
        if (position.entryPriceUsdc == 0) return 0;
        int256 price = SafeCast.toInt256(currentPrice);
        int256 entry = SafeCast.toInt256(position.entryPriceUsdc);
        return (price - entry) * SafeCast.toInt256(MAX_BPS) / entry;
    }

    function _positionUnrealizedPnlUsdc(Position memory position) private view returns (int256) {
        if (position.status != PositionStatus.Open) return 0;

        IMandateVault vault = IMandateVault(position.vault);
        uint8 tokenDecimals = vault.tokenRegistry().tokenDecimals(position.token);
        uint256 currentValue = OracleLib.valueInAsset(
            position.tokenAmount,
            vault.tokenRegistry().priceOracle(),
            position.token,
            tokenDecimals,
            vault.assetDecimals(),
            vault.maxPriceAge()
        );
        return SafeCast.toInt256(currentValue) - SafeCast.toInt256(position.usdcCostBasis);
    }

    function _totalUnrealizedPnlUsdc(uint256 agentId) private view returns (int256 total) {
        uint256[] memory ids = positionManager.getOpenPositionIds(agentId);
        uint256 len = ids.length;
        for (uint256 i = 0; i < len; i++) {
            total += _positionUnrealizedPnlUsdc(positionManager.getPosition(ids[i]));
        }
    }

    function _currentEquityUsdc(uint256 agentId) private view returns (uint256) {
        IAllocationManager.Allocation memory allocation = allocationManager.getAllocation(agentId);
        int256 equitySigned =
            int256(allocation.cap) + tradeRouter.lifetimeRealizedPnlUsdc(agentId) + _totalUnrealizedPnlUsdc(agentId);
        if (equitySigned <= 0) return 0;
        return SafeCast.toUint256(equitySigned);
    }

    function _updatePeakEquity(uint256 agentId) private {
        uint256 current = _currentEquityUsdc(agentId);
        if (current > _peakEquityUsdc[agentId]) {
            _peakEquityUsdc[agentId] = current;
        }
    }

    function _isRuleTriggered(ExitRule memory rule, int256 pnlBps) private pure returns (bool) {
        if (rule.triggerType == TriggerType.StopLoss) {
            return pnlBps <= rule.triggerBps;
        }
        return pnlBps >= rule.triggerBps;
    }
}
