// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ReentrancyGuard } from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { SafeCast } from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import { IAgentRegistry } from "../interfaces/IAgentRegistry.sol";
import { IAllocationManager } from "../interfaces/IAllocationManager.sol";
import { IMandateVault } from "../interfaces/IMandateVault.sol";
import { IPositionManager } from "../interfaces/IPositionManager.sol";
import { ISwapAdapter } from "../interfaces/ISwapAdapter.sol";
import { ITradeRouter } from "../interfaces/ITradeRouter.sol";
import { IVaultTrackRegistry } from "../interfaces/IVaultTrackRegistry.sol";
import { OracleLib } from "../libraries/OracleLib.sol";

/// @title TradeRouter
/// @notice Executes signed position opens/adjustments, permissionless keeper exits, and operator force closes.
contract TradeRouter is ITradeRouter, AccessControl, EIP712, ReentrancyGuard {
    using Math for uint256;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    bytes32 public constant EXECUTOR_ROLE = keccak256("EXECUTOR_ROLE");

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    uint256 public constant MAX_BPS = 10_000;
    uint256 public constant MAX_EXIT_RULES = 5;

    bytes32 public constant OPEN_POSITION_TYPEHASH = keccak256(
        "OpenPosition(uint256 agentId,address vault,address token,uint256 usdcAmount,uint256 minTokenOut,uint16 maxSlippageBps,bytes32 exitsHash,uint256 deadline,uint256 nonce)"
    );

    bytes32 public constant ADD_TO_POSITION_TYPEHASH = keccak256(
        "AddToPosition(uint256 agentId,uint256 positionId,uint256 usdcAmount,uint256 minTokenOut,uint16 maxSlippageBps,uint256 deadline,uint256 nonce)"
    );

    bytes32 public constant REDUCE_POSITION_TYPEHASH =
        keccak256("ReducePosition(uint256 agentId,uint256 positionId,uint16 exitBps,uint256 deadline,uint256 nonce)");

    bytes32 public constant UPDATE_EXIT_LADDER_TYPEHASH = keccak256(
        "UpdateExitLadder(uint256 agentId,uint256 positionId,bytes32 exitsHash,uint256 deadline,uint256 nonce)"
    );

    enum SellMode {
        Ladder,
        Discretionary,
        ForceClose
    }

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IAgentRegistry public agentRegistry;
    IAllocationManager public allocationManager;
    IPositionManager public positionManager;
    ISwapAdapter public swapAdapter;
    IVaultTrackRegistry public vaultTrackRegistry;

    mapping(uint256 agentId => uint256 nonce) private _nonces;
    mapping(uint256 agentId => mapping(uint256 day => uint256 turnoverUsdc)) private _dailyTurnoverUsdc;
    mapping(uint256 agentId => mapping(uint256 day => int256 realizedPnlUsdc)) private _dailyRealizedPnlUsdc;
    mapping(uint256 agentId => uint256 turnoverUsdc) private _lifetimeTurnoverUsdc;
    mapping(uint256 agentId => int256 realizedPnlUsdc) private _lifetimeRealizedPnlUsdc;
    mapping(uint256 agentId => uint32 trades) private _tradeCount;
    mapping(uint256 agentId => uint32 opened) private _positionsOpened;
    mapping(uint256 agentId => uint32 closed) private _positionsClosed;

    uint256 public keeperBountyBps;
    uint256 public maxKeeperBounty;

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error ExpiredDeadline();
    error InvalidSignature();
    error InvalidNonce(uint256 expected, uint256 provided);
    error AgentNotTradable(uint256 agentId);
    error VaultMismatch(uint256 agentId, address expected, address actual);
    error TokenNotAllowed(address token);
    error PositionAlreadyOpen(uint256 agentId, address token);
    error InvalidExitRules();
    error ExitRulesOutOfBounds();
    error AllocationNotActive(uint256 agentId);
    error ExceedsAllocationCap(uint256 agentId, uint256 used, uint256 cap);
    error ExceedsMaxTradeSize(uint256 tradeSize, uint256 maxTradeSize);
    error ExceedsDailyTurnover(uint256 agentId, uint256 turnover, uint256 maxTurnover);
    error ExceedsDailyLoss(uint256 agentId, uint256 lossUsdc, uint256 maxLossUsdc);
    error TriggerNotMet(uint256 positionId);
    error PositionNotOpen(uint256 positionId);
    error PositionAgentMismatch(uint256 positionId, uint256 agentId);
    error InvalidReduceAmount(uint256 positionId);
    error TooManyExitRules(uint256 positionId);
    error PendingRuleAlreadyTriggered(uint256 positionId);
    error AgentNotSuspended(uint256 agentId);
    error RegistryPaused();
    error VaultTrackNotActive(address vault, uint256 trackId);
    error BpsOutOfRange(uint256 bps);
    error LedgerExceedsVaultBalance(address token, uint256 ledgerTotal, uint256 vaultBalance);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(
        address admin,
        IAgentRegistry agentRegistry_,
        IAllocationManager allocationManager_,
        IPositionManager positionManager_,
        ISwapAdapter swapAdapter_,
        IVaultTrackRegistry vaultTrackRegistry_
    ) EIP712("AlphaGrid TradeRouter", "1") {
        if (
            admin == address(0) || address(agentRegistry_) == address(0) || address(allocationManager_) == address(0)
                || address(positionManager_) == address(0) || address(swapAdapter_) == address(0)
                || address(vaultTrackRegistry_) == address(0)
        ) revert ZeroAddress();

        agentRegistry = agentRegistry_;
        allocationManager = allocationManager_;
        positionManager = positionManager_;
        swapAdapter = swapAdapter_;
        vaultTrackRegistry = vaultTrackRegistry_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(EXECUTOR_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @inheritdoc ITradeRouter
    function nonces(uint256 agentId) external view returns (uint256) {
        return _nonces[agentId];
    }

    /// @inheritdoc ITradeRouter
    function isTriggerMet(uint256 positionId) public view returns (bool) {
        Position memory position = positionManager.getPosition(positionId);
        if (position.status != PositionStatus.Open) return false;

        ExitRule memory rule = positionManager.getNextExitRule(positionId);
        int256 pnlBps = _positionPnlBps(position);
        return _isRuleTriggered(rule, pnlBps);
    }

    /// @inheritdoc ITradeRouter
    function dailyTurnoverUsdc(uint256 agentId, uint256 day) external view returns (uint256) {
        return _dailyTurnoverUsdc[agentId][day];
    }

    /// @inheritdoc ITradeRouter
    function dailyRealizedPnlUsdc(uint256 agentId, uint256 day) external view returns (int256) {
        return _dailyRealizedPnlUsdc[agentId][day];
    }

    /// @inheritdoc ITradeRouter
    function lifetimeRealizedPnlUsdc(uint256 agentId) external view returns (int256) {
        return _lifetimeRealizedPnlUsdc[agentId];
    }

    /// @inheritdoc ITradeRouter
    function lifetimeTurnoverUsdc(uint256 agentId) external view returns (uint256) {
        return _lifetimeTurnoverUsdc[agentId];
    }

    /// @inheritdoc ITradeRouter
    function positionPnlBps(uint256 positionId) external view returns (int256) {
        return _positionPnlBps(positionManager.getPosition(positionId));
    }

    /// @inheritdoc ITradeRouter
    function positionUnrealizedPnlUsdc(uint256 positionId) external view returns (int256) {
        Position memory position = positionManager.getPosition(positionId);
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

    /// @inheritdoc ITradeRouter
    function tradeCount(uint256 agentId) external view returns (uint32) {
        return _tradeCount[agentId];
    }

    /// @inheritdoc ITradeRouter
    function positionsOpened(uint256 agentId) external view returns (uint32) {
        return _positionsOpened[agentId];
    }

    /// @inheritdoc ITradeRouter
    function positionsClosed(uint256 agentId) external view returns (uint32) {
        return _positionsClosed[agentId];
    }

    // -------------------------------------------------------------------------
    // Execution
    // -------------------------------------------------------------------------

    /// @inheritdoc ITradeRouter
    function openPosition(PositionIntent calldata intent, bytes calldata signature)
        external
        onlyRole(EXECUTOR_ROLE)
        nonReentrant
        returns (uint256 positionId)
    {
        _validateOpenIntent(intent, signature);
        positionId = _openPosition(intent);
        emit PositionOpenedFromIntent(positionId, intent.agentId, intent.vault, intent.token, intent.usdcAmount);
    }

    /// @inheritdoc ITradeRouter
    function addToPosition(AddToPositionIntent calldata intent, bytes calldata signature)
        external
        onlyRole(EXECUTOR_ROLE)
        nonReentrant
        returns (uint256 tokensAdded)
    {
        _validateAddIntent(intent, signature);
        tokensAdded = _addToPosition(intent);
        emit PositionIncreasedFromIntent(intent.positionId, intent.agentId, intent.usdcAmount, tokensAdded);
    }

    /// @inheritdoc ITradeRouter
    function reducePosition(ReducePositionIntent calldata intent, bytes calldata signature)
        external
        onlyRole(EXECUTOR_ROLE)
        nonReentrant
        returns (uint256 usdcOut)
    {
        _validateReduceIntent(intent, signature);
        usdcOut = _reducePosition(intent);
        emit PositionReducedFromIntent(intent.positionId, intent.agentId, intent.exitBps, usdcOut);
    }

    /// @inheritdoc ITradeRouter
    function updateExitLadder(UpdateExitLadderIntent calldata intent, bytes calldata signature)
        external
        onlyRole(EXECUTOR_ROLE)
        nonReentrant
    {
        _validateUpdateExitLadderIntent(intent, signature);
        Position memory position = positionManager.getPosition(intent.positionId);
        positionManager.updatePendingExitRules(intent.positionId, intent.exits);
        _nonces[intent.agentId]++;
        emit PositionExitLadderUpdatedFromIntent(intent.positionId, intent.agentId, position.nextRuleIndex);
    }

    /// @inheritdoc ITradeRouter
    function executeExit(uint256 positionId) external nonReentrant returns (uint256 usdcOut) {
        Position memory position = positionManager.getPosition(positionId);
        if (position.status != PositionStatus.Open) revert PositionNotOpen(positionId);

        ExitRule memory rule = positionManager.getNextExitRule(positionId);
        int256 pnlBps = _positionPnlBps(position);
        if (!_isRuleTriggered(rule, pnlBps)) revert TriggerNotMet(positionId);

        uint256 sellAmount = position.tokenAmount.mulDiv(rule.exitBps, MAX_BPS, Math.Rounding.Floor);
        if (sellAmount == 0) revert TriggerNotMet(positionId);

        uint256 usdcReleased = position.usdcCostBasis.mulDiv(sellAmount, position.tokenAmount, Math.Rounding.Floor);
        uint8 ruleIndex = position.nextRuleIndex;
        uint256 bounty;

        (usdcOut, bounty) = _sell(positionId, position, sellAmount, usdcReleased, msg.sender, true, SellMode.Ladder);

        emit ExitExecuted(positionId, position.agentId, ruleIndex, msg.sender, usdcOut, bounty);
    }

    /// @inheritdoc ITradeRouter
    function forceClose(uint256 positionId) external onlyRole(OPERATOR_ROLE) nonReentrant returns (uint256 usdcOut) {
        Position memory position = positionManager.getPosition(positionId);
        if (position.status != PositionStatus.Open) revert PositionNotOpen(positionId);

        IAgentRegistry.Agent memory agent = agentRegistry.getAgent(position.agentId);
        if (agent.status != IAgentRegistry.AgentStatus.Suspended) revert AgentNotSuspended(position.agentId);

        uint256 sellAmount = position.tokenAmount;
        uint256 usdcReleased = position.usdcCostBasis;

        (usdcOut,) = _sell(positionId, position, sellAmount, usdcReleased, address(0), false, SellMode.ForceClose);

        emit PositionForceClosed(positionId, position.agentId, msg.sender, usdcOut);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setKeeperBounty(uint256 keeperBountyBps_, uint256 maxKeeperBounty_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (keeperBountyBps_ > MAX_BPS) revert BpsOutOfRange(keeperBountyBps_);
        keeperBountyBps = keeperBountyBps_;
        maxKeeperBounty = maxKeeperBounty_;
        emit KeeperBountyUpdated(keeperBountyBps_, maxKeeperBounty_);
    }

    // -------------------------------------------------------------------------
    // Private Functions — validation
    // -------------------------------------------------------------------------

    function _validateOpenIntent(PositionIntent calldata intent, bytes calldata signature) private view {
        if (Pausable(address(agentRegistry)).paused()) revert RegistryPaused();
        if (block.timestamp > intent.deadline) revert ExpiredDeadline();
        if (_nonces[intent.agentId] != intent.nonce) {
            revert InvalidNonce(_nonces[intent.agentId], intent.nonce);
        }
        _verifyOpenSignature(intent, signature);
        uint256 trackId = uint256(agentRegistry.trackOf(intent.agentId));
        _validateExitRulesForTrack(intent.exits, intent.vault, trackId);
        _validateAgentCanOpen(intent.agentId, intent.vault, intent.token);
        _validateTradeSize(IMandateVault(intent.vault), intent.agentId, intent.usdcAmount);
        _validateDailyTurnover(IMandateVault(intent.vault), intent.agentId, intent.usdcAmount);
        _validateDailyLoss(intent.agentId);

        IAllocationManager.Allocation memory allocation = allocationManager.getAllocation(intent.agentId);
        if (allocation.used + intent.usdcAmount > allocation.cap) {
            revert ExceedsAllocationCap(intent.agentId, allocation.used + intent.usdcAmount, allocation.cap);
        }
    }

    function _validateAddIntent(AddToPositionIntent calldata intent, bytes calldata signature) private view {
        if (Pausable(address(agentRegistry)).paused()) revert RegistryPaused();
        if (block.timestamp > intent.deadline) revert ExpiredDeadline();
        if (_nonces[intent.agentId] != intent.nonce) {
            revert InvalidNonce(_nonces[intent.agentId], intent.nonce);
        }
        _verifyAddSignature(intent, signature);
        Position memory position = _requireOpenPositionForAgent(intent.positionId, intent.agentId);
        IAgentRegistry.Agent memory agent = _requireActiveAgent(intent.agentId);
        if (agent.vault != position.vault) revert VaultMismatch(intent.agentId, agent.vault, position.vault);

        _validateTradeSize(IMandateVault(position.vault), intent.agentId, intent.usdcAmount);
        _validateDailyTurnover(IMandateVault(position.vault), intent.agentId, intent.usdcAmount);
        _validateDailyLoss(intent.agentId);

        IAllocationManager.Allocation memory allocation = allocationManager.getAllocation(intent.agentId);
        if (allocation.used + intent.usdcAmount > allocation.cap) {
            revert ExceedsAllocationCap(intent.agentId, allocation.used + intent.usdcAmount, allocation.cap);
        }
    }

    function _validateReduceIntent(ReducePositionIntent calldata intent, bytes calldata signature) private view {
        if (block.timestamp > intent.deadline) revert ExpiredDeadline();
        if (_nonces[intent.agentId] != intent.nonce) {
            revert InvalidNonce(_nonces[intent.agentId], intent.nonce);
        }
        if (intent.exitBps == 0 || intent.exitBps > MAX_BPS) revert BpsOutOfRange(intent.exitBps);
        _verifyReduceSignature(intent, signature);
        Position memory position = _requireOpenPositionForAgent(intent.positionId, intent.agentId);
        _requireActiveAgent(intent.agentId);
        uint256 sellAmount = position.tokenAmount.mulDiv(intent.exitBps, MAX_BPS, Math.Rounding.Floor);
        if (sellAmount == 0) revert InvalidReduceAmount(intent.positionId);
    }

    function _validateUpdateExitLadderIntent(UpdateExitLadderIntent calldata intent, bytes calldata signature)
        private
        view
    {
        if (block.timestamp > intent.deadline) revert ExpiredDeadline();
        if (_nonces[intent.agentId] != intent.nonce) {
            revert InvalidNonce(_nonces[intent.agentId], intent.nonce);
        }
        if (intent.exits.length == 0) revert InvalidExitRules();
        _verifyUpdateExitLadderSignature(intent, signature);
        Position memory position = _requireOpenPositionForAgent(intent.positionId, intent.agentId);
        _requireActiveAgent(intent.agentId);

        uint256 trackId = uint256(agentRegistry.trackOf(intent.agentId));
        _validateExitRulesForTrack(intent.exits, position.vault, trackId);

        if (position.nextRuleIndex + intent.exits.length > MAX_EXIT_RULES) {
            revert TooManyExitRules(intent.positionId);
        }

        int256 pnlBps = _positionPnlBps(position);
        if (_isRuleTriggered(intent.exits[0], pnlBps)) {
            revert PendingRuleAlreadyTriggered(intent.positionId);
        }
    }

    function _requireOpenPositionForAgent(uint256 positionId, uint256 agentId)
        private
        view
        returns (Position memory position)
    {
        position = positionManager.getPosition(positionId);
        if (position.status != PositionStatus.Open) revert PositionNotOpen(positionId);
        if (position.agentId != agentId) revert PositionAgentMismatch(positionId, agentId);
    }

    // -------------------------------------------------------------------------
    // Private Functions — execution
    // -------------------------------------------------------------------------

    function _openPosition(PositionIntent calldata intent) private returns (uint256 positionId) {
        IMandateVault vault = IMandateVault(intent.vault);
        IAllocationManager.Allocation memory allocation = allocationManager.getAllocation(intent.agentId);

        vault.pullAssetsForTrade(address(swapAdapter), intent.usdcAmount);
        uint256 tokenOut =
            swapAdapter.swapUsdcForToken(intent.vault, intent.token, intent.usdcAmount, intent.minTokenOut);

        uint8 tokenDecimals = vault.tokenRegistry().tokenDecimals(intent.token);
        uint256 entryPriceUsdc = (intent.usdcAmount * (10 ** tokenDecimals)) / tokenOut;

        positionId = positionManager.openPosition(
            intent.agentId,
            intent.vault,
            intent.token,
            tokenOut,
            entryPriceUsdc,
            intent.usdcAmount,
            intent.maxSlippageBps,
            intent.exits
        );

        _nonces[intent.agentId]++;
        allocationManager.setAllocationUsedByRouter(intent.agentId, allocation.used + intent.usdcAmount);

        _recordDailyTurnover(intent.agentId, intent.usdcAmount);
        _recordTrade(intent.agentId);
        _positionsOpened[intent.agentId]++;
        _assertLedgerInvariant(vault, intent.token);
    }

    function _addToPosition(AddToPositionIntent calldata intent) private returns (uint256 tokensAdded) {
        Position memory position = positionManager.getPosition(intent.positionId);
        IMandateVault vault = IMandateVault(position.vault);
        IAllocationManager.Allocation memory allocation = allocationManager.getAllocation(intent.agentId);

        vault.pullAssetsForTrade(address(swapAdapter), intent.usdcAmount);
        tokensAdded =
            swapAdapter.swapUsdcForToken(position.vault, position.token, intent.usdcAmount, intent.minTokenOut);

        uint8 tokenDecimals = vault.tokenRegistry().tokenDecimals(position.token);
        uint256 newTokenAmount = position.tokenAmount + tokensAdded;
        uint256 newUsdcCostBasis = position.usdcCostBasis + intent.usdcAmount;
        uint256 newEntryPriceUsdc = (newUsdcCostBasis * (10 ** tokenDecimals)) / newTokenAmount;

        positionManager.increasePosition(
            intent.positionId, tokensAdded, intent.usdcAmount, intent.maxSlippageBps, newEntryPriceUsdc
        );

        _nonces[intent.agentId]++;
        allocationManager.setAllocationUsedByRouter(intent.agentId, allocation.used + intent.usdcAmount);

        _recordDailyTurnover(intent.agentId, intent.usdcAmount);
        _recordTrade(intent.agentId);
        _assertLedgerInvariant(vault, position.token);
    }

    function _reducePosition(ReducePositionIntent calldata intent) private returns (uint256 usdcOut) {
        Position memory position = positionManager.getPosition(intent.positionId);
        uint256 sellAmount = position.tokenAmount.mulDiv(intent.exitBps, MAX_BPS, Math.Rounding.Floor);
        uint256 usdcReleased = position.usdcCostBasis.mulDiv(sellAmount, position.tokenAmount, Math.Rounding.Floor);

        (usdcOut,) =
            _sell(intent.positionId, position, sellAmount, usdcReleased, address(0), false, SellMode.Discretionary);

        _nonces[intent.agentId]++;
    }

    // -------------------------------------------------------------------------
    // Private Functions — signatures
    // -------------------------------------------------------------------------

    function _verifyOpenSignature(PositionIntent calldata intent, bytes calldata signature) private view {
        bytes32 structHash = keccak256(
            abi.encode(
                OPEN_POSITION_TYPEHASH,
                intent.agentId,
                intent.vault,
                intent.token,
                intent.usdcAmount,
                intent.minTokenOut,
                intent.maxSlippageBps,
                _hashExitRules(intent.exits),
                intent.deadline,
                intent.nonce
            )
        );
        _recoverSigner(intent.agentId, structHash, signature);
    }

    function _verifyAddSignature(AddToPositionIntent calldata intent, bytes calldata signature) private view {
        bytes32 structHash = keccak256(
            abi.encode(
                ADD_TO_POSITION_TYPEHASH,
                intent.agentId,
                intent.positionId,
                intent.usdcAmount,
                intent.minTokenOut,
                intent.maxSlippageBps,
                intent.deadline,
                intent.nonce
            )
        );
        _recoverSigner(intent.agentId, structHash, signature);
    }

    function _verifyReduceSignature(ReducePositionIntent calldata intent, bytes calldata signature) private view {
        bytes32 structHash = keccak256(
            abi.encode(
                REDUCE_POSITION_TYPEHASH,
                intent.agentId,
                intent.positionId,
                intent.exitBps,
                intent.deadline,
                intent.nonce
            )
        );
        _recoverSigner(intent.agentId, structHash, signature);
    }

    function _verifyUpdateExitLadderSignature(UpdateExitLadderIntent calldata intent, bytes calldata signature)
        private
        view
    {
        bytes32 structHash = keccak256(
            abi.encode(
                UPDATE_EXIT_LADDER_TYPEHASH,
                intent.agentId,
                intent.positionId,
                _hashExitRules(intent.exits),
                intent.deadline,
                intent.nonce
            )
        );
        _recoverSigner(intent.agentId, structHash, signature);
    }

    function _recoverSigner(uint256 agentId, bytes32 structHash, bytes calldata signature) private view {
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = ECDSA.recover(digest, signature);
        if (signer != agentRegistry.signerOf(agentId)) revert InvalidSignature();
    }

    function _hashExitRules(ExitRule[] calldata exits) private pure returns (bytes32) {
        uint256 len = exits.length;
        bytes32[] memory hashes = new bytes32[](len);
        for (uint256 i = 0; i < len; i++) {
            hashes[i] = keccak256(abi.encode(exits[i].triggerType, exits[i].triggerBps, exits[i].exitBps));
        }
        return keccak256(abi.encode(hashes));
    }

    function _validateExitRules(ExitRule[] calldata exits) private pure {
        uint256 len = exits.length;
        if (len == 0 || len > MAX_EXIT_RULES) revert InvalidExitRules();
        if (exits[len - 1].exitBps != MAX_BPS) revert InvalidExitRules();

        int256 lastStop = type(int256).max;
        int256 lastTp = type(int256).min;

        for (uint256 i = 0; i < len; i++) {
            ExitRule calldata rule = exits[i];
            if (rule.exitBps == 0) revert InvalidExitRules();

            if (rule.triggerType == TriggerType.StopLoss) {
                if (rule.triggerBps >= 0) revert InvalidExitRules();
                if (lastStop != type(int256).max && rule.triggerBps >= lastStop) revert InvalidExitRules();
                lastStop = rule.triggerBps;
            } else {
                if (rule.triggerBps <= 0) revert InvalidExitRules();
                if (lastTp != type(int256).min && rule.triggerBps <= lastTp) revert InvalidExitRules();
                lastTp = rule.triggerBps;
            }
        }
    }

    function _validateExitRulesForTrack(ExitRule[] calldata exits, address vault, uint256 trackId) private view {
        _validateExitRules(exits);

        IVaultTrackRegistry.VaultTrackConfig memory config = vaultTrackRegistry.getVaultTrackConfig(vault, trackId);

        bool hasStopLoss;
        bool hasTakeProfit;

        uint256 len = exits.length;
        for (uint256 i = 0; i < len; i++) {
            ExitRule calldata rule = exits[i];
            if (rule.triggerType == TriggerType.StopLoss) {
                hasStopLoss = true;
                if (config.maxStopLossBps > 0 && rule.triggerBps < -SafeCast.toInt256(config.maxStopLossBps)) {
                    revert ExitRulesOutOfBounds();
                }
            } else {
                hasTakeProfit = true;
                if (config.minTakeProfitBps > 0 && rule.triggerBps < SafeCast.toInt256(config.minTakeProfitBps)) {
                    revert ExitRulesOutOfBounds();
                }
                if (config.maxTakeProfitBps > 0 && rule.triggerBps > SafeCast.toInt256(config.maxTakeProfitBps)) {
                    revert ExitRulesOutOfBounds();
                }
            }
        }

        if (config.requireStopLoss && !hasStopLoss) revert ExitRulesOutOfBounds();
        if (config.requireTakeProfit && !hasTakeProfit) revert ExitRulesOutOfBounds();
    }

    function _validateAgentCanOpen(uint256 agentId, address vault, address token) private view {
        IAgentRegistry.Agent memory agent = _requireActiveAgent(agentId);
        if (agent.vault != vault) revert VaultMismatch(agentId, agent.vault, vault);

        uint256 trackId = uint256(agentRegistry.trackOf(agentId));
        if (!vaultTrackRegistry.isVaultTrackActive(vault, trackId)) revert VaultTrackNotActive(vault, trackId);

        IAllocationManager.Allocation memory allocation = allocationManager.getAllocation(agentId);
        if (allocation.status != IAllocationManager.AllocationStatus.Active) revert AllocationNotActive(agentId);

        if (!IMandateVault(vault).isAllowedToken(token)) revert TokenNotAllowed(token);
        if (positionManager.openPositionId(agentId, token) != 0) revert PositionAlreadyOpen(agentId, token);
    }

    function _requireActiveAgent(uint256 agentId) private view returns (IAgentRegistry.Agent memory agent) {
        agent = agentRegistry.getAgent(agentId);
        if (agent.status != IAgentRegistry.AgentStatus.Active) revert AgentNotTradable(agentId);
    }

    function _validateTradeSize(IMandateVault vault, uint256 agentId, uint256 usdcAmount) private view {
        uint256 trackId = uint256(agentRegistry.trackOf(agentId));
        IVaultTrackRegistry.VaultTrackConfig memory config =
            vaultTrackRegistry.getVaultTrackConfig(address(vault), trackId);
        uint256 maxTrade = vault.totalAssets().mulDiv(config.maxTradeSizeBps, MAX_BPS, Math.Rounding.Floor);
        if (usdcAmount > maxTrade) revert ExceedsMaxTradeSize(usdcAmount, maxTrade);
    }

    function _validateDailyTurnover(IMandateVault vault, uint256 agentId, uint256 usdcNotional) private view {
        uint256 maxTurnover = _maxDailyTurnover(vault, agentId);
        if (maxTurnover == 0) return;

        uint256 day = block.timestamp / 1 days;
        uint256 nextTurnover = _dailyTurnoverUsdc[agentId][day] + usdcNotional;
        if (nextTurnover > maxTurnover) revert ExceedsDailyTurnover(agentId, nextTurnover, maxTurnover);
    }

    function _maxDailyTurnover(IMandateVault vault, uint256 agentId) private view returns (uint256) {
        uint256 trackId = uint256(agentRegistry.trackOf(agentId));
        IVaultTrackRegistry.VaultTrackConfig memory config =
            vaultTrackRegistry.getVaultTrackConfig(address(vault), trackId);
        if (config.maxDailyTurnoverBps == 0) return 0;
        return vault.totalAssets().mulDiv(config.maxDailyTurnoverBps, MAX_BPS, Math.Rounding.Floor);
    }

    function _recordDailyTurnover(uint256 agentId, uint256 usdcNotional) private {
        if (usdcNotional == 0) return;
        uint256 day = block.timestamp / 1 days;
        _dailyTurnoverUsdc[agentId][day] += usdcNotional;
        _lifetimeTurnoverUsdc[agentId] += usdcNotional;
    }

    function _validateDailyLoss(uint256 agentId) private view {
        uint256 trackId = uint256(agentRegistry.trackOf(agentId));
        IAllocationManager.Allocation memory allocation = allocationManager.getAllocation(agentId);
        IVaultTrackRegistry.VaultTrackConfig memory config =
            vaultTrackRegistry.getVaultTrackConfig(allocation.vault, trackId);
        if (config.maxDailyLossBps == 0) return;

        int256 dailyPnl = _dailyRealizedPnlUsdc[agentId][block.timestamp / 1 days];
        if (dailyPnl >= 0) return;

        uint256 lossUsdc = SafeCast.toUint256(-dailyPnl);
        uint256 maxLossUsdc = allocation.cap.mulDiv(config.maxDailyLossBps, MAX_BPS, Math.Rounding.Floor);
        if (lossUsdc >= maxLossUsdc) {
            revert ExceedsDailyLoss(agentId, lossUsdc, maxLossUsdc);
        }
    }

    function _recordDailyRealizedPnl(uint256 agentId, uint256 usdcReleased, uint256 usdcOut) private {
        if (usdcReleased == usdcOut) return;
        int256 delta = SafeCast.toInt256(usdcOut) - SafeCast.toInt256(usdcReleased);
        uint256 day = block.timestamp / 1 days;
        _dailyRealizedPnlUsdc[agentId][day] += delta;
        _lifetimeRealizedPnlUsdc[agentId] += delta;
    }

    function _recordTrade(uint256 agentId) private {
        _tradeCount[agentId]++;
    }

    function _maybeRecordPositionClosed(uint256 positionId) private {
        Position memory position = positionManager.getPosition(positionId);
        if (position.status == PositionStatus.Closed) {
            _positionsClosed[position.agentId]++;
        }
    }

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

    function _isRuleTriggered(ExitRule memory rule, int256 pnlBps) private pure returns (bool) {
        if (rule.triggerType == TriggerType.StopLoss) {
            return pnlBps <= rule.triggerBps;
        }
        return pnlBps >= rule.triggerBps;
    }

    function _minUsdcOut(IMandateVault vault, address token, uint256 tokenIn, uint16 maxSlippageBps)
        private
        view
        returns (uint256)
    {
        uint256 expected = OracleLib.valueInAsset(
            tokenIn,
            vault.tokenRegistry().priceOracle(),
            token,
            vault.tokenRegistry().tokenDecimals(token),
            vault.assetDecimals(),
            vault.maxPriceAge()
        );
        return expected.mulDiv(MAX_BPS - maxSlippageBps, MAX_BPS, Math.Rounding.Floor);
    }

    function _keeperBounty(uint256 usdcOut) private view returns (uint256) {
        if (keeperBountyBps == 0) return 0;
        uint256 bounty = usdcOut.mulDiv(keeperBountyBps, MAX_BPS, Math.Rounding.Floor);
        if (maxKeeperBounty != 0 && bounty > maxKeeperBounty) return maxKeeperBounty;
        return bounty;
    }

    function _sell(
        uint256 positionId,
        Position memory position,
        uint256 sellAmount,
        uint256 usdcReleased,
        address bountyRecipient,
        bool payBounty,
        SellMode mode
    ) private returns (uint256 usdcOut, uint256 bounty) {
        IMandateVault vault = IMandateVault(position.vault);
        uint256 minUsdcOut = _minUsdcOut(vault, position.token, sellAmount, position.maxSlippageBps);

        if (mode != SellMode.ForceClose) {
            _validateDailyTurnover(vault, position.agentId, minUsdcOut);
        }

        if (mode == SellMode.ForceClose) {
            vault.pullTokenForForceClose(position.token, address(swapAdapter), sellAmount);
        } else {
            vault.pullTokenForTrade(position.token, address(swapAdapter), sellAmount);
        }
        usdcOut = swapAdapter.swapTokenForUsdc(position.vault, position.token, sellAmount, minUsdcOut);

        if (payBounty) {
            bounty = _keeperBounty(usdcOut);
            if (bounty > 0) {
                vault.pullAssetsForTrade(bountyRecipient, bounty);
            }
        }

        if (mode == SellMode.Ladder) {
            positionManager.applyLadderExit(positionId, sellAmount, usdcReleased);
        } else {
            positionManager.applyDiscretionaryReduce(positionId, sellAmount, usdcReleased);
        }

        IAllocationManager.Allocation memory allocation = allocationManager.getAllocation(position.agentId);
        allocationManager.setAllocationUsedByRouter(position.agentId, allocation.used - usdcReleased);

        if (mode != SellMode.ForceClose) {
            _recordDailyTurnover(position.agentId, usdcOut);
        }

        _recordDailyRealizedPnl(position.agentId, usdcReleased, usdcOut);
        _recordTrade(position.agentId);
        _maybeRecordPositionClosed(positionId);

        _assertLedgerInvariant(vault, position.token);
    }

    function _assertLedgerInvariant(IMandateVault vault, address token) private view {
        uint256 ledgerTotal = positionManager.totalTokenLedger(token);
        uint256 vaultBalance = IERC20(token).balanceOf(address(vault));
        if (ledgerTotal > vaultBalance) revert LedgerExceedsVaultBalance(token, ledgerTotal, vaultBalance);
    }
}
