// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title IAllocationManager
/// @notice Tracks per-agent USDC-equivalent exposure caps against vault capital.
interface IAllocationManager {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    enum AllocationStatus {
        Active,
        Paused,
        Removed
    }

    struct Allocation {
        uint256 agentId;
        address vault;
        uint256 trackId;
        /// @dev USDC-equivalent exposure cap for this agent on `vault`.
        uint256 cap;
        /// @dev USDC-equivalent notional currently deployed (updated by operator until TradeRouter).
        uint256 used;
        AllocationStatus status;
        uint64 createdAt;
        uint64 updatedAt;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event AgentRegistryUpdated(address indexed newRegistry);

    event TrackConfigUpdated(address indexed newTrackConfig);

    event AllocationCreated(uint256 indexed agentId, address indexed vault, uint256 trackId, uint256 cap);

    event AllocationUpdated(
        uint256 indexed agentId, address indexed vault, uint256 trackId, uint256 cap, AllocationStatus status
    );

    event AllocationUsedUpdated(uint256 indexed agentId, uint256 used);

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function getAllocation(uint256 agentId) external view returns (Allocation memory);

    function allocationCap(uint256 agentId) external view returns (uint256);

    /// @notice USDC-equivalent notional currently deployed for `agentId`.
    function allocationUsed(uint256 agentId) external view returns (uint256);

    /// @notice Sum of all agent `cap` values on `vault`.
    function totalAgentCaps(address vault) external view returns (uint256);

    // -------------------------------------------------------------------------
    // AgentRegistry hooks
    // -------------------------------------------------------------------------

    /// @notice Create allocation when an agent registers on a vault track.
    function onAgentRegistered(uint256 agentId, address vault, uint256 trackId) external;

    /// @notice Resize allocation when an agent is promoted to a new track.
    function onAgentPromoted(uint256 agentId, address vault, uint256 fromTrackId, uint256 toTrackId) external;

    // -------------------------------------------------------------------------
    // Operator
    // -------------------------------------------------------------------------

    function setAllocationStatus(uint256 agentId, AllocationStatus status) external;

    /// @param used USDC-equivalent notional deployed; must not exceed `cap`.
    function setAllocationUsed(uint256 agentId, uint256 used) external;

    /// @notice Updates `used` from TradeRouter after position open/exit.
    function setAllocationUsedByRouter(uint256 agentId, uint256 used) external;
}
