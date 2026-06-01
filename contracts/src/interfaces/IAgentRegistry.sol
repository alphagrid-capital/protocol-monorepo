// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title IAgentRegistry
/// @notice Canonical agent identity registry for AlphaGrid.
interface IAgentRegistry {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    /// @notice Lifecycle track within a bound vault.
    enum Track {
        CHALLENGE,
        FUNDED,
        PRIME
    }

    /// @notice Agent lifecycle status.
    enum AgentStatus {
        Draft,
        Active,
        Suspended,
        Failed,
        Graduated,
        Exited
    }

    /// @notice On-chain agent record.
    struct Agent {
        address owner;
        address signer;
        address vault;
        Track track;
        AgentStatus status;
        string name;
        string metadataURI;
        uint64 createdAt;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event AgentRegistered(
        uint256 indexed agentId,
        address indexed vault,
        address indexed owner,
        address signer,
        string metadataURI,
        Track track
    );

    event AgentMetadataUpdated(uint256 indexed agentId, string metadataURI);

    event AgentStatusChanged(uint256 indexed agentId, AgentStatus oldStatus, AgentStatus newStatus);

    event AgentSignerUpdated(uint256 indexed agentId, address signer);

    event AgentPromoted(uint256 indexed agentId, address indexed vault, Track fromTrack, Track toTrack);

    event FeeManagerUpdated(address indexed feeManager);

    event VaultTrackRegistryUpdated(address indexed vaultTrackRegistry);

    event AllocationManagerUpdated(address indexed allocationManager);

    // -------------------------------------------------------------------------
    // Registration
    // -------------------------------------------------------------------------

    /// @notice Register an agent on behalf of `owner`.
    function registerAgent(
        address owner,
        address vault,
        string calldata name,
        string calldata metadataURI,
        address signer
    ) external returns (uint256 agentId);

    /// @notice Self-register an agent using an EIP-712 signature from `signer`.
    function selfRegisterAgent(
        address vault,
        string calldata name,
        string calldata metadataURI,
        address signer,
        uint256 deadline,
        bytes calldata signature
    ) external returns (uint256 agentId);

    // -------------------------------------------------------------------------
    // Agent Management
    // -------------------------------------------------------------------------

    /// @notice Update agent metadata. Callable by the agent owner when not suspended.
    function updateAgentMetadata(uint256 agentId, string calldata metadataURI) external;

    /// @notice Update the agent signer. Callable by the agent owner.
    function setAgentSigner(uint256 agentId, address signer) external;

    /// @notice Set agent status. Callable by operators.
    function setAgentStatus(uint256 agentId, AgentStatus status) external;

    /// @notice Promote an agent one track forward within its bound vault.
    function promoteAgent(uint256 agentId, Track targetTrack) external;

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    function ownerOf(uint256 agentId) external view returns (address);

    function vaultOf(uint256 agentId) external view returns (address);

    function trackOf(uint256 agentId) external view returns (Track);

    function statusOf(uint256 agentId) external view returns (AgentStatus);

    function signerOf(uint256 agentId) external view returns (address);

    function getAgent(uint256 agentId) external view returns (Agent memory);
}
