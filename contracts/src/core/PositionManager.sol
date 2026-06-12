// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IPositionManager } from "../interfaces/IPositionManager.sol";

/// @title PositionManager
/// @notice On-chain positions and per-agent token ledger for shared vault inventory.
contract PositionManager is IPositionManager, AccessControl {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    bytes32 public constant TRADE_ROUTER_ADMIN_ROLE = keccak256("TRADE_ROUTER_ADMIN_ROLE");

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    address public tradeRouter;

    uint256 private _nextPositionId = 1;

    mapping(uint256 positionId => Position position) private _positions;
    mapping(uint256 positionId => ExitRule[] rules) private _exitRules;
    mapping(uint256 agentId => mapping(address token => uint256 balance)) private _agentTokenBalance;
    mapping(uint256 agentId => mapping(address token => uint256 positionId)) private _openPositionId;
    mapping(uint256 agentId => uint256[] openIds) private _openPositionIdsByAgent;
    mapping(address token => uint256 total) private _totalTokenLedger;

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error NotTradeRouter(address caller);
    error PositionNotFound(uint256 positionId);
    error PositionNotOpen(uint256 positionId);
    error PositionAlreadyOpen(uint256 agentId, address token);
    error InvalidExitState(uint256 positionId);
    error InvalidPendingExitRules(uint256 positionId);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param admin Receives `DEFAULT_ADMIN_ROLE`.
    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TRADE_ROUTER_ADMIN_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyTradeRouter() {
        _onlyTradeRouter();
        _;
    }

    function _onlyTradeRouter() internal view {
        if (msg.sender != tradeRouter) revert NotTradeRouter(msg.sender);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @inheritdoc IPositionManager
    function agentTokenBalance(uint256 agentId, address token) external view returns (uint256) {
        return _agentTokenBalance[agentId][token];
    }

    /// @inheritdoc IPositionManager
    function openPositionId(uint256 agentId, address token) external view returns (uint256) {
        return _openPositionId[agentId][token];
    }

    /// @inheritdoc IPositionManager
    function openPositionCountByAgent(uint256 agentId) external view returns (uint256) {
        return _openPositionIdsByAgent[agentId].length;
    }

    /// @inheritdoc IPositionManager
    function getOpenPositionIds(uint256 agentId) external view returns (uint256[] memory) {
        return _openPositionIdsByAgent[agentId];
    }

    /// @inheritdoc IPositionManager
    function realizedPnlUsdc(uint256 positionId) external view returns (int256) {
        return _requirePosition(positionId).realizedPnlUsdc;
    }

    /// @inheritdoc IPositionManager
    function getPosition(uint256 positionId) external view returns (Position memory) {
        return _requirePosition(positionId);
    }

    /// @inheritdoc IPositionManager
    function getExitRules(uint256 positionId) external view returns (ExitRule[] memory) {
        _requirePosition(positionId);
        return _exitRules[positionId];
    }

    /// @inheritdoc IPositionManager
    function getNextExitRule(uint256 positionId) external view returns (ExitRule memory) {
        Position memory position = _requirePosition(positionId);
        if (position.status != PositionStatus.Open) revert PositionNotOpen(positionId);
        ExitRule[] storage rules = _exitRules[positionId];
        if (position.nextRuleIndex >= rules.length) revert InvalidExitState(positionId);
        return rules[position.nextRuleIndex];
    }

    /// @inheritdoc IPositionManager
    function positionCount() external view returns (uint256) {
        return _nextPositionId - 1;
    }

    /// @inheritdoc IPositionManager
    function totalTokenLedger(address token) external view returns (uint256) {
        return _totalTokenLedger[token];
    }

    // -------------------------------------------------------------------------
    // TradeRouter hooks
    // -------------------------------------------------------------------------

    /// @notice Create a position and credit the agent token ledger.
    function openPosition(
        uint256 agentId,
        address vault,
        address token,
        uint256 tokenAmount,
        uint256 entryPriceUsdc,
        uint256 usdcCostBasis,
        uint16 maxSlippageBps,
        ExitRule[] calldata exits
    ) external onlyTradeRouter returns (uint256 positionId) {
        if (_openPositionId[agentId][token] != 0) revert PositionAlreadyOpen(agentId, token);

        positionId = _nextPositionId++;
        _positions[positionId] = Position({
            positionId: positionId,
            agentId: agentId,
            vault: vault,
            token: token,
            tokenAmount: tokenAmount,
            entryPriceUsdc: entryPriceUsdc,
            usdcCostBasis: usdcCostBasis,
            maxSlippageBps: maxSlippageBps,
            status: PositionStatus.Open,
            nextRuleIndex: 0,
            openedAt: uint64(block.timestamp),
            realizedPnlUsdc: 0
        });

        ExitRule[] storage stored = _exitRules[positionId];
        uint256 len = exits.length;
        for (uint256 i = 0; i < len; i++) {
            stored.push(exits[i]);
        }

        _agentTokenBalance[agentId][token] += tokenAmount;
        _totalTokenLedger[token] += tokenAmount;
        _openPositionId[agentId][token] = positionId;
        _openPositionIdsByAgent[agentId].push(positionId);

        emit PositionOpened(positionId, agentId, vault, token, tokenAmount, entryPriceUsdc, usdcCostBasis);
    }

    /// @notice Apply a keeper ladder exit (advances nextRuleIndex).
    function applyLadderExit(uint256 positionId, uint256 tokenSold, uint256 usdcReleased, int256 realizedPnlDelta)
        external
        onlyTradeRouter
        returns (uint8 ruleIndex)
    {
        Position storage position = _positions[positionId];
        if (position.status != PositionStatus.Open) revert PositionNotOpen(positionId);

        ExitRule[] storage rules = _exitRules[positionId];
        if (position.nextRuleIndex >= rules.length) revert InvalidExitState(positionId);

        ruleIndex = position.nextRuleIndex;
        position.nextRuleIndex++;

        _reducePositionSize(position, tokenSold, usdcReleased, realizedPnlDelta);

        emit PositionLadderExitApplied(positionId, position.agentId, ruleIndex, tokenSold, usdcReleased);
    }

    /// @notice Apply an agent or operator discretionary sell (does not advance nextRuleIndex).
    function applyDiscretionaryReduce(
        uint256 positionId,
        uint256 tokenSold,
        uint256 usdcReleased,
        int256 realizedPnlDelta
    ) external onlyTradeRouter {
        Position storage position = _positions[positionId];
        if (position.status != PositionStatus.Open) revert PositionNotOpen(positionId);

        _reducePositionSize(position, tokenSold, usdcReleased, realizedPnlDelta);

        emit PositionReduced(positionId, position.agentId, tokenSold, usdcReleased);
    }

    /// @notice Add tokens to an open position with weighted-average entry price.
    function increasePosition(
        uint256 positionId,
        uint256 tokensAdded,
        uint256 usdcAdded,
        uint16 maxSlippageBps,
        uint256 newEntryPriceUsdc
    ) external onlyTradeRouter {
        Position storage position = _positions[positionId];
        if (position.status != PositionStatus.Open) revert PositionNotOpen(positionId);

        position.tokenAmount += tokensAdded;
        position.usdcCostBasis += usdcAdded;
        position.entryPriceUsdc = newEntryPriceUsdc;
        if (maxSlippageBps > position.maxSlippageBps) {
            position.maxSlippageBps = maxSlippageBps;
        }

        _agentTokenBalance[position.agentId][position.token] += tokensAdded;
        _totalTokenLedger[position.token] += tokensAdded;

        emit PositionIncreased(positionId, position.agentId, tokensAdded, usdcAdded, position.entryPriceUsdc);
    }

    /// @notice Replace pending exit rules from nextRuleIndex onward.
    function updatePendingExitRules(uint256 positionId, ExitRule[] calldata newPendingRules) external onlyTradeRouter {
        Position storage position = _positions[positionId];
        if (position.status != PositionStatus.Open) revert PositionNotOpen(positionId);
        if (newPendingRules.length == 0) revert InvalidPendingExitRules(positionId);

        ExitRule[] storage rules = _exitRules[positionId];
        uint8 idx = position.nextRuleIndex;
        while (rules.length > idx) {
            rules.pop();
        }
        uint256 len = newPendingRules.length;
        for (uint256 i = 0; i < len; i++) {
            rules.push(newPendingRules[i]);
        }

        emit PositionExitLadderUpdated(positionId, position.agentId, idx);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Wire the TradeRouter allowed to mutate positions.
    function setTradeRouter(address tradeRouter_) external onlyRole(TRADE_ROUTER_ADMIN_ROLE) {
        if (tradeRouter_ == address(0)) revert ZeroAddress();
        tradeRouter = tradeRouter_;
    }

    // -------------------------------------------------------------------------
    // Private Functions
    // -------------------------------------------------------------------------

    function _reducePositionSize(
        Position storage position,
        uint256 tokenSold,
        uint256 usdcReleased,
        int256 realizedPnlDelta
    ) private {
        position.tokenAmount -= tokenSold;
        position.usdcCostBasis -= usdcReleased;
        position.realizedPnlUsdc += realizedPnlDelta;
        _agentTokenBalance[position.agentId][position.token] -= tokenSold;
        _totalTokenLedger[position.token] -= tokenSold;

        if (position.tokenAmount == 0) {
            position.status = PositionStatus.Closed;
            delete _openPositionId[position.agentId][position.token];
            _removeOpenPositionFromAgent(position.agentId, position.positionId);
            emit PositionClosed(position.positionId, position.agentId, position.realizedPnlUsdc);
        }
    }

    /// @dev Removes `positionId` from `agentId`'s open index (swap-and-pop).
    function _removeOpenPositionFromAgent(uint256 agentId, uint256 positionId) private {
        uint256[] storage ids = _openPositionIdsByAgent[agentId];
        uint256 len = ids.length;
        for (uint256 i = 0; i < len; i++) {
            if (ids[i] == positionId) {
                ids[i] = ids[len - 1];
                ids.pop();
                return;
            }
        }
    }

    function _requirePosition(uint256 positionId) private view returns (Position memory position) {
        position = _positions[positionId];
        if (position.positionId == 0) revert PositionNotFound(positionId);
    }
}
