// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title IAgentRegistry
/// @notice Canonical agent identity registry for AlphaGrid.
/// @dev Role model (may be the same wallet or distinct addresses):
///      - `owner` — controls the AlphaGrid mandate (metadata, signer, payout recipient, ownership transfer).
///      - `signer` — runtime execution key (e.g. trade intents / EIP-712); not used for mandate admin.
///      - `payoutRecipient` — receives builder profit share from protocol payout modules.
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
        /// @dev Reserved: created but not yet entered into a vault track (unused in MVP registration).
        Draft,
        /// @dev Default at registration; agent may open positions and compete on its current track.
        Active,
        /// @dev Temporary operator pause; exits and force-close remain allowed, new opens blocked.
        Suspended,
        /// @dev Terminal: failed track rules or risk policy; releases allocation cap via AllocationManager.
        Failed,
        /// @dev Terminal: completed the program successfully; releases allocation cap (distinct from track promotion).
        Graduated,
        /// @dev Terminal: voluntary or administrative removal; releases allocation cap.
        Exited
    }

    /// @notice On-chain agent record.
    struct Agent {
        /// @notice Controls this AlphaGrid agent account (mandate admin).
        address owner;
        /// @notice Runtime / execution signer for trading flows.
        address signer;
        /// @notice Receives builder performance-fee payouts.
        address payoutRecipient;
        address vault;
        Track track;
        AgentStatus status;
        string name;
        string metadataURI;
        uint64 createdAt;
        /// @notice Whether a portable ERC-8004 identity is linked (id may be 0 per implementation).
        bool hasERC8004Identity;
        /// @notice ERC-8004 identity token id when `hasERC8004Identity` is true.
        uint256 erc8004AgentId;
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

    event AgentOwnershipTransferred(uint256 indexed agentId, address indexed from, address indexed to);

    event PayoutRecipientUpdated(uint256 indexed agentId, address indexed payoutRecipient);

    event AgentPromoted(uint256 indexed agentId, address indexed vault, Track fromTrack, Track toTrack);

    event ERC8004IdentityLinked(
        uint256 indexed agentId,
        address indexed erc8004IdentityRegistry,
        uint256 erc8004ChainId,
        uint256 erc8004AgentId,
        address indexed owner
    );

    event FeeManagerUpdated(address indexed feeManager);

    event VaultTrackRegistryUpdated(address indexed vaultTrackRegistry);

    event AllocationManagerUpdated(address indexed allocationManager);

    // -------------------------------------------------------------------------
    // Registration
    // -------------------------------------------------------------------------

    /// @notice Register an agent on behalf of `owner`.
    /// @param linkERC8004 When true, links `erc8004AgentId` (may be 0); requires configured Identity Registry.
    function registerAgent(
        address owner,
        address vault,
        string calldata name,
        string calldata metadataURI,
        address signer,
        bool linkERC8004,
        uint256 erc8004AgentId
    ) external returns (uint256 agentId);

    /// @notice Self-register an agent using an EIP-712 signature from `signer`.
    function selfRegisterAgent(
        address vault,
        string calldata name,
        string calldata metadataURI,
        address signer,
        bool linkERC8004,
        uint256 erc8004AgentId,
        uint256 deadline,
        bytes calldata signature
    ) external returns (uint256 agentId);

    // -------------------------------------------------------------------------
    // Agent Management
    // -------------------------------------------------------------------------

    /// @notice Update agent metadata. Callable by the agent owner or `REGISTRAR_ROLE` when not suspended.
    function updateAgentMetadata(uint256 agentId, string calldata metadataURI) external;

    /// @notice Link a portable ERC-8004 identity to an agent. Callable by the mandate owner or `REGISTRAR_ROLE`; owner must hold the NFT.
    function linkERC8004Identity(uint256 agentId, uint256 erc8004AgentId) external;

    /// @notice Update the agent signer. Callable by the agent owner.
    function setAgentSigner(uint256 agentId, address signer) external;

    /// @notice Transfer mandate ownership. Callable by the current owner.
    function transferAgentOwnership(uint256 agentId, address newOwner) external;

    /// @notice Set the address that receives builder performance fees. Callable by the agent owner.
    function setPayoutRecipient(uint256 agentId, address payoutRecipient) external;

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

    function payoutRecipientOf(uint256 agentId) external view returns (address);

    /// @notice Reverse lookup: ERC-8004 identity token id → AlphaGrid agent id (0 if not linked).
    function agentIdByERC8004(uint256 erc8004AgentId) external view returns (uint256 agentId);

    /// @notice Reverse lookup: ERC-8004 identity token id → full agent record.
    function getAgentByERC8004(uint256 erc8004AgentId) external view returns (Agent memory);

    function hasERC8004Identity(uint256 agentId) external view returns (bool);

    /// @notice True when the agent owner currently holds the linked ERC-8004 identity NFT.
    function isERC8004OwnerCurrent(uint256 agentId) external view returns (bool);

    /// @notice True when agent may accrue builder performance fees (Active on Funded or Prime).
    function isPayoutEligible(uint256 agentId) external view returns (bool);

    function getAgent(uint256 agentId) external view returns (Agent memory);

    function erc8004IdentityRegistry() external view returns (address);

    function erc8004ChainId() external view returns (uint256);
}
