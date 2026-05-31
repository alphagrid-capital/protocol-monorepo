// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IAllocationManager } from "../interfaces/IAllocationManager.sol";
import { ITrackConfig } from "../interfaces/ITrackConfig.sol";

/// @title AllocationManager
/// @notice Tracks per-agent USDC-equivalent exposure caps for vault capital.
contract AllocationManager is IAllocationManager, AccessControl {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    bytes32 public constant TRADE_ROUTER_ROLE = keccak256("TRADE_ROUTER_ROLE");

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    address public agentRegistry;
    ITrackConfig public trackConfig;

    mapping(uint256 agentId => Allocation allocation) private _allocations;
    mapping(address vault => uint256 totalCap) private _totalAgentCaps;

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error NotAgentRegistry(address caller);
    error AllocationExists(uint256 agentId);
    error AllocationNotFound(uint256 agentId);
    error VaultMismatch(uint256 agentId, address expected, address actual);
    error TrackMismatch(uint256 agentId, uint256 expected, uint256 actual);
    error ExceedsMaxAllocation(uint256 agentId, uint256 cap, uint256 maxAllocation);
    error UsedExceedsCap(uint256 agentId, uint256 used, uint256 cap);
    error TrackConfigNotSet();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param admin Receives `DEFAULT_ADMIN_ROLE` and `OPERATOR_ROLE`.
    /// @param trackConfig_ Per-vault track parameters.
    constructor(address admin, ITrackConfig trackConfig_) {
        if (admin == address(0) || address(trackConfig_) == address(0)) revert ZeroAddress();

        trackConfig = trackConfig_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Modifiers
    // -------------------------------------------------------------------------

    modifier onlyAgentRegistry() {
        _onlyAgentRegistry();
        _;
    }

    function _onlyAgentRegistry() internal view {
        if (msg.sender != agentRegistry) revert NotAgentRegistry(msg.sender);
    }

    // -------------------------------------------------------------------------
    // AgentRegistry hooks
    // -------------------------------------------------------------------------

    /// @inheritdoc IAllocationManager
    function onAgentRegistered(uint256 agentId, address vault, uint256 trackId) external onlyAgentRegistry {
        if (_allocations[agentId].vault != address(0)) revert AllocationExists(agentId);

        uint256 cap = _initialCap(vault, trackId);
        _createAllocation(agentId, vault, trackId, cap);
    }

    /// @inheritdoc IAllocationManager
    function onAgentPromoted(uint256 agentId, address vault, uint256 fromTrackId, uint256 toTrackId)
        external
        onlyAgentRegistry
    {
        Allocation storage allocation = _requireAllocation(agentId);
        if (allocation.vault != vault) revert VaultMismatch(agentId, allocation.vault, vault);
        if (allocation.trackId != fromTrackId) revert TrackMismatch(agentId, allocation.trackId, fromTrackId);

        uint256 cap = _initialCap(vault, toTrackId);
        _totalAgentCaps[vault] -= allocation.cap;
        allocation.trackId = toTrackId;
        allocation.cap = cap;
        allocation.updatedAt = uint64(block.timestamp);
        _totalAgentCaps[vault] += cap;

        emit AllocationUpdated(agentId, vault, toTrackId, cap, allocation.status);
    }

    // -------------------------------------------------------------------------
    // Operator
    // -------------------------------------------------------------------------

    /// @inheritdoc IAllocationManager
    function setAllocationStatus(uint256 agentId, AllocationStatus status) external onlyRole(OPERATOR_ROLE) {
        Allocation storage allocation = _requireAllocation(agentId);
        allocation.status = status;
        allocation.updatedAt = uint64(block.timestamp);
        emit AllocationUpdated(agentId, allocation.vault, allocation.trackId, allocation.cap, status);
    }

    /// @inheritdoc IAllocationManager
    function setAllocationUsed(uint256 agentId, uint256 used) external onlyRole(OPERATOR_ROLE) {
        _setAllocationUsed(agentId, used);
    }

    /// @inheritdoc IAllocationManager
    function setAllocationUsedByRouter(uint256 agentId, uint256 used) external onlyRole(TRADE_ROUTER_ROLE) {
        _setAllocationUsed(agentId, used);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @inheritdoc IAllocationManager
    function getAllocation(uint256 agentId) external view returns (Allocation memory) {
        return _requireAllocation(agentId);
    }

    /// @inheritdoc IAllocationManager
    function allocationCap(uint256 agentId) external view returns (uint256) {
        return _requireAllocation(agentId).cap;
    }

    /// @inheritdoc IAllocationManager
    function allocationUsed(uint256 agentId) external view returns (uint256) {
        return _requireAllocation(agentId).used;
    }

    /// @inheritdoc IAllocationManager
    function totalAgentCaps(address vault) external view returns (uint256) {
        return _totalAgentCaps[vault];
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Wire the AgentRegistry allowed to invoke lifecycle hooks.
    function setAgentRegistry(address agentRegistry_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (agentRegistry_ == address(0)) revert ZeroAddress();
        agentRegistry = agentRegistry_;
        emit AgentRegistryUpdated(agentRegistry_);
    }

    /// @notice Update TrackConfig used for allocation caps.
    function setTrackConfig(ITrackConfig trackConfig_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(trackConfig_) == address(0)) revert ZeroAddress();
        trackConfig = trackConfig_;
        emit TrackConfigUpdated(address(trackConfig_));
    }

    // -------------------------------------------------------------------------
    // Private Functions
    // -------------------------------------------------------------------------

    function _initialCap(address vault, uint256 trackId) private view returns (uint256) {
        if (address(trackConfig) == address(0)) revert TrackConfigNotSet();

        ITrackConfig.VaultTrackConfig memory config = trackConfig.getVaultTrackConfig(vault, trackId);
        if (config.initialAllocation > config.maxAllocation) {
            revert ExceedsMaxAllocation(0, config.initialAllocation, config.maxAllocation);
        }
        return config.initialAllocation;
    }

    function _createAllocation(uint256 agentId, address vault, uint256 trackId, uint256 cap) private {
        _allocations[agentId] = Allocation({
            agentId: agentId,
            vault: vault,
            trackId: trackId,
            cap: cap,
            used: 0,
            status: AllocationStatus.Active,
            createdAt: uint64(block.timestamp),
            updatedAt: uint64(block.timestamp)
        });
        _totalAgentCaps[vault] += cap;

        emit AllocationCreated(agentId, vault, trackId, cap);
    }

    function _requireAllocation(uint256 agentId) private view returns (Allocation storage allocation) {
        allocation = _allocations[agentId];
        if (allocation.vault == address(0)) revert AllocationNotFound(agentId);
    }

    function _setAllocationUsed(uint256 agentId, uint256 used) private {
        Allocation storage allocation = _requireAllocation(agentId);
        if (used > allocation.cap) revert UsedExceedsCap(agentId, used, allocation.cap);
        allocation.used = used;
        allocation.updatedAt = uint64(block.timestamp);
        emit AllocationUsedUpdated(agentId, used);
    }
}
