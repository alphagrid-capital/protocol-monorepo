// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { Nonces } from "@openzeppelin/contracts/utils/Nonces.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { IAgentRegistry } from "../interfaces/IAgentRegistry.sol";
import { IFeeManager } from "../interfaces/IFeeManager.sol";
import { ITrackConfig } from "../interfaces/ITrackConfig.sol";

/// @title AgentRegistry
/// @notice Stores canonical agent identities, vault bindings, and track lifecycle state.
contract AgentRegistry is IAgentRegistry, AccessControl, EIP712, Nonces, Pausable {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    bytes32 public constant SELF_REGISTER_TYPEHASH = keccak256(
        "SelfRegister(address vault,string name,string metadataURI,address signer,uint256 nonce,uint256 deadline)"
    );

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IFeeManager public feeManager;
    ITrackConfig public trackConfig;

    uint256 private _nextAgentId = 1;

    mapping(uint256 agentId => Agent agent) private _agents;

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error TrackConfigNotSet();
    error VaultNotApproved(address vault);
    error AgentNotFound(uint256 agentId);
    error NotAgentOwner(uint256 agentId, address caller);
    error InvalidPromotion(uint256 agentId, Track fromTrack, Track toTrack);
    error InvalidSignature();
    error MetadataUpdateNotAllowed(uint256 agentId);
    error ExpiredDeadline();
    error EmptyName();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param admin Receives `DEFAULT_ADMIN_ROLE`.
    /// @param feeManager_ Fee collector invoked during registration.
    constructor(address admin, IFeeManager feeManager_) EIP712("AlphaGrid AgentRegistry", "1") {
        if (admin == address(0) || address(feeManager_) == address(0)) revert ZeroAddress();

        feeManager = feeManager_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Registration
    // -------------------------------------------------------------------------

    /// @inheritdoc IAgentRegistry
    function registerAgent(
        address owner,
        address vault,
        string calldata name,
        string calldata metadataURI,
        address signer
    ) external onlyRole(REGISTRAR_ROLE) whenNotPaused returns (uint256 agentId) {
        agentId = _registerAgent(owner, vault, name, metadataURI, signer, msg.sender);
    }

    /// @inheritdoc IAgentRegistry
    function selfRegisterAgent(
        address vault,
        string calldata name,
        string calldata metadataURI,
        address signer,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused returns (uint256 agentId) {
        if (signer == address(0)) revert ZeroAddress();
        if (block.timestamp > deadline) revert ExpiredDeadline();

        bytes32 structHash = keccak256(
            abi.encode(
                SELF_REGISTER_TYPEHASH,
                vault,
                keccak256(bytes(name)),
                keccak256(bytes(metadataURI)),
                signer,
                nonces(signer),
                deadline
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != signer) revert InvalidSignature();

        _useCheckedNonce(signer, nonces(signer));

        agentId = _registerAgent(signer, vault, name, metadataURI, signer, msg.sender);
    }

    // -------------------------------------------------------------------------
    // Agent Management
    // -------------------------------------------------------------------------

    /// @inheritdoc IAgentRegistry
    function updateAgentMetadata(uint256 agentId, string calldata metadataURI) external whenNotPaused {
        Agent storage agent = _requireAgent(agentId);
        if (msg.sender != agent.owner) revert NotAgentOwner(agentId, msg.sender);
        if (agent.status == AgentStatus.Suspended) revert MetadataUpdateNotAllowed(agentId);

        agent.metadataURI = metadataURI;
        emit AgentMetadataUpdated(agentId, metadataURI);
    }

    /// @inheritdoc IAgentRegistry
    function setAgentSigner(uint256 agentId, address signer) external whenNotPaused {
        if (signer == address(0)) revert ZeroAddress();

        Agent storage agent = _requireAgent(agentId);
        if (msg.sender != agent.owner) revert NotAgentOwner(agentId, msg.sender);

        agent.signer = signer;
        emit AgentSignerUpdated(agentId, signer);
    }

    /// @inheritdoc IAgentRegistry
    function setAgentStatus(uint256 agentId, AgentStatus status) external onlyRole(OPERATOR_ROLE) {
        Agent storage agent = _requireAgent(agentId);
        AgentStatus oldStatus = agent.status;
        agent.status = status;
        emit AgentStatusChanged(agentId, oldStatus, status);
    }

    /// @inheritdoc IAgentRegistry
    function promoteAgent(uint256 agentId, Track targetTrack) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        Agent storage agent = _requireAgent(agentId);

        Track fromTrack = agent.track;
        if (uint256(targetTrack) != uint256(fromTrack) + 1 || uint256(targetTrack) > uint256(Track.PRIME)) {
            revert InvalidPromotion(agentId, fromTrack, targetTrack);
        }

        feeManager.payPromotionFee(msg.sender, agentId, agent.vault, uint256(fromTrack), uint256(targetTrack));

        agent.track = targetTrack;
        emit AgentPromoted(agentId, agent.vault, fromTrack, targetTrack);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @inheritdoc IAgentRegistry
    function ownerOf(uint256 agentId) external view returns (address) {
        return _requireAgent(agentId).owner;
    }

    /// @inheritdoc IAgentRegistry
    function vaultOf(uint256 agentId) external view returns (address) {
        return _requireAgent(agentId).vault;
    }

    /// @inheritdoc IAgentRegistry
    function trackOf(uint256 agentId) external view returns (Track) {
        return _requireAgent(agentId).track;
    }

    /// @inheritdoc IAgentRegistry
    function statusOf(uint256 agentId) external view returns (AgentStatus) {
        return _requireAgent(agentId).status;
    }

    /// @inheritdoc IAgentRegistry
    function signerOf(uint256 agentId) external view returns (address) {
        return _requireAgent(agentId).signer;
    }

    /// @inheritdoc IAgentRegistry
    function getAgent(uint256 agentId) external view returns (Agent memory) {
        return _requireAgent(agentId);
    }

    /// @notice Returns the next agent id that will be assigned.
    function nextAgentId() external view returns (uint256) {
        return _nextAgentId;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Update the fee manager used for registration payments.
    function setFeeManager(IFeeManager feeManager_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (address(feeManager_) == address(0)) revert ZeroAddress();
        feeManager = feeManager_;
        emit FeeManagerUpdated(address(feeManager_));
    }

    /// @notice Set TrackConfig for vault approval checks. Required before agent registration.
    function setTrackConfig(ITrackConfig trackConfig_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        trackConfig = trackConfig_;
        emit TrackConfigUpdated(address(trackConfig_));
    }

    // -------------------------------------------------------------------------
    // Pause
    // -------------------------------------------------------------------------

    /// @notice Pause user/agent state-changing flows. Operator-only emergency stop.
    function pause() external onlyRole(OPERATOR_ROLE) {
        _pause();
    }

    /// @notice Resume user/agent state-changing flows after a global pause.
    function unpause() external onlyRole(OPERATOR_ROLE) {
        _unpause();
    }

    // -------------------------------------------------------------------------
    // Private Functions
    // -------------------------------------------------------------------------

    /// @dev Shared registration path after validation and fee collection.
    function _registerAgent(
        address owner,
        address vault,
        string calldata name,
        string calldata metadataURI,
        address signer,
        address payer
    ) private returns (uint256 agentId) {
        if (owner == address(0) || vault == address(0) || signer == address(0)) {
            revert ZeroAddress();
        }
        if (bytes(name).length == 0) revert EmptyName();
        if (!_isVaultApproved(vault)) revert VaultNotApproved(vault);

        agentId = _nextAgentId++;

        feeManager.payRegistrationFee(payer, agentId);

        _agents[agentId] = Agent({
            owner: owner,
            signer: signer,
            vault: vault,
            track: Track.CHALLENGE,
            status: AgentStatus.Active,
            name: name,
            metadataURI: metadataURI,
            createdAt: uint64(block.timestamp)
        });

        emit AgentRegistered(agentId, vault, owner, signer, metadataURI, Track.CHALLENGE);
    }

    /// @dev Returns the agent record or reverts if it does not exist.
    function _requireAgent(uint256 agentId) private view returns (Agent storage agent) {
        agent = _agents[agentId];
        if (agent.owner == address(0)) revert AgentNotFound(agentId);
    }

    /// @dev A vault is approved when CHALLENGE track config is active in TrackConfig.
    function _isVaultApproved(address vault) private view returns (bool) {
        if (address(trackConfig) == address(0)) revert TrackConfigNotSet();
        return trackConfig.isVaultTrackActive(vault, uint256(Track.CHALLENGE));
    }
}
