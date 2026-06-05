// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Nonces } from "@openzeppelin/contracts/utils/Nonces.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { IERC721 } from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import { IAgentRegistry } from "../interfaces/IAgentRegistry.sol";
import { IAllocationManager } from "../interfaces/IAllocationManager.sol";
import { IFeeManager } from "../interfaces/IFeeManager.sol";
import { IVaultTrackRegistry } from "../interfaces/IVaultTrackRegistry.sol";

/// @title AgentRegistry
/// @notice Stores canonical agent identities, vault bindings, and track lifecycle state.
/// @dev `owner` controls the AlphaGrid agent and must own the ERC-8004 NFT when linked.
contract AgentRegistry is IAgentRegistry, AccessControl, EIP712, Nonces, Pausable {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    bytes32 public constant SELF_REGISTER_TYPEHASH = keccak256(
        "SelfRegister(address vault,string name,string metadataURI,address signer,bool linkERC8004,uint256 erc8004AgentId,uint256 nonce,uint256 deadline)"
    );

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    IFeeManager public feeManager;
    IVaultTrackRegistry public vaultTrackRegistry;
    IAllocationManager public allocationManager;

    address private immutable ERC8004_IDENTITY_REGISTRY;
    uint256 private immutable ERC8004_CHAIN_ID;

    uint256 private _nextAgentId = 1;

    mapping(uint256 agentId => Agent agent) private _agents;
    mapping(uint256 erc8004AgentId => uint256 agentId) private _agentIdByErc8004;

    struct AgentRegistrationInput {
        address owner;
        address vault;
        string name;
        string metadataURI;
        address signer;
        bool linkERC8004;
        uint256 erc8004AgentId;
        address payer;
    }

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error VaultTrackRegistryNotSet();
    error VaultNotApproved(address vault);
    error AgentNotFound(uint256 agentId);
    error NotAgentOwner(uint256 agentId, address caller);
    error InvalidPromotion(uint256 agentId, Track fromTrack, Track toTrack);
    error InvalidSignature();
    error MetadataUpdateNotAllowed(uint256 agentId);
    error ExpiredDeadline();
    error EmptyName();
    error InvalidERC8004Config();
    error NotERC8004Owner(uint256 erc8004AgentId, address caller);
    error ERC8004AlreadyLinked(uint256 agentId);
    error ERC8004AlreadyRegistered(uint256 erc8004AgentId);
    error ERC8004NotRegistered(uint256 erc8004AgentId);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param admin Receives `DEFAULT_ADMIN_ROLE`.
    /// @param feeManager_ Fee collector invoked during registration.
    /// @param erc8004IdentityRegistry_ ERC-8004 Identity Registry (ERC-721).
    /// @param erc8004ChainId_ Chain id for linked ERC-8004 identities.
    constructor(address admin, IFeeManager feeManager_, address erc8004IdentityRegistry_, uint256 erc8004ChainId_)
        EIP712("AlphaGrid AgentRegistry", "1")
    {
        if (admin == address(0) || address(feeManager_) == address(0)) revert ZeroAddress();
        if (erc8004IdentityRegistry_ == address(0) || erc8004ChainId_ == 0) revert InvalidERC8004Config();

        feeManager = feeManager_;
        ERC8004_IDENTITY_REGISTRY = erc8004IdentityRegistry_;
        ERC8004_CHAIN_ID = erc8004ChainId_;

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
        address signer,
        bool linkERC8004,
        uint256 erc8004AgentId
    ) external onlyRole(REGISTRAR_ROLE) whenNotPaused returns (uint256 agentId) {
        agentId = _registerAgent(
            AgentRegistrationInput({
                owner: owner,
                vault: vault,
                name: name,
                metadataURI: metadataURI,
                signer: signer,
                linkERC8004: linkERC8004,
                erc8004AgentId: erc8004AgentId,
                payer: msg.sender
            }),
            true
        );
    }

    /// @inheritdoc IAgentRegistry
    function selfRegisterAgent(
        address vault,
        string calldata name,
        string calldata metadataURI,
        address signer,
        bool linkERC8004,
        uint256 erc8004AgentId,
        uint256 deadline,
        bytes calldata signature
    ) external whenNotPaused returns (uint256 agentId) {
        agentId = _selfRegisterAgent(vault, name, metadataURI, signer, linkERC8004, erc8004AgentId, deadline, signature);
    }

    // -------------------------------------------------------------------------
    // Agent Management
    // -------------------------------------------------------------------------

    /// @inheritdoc IAgentRegistry
    function linkERC8004Identity(uint256 agentId, uint256 erc8004AgentId) external whenNotPaused {
        _requireAgentExists(agentId);
        _requireAgentOwnerOrRegistrar(agentId);
        _applyErc8004Link(agentId, erc8004AgentId);
    }

    /// @inheritdoc IAgentRegistry
    function erc8004IdentityRegistry() external view returns (address) {
        return ERC8004_IDENTITY_REGISTRY;
    }

    /// @inheritdoc IAgentRegistry
    function erc8004ChainId() external view returns (uint256) {
        return ERC8004_CHAIN_ID;
    }

    /// @inheritdoc IAgentRegistry
    function updateAgentMetadata(uint256 agentId, string calldata metadataURI) external whenNotPaused {
        Agent storage agent = _requireAgentExists(agentId);
        _requireAgentOwnerOrRegistrar(agentId);
        if (agent.status == AgentStatus.Suspended) revert MetadataUpdateNotAllowed(agentId);

        agent.metadataURI = metadataURI;
        emit AgentMetadataUpdated(agentId, metadataURI);
    }

    /// @inheritdoc IAgentRegistry
    function setAgentSigner(uint256 agentId, address signer) external whenNotPaused {
        if (signer == address(0)) revert ZeroAddress();

        Agent storage agent = _requireAgentExists(agentId);
        if (msg.sender != agent.owner) revert NotAgentOwner(agentId, msg.sender);

        agent.signer = signer;
        emit AgentSignerUpdated(agentId, signer);
    }

    /// @inheritdoc IAgentRegistry
    function transferAgentOwnership(uint256 agentId, address newOwner) external whenNotPaused {
        if (newOwner == address(0)) revert ZeroAddress();

        Agent storage agent = _requireAgentExists(agentId);
        address from = agent.owner;
        if (msg.sender != from) revert NotAgentOwner(agentId, msg.sender);

        agent.owner = newOwner;
        emit AgentOwnershipTransferred(agentId, from, newOwner);
    }

    /// @inheritdoc IAgentRegistry
    function setPayoutRecipient(uint256 agentId, address payoutRecipient) external whenNotPaused {
        if (payoutRecipient == address(0)) revert ZeroAddress();

        Agent storage agent = _requireAgentExists(agentId);
        if (msg.sender != agent.owner) revert NotAgentOwner(agentId, msg.sender);

        agent.payoutRecipient = payoutRecipient;
        emit PayoutRecipientUpdated(agentId, payoutRecipient);
    }

    /// @inheritdoc IAgentRegistry
    function setAgentStatus(uint256 agentId, AgentStatus status) external onlyRole(OPERATOR_ROLE) {
        Agent storage agent = _requireAgentExists(agentId);
        AgentStatus oldStatus = agent.status;
        agent.status = status;
        emit AgentStatusChanged(agentId, oldStatus, status);

        if (address(allocationManager) != address(0) && _isTerminalAgentStatus(status)) {
            allocationManager.onAgentRemoved(agentId);
        }
    }

    /// @inheritdoc IAgentRegistry
    function promoteAgent(uint256 agentId, Track targetTrack) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        Agent storage agent = _requireAgentExists(agentId);

        Track fromTrack = agent.track;
        if (uint256(targetTrack) != uint256(fromTrack) + 1 || uint256(targetTrack) > uint256(Track.PRIME)) {
            revert InvalidPromotion(agentId, fromTrack, targetTrack);
        }

        feeManager.payPromotionFee(msg.sender, agentId, agent.vault, uint256(fromTrack), uint256(targetTrack));

        if (address(allocationManager) != address(0)) {
            allocationManager.onAgentPromoted(agentId, agent.vault, uint256(fromTrack), uint256(targetTrack));
        }

        agent.track = targetTrack;
        emit AgentPromoted(agentId, agent.vault, fromTrack, targetTrack);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @inheritdoc IAgentRegistry
    function ownerOf(uint256 agentId) external view returns (address) {
        return _requireAgentExists(agentId).owner;
    }

    /// @inheritdoc IAgentRegistry
    function vaultOf(uint256 agentId) external view returns (address) {
        return _requireAgentExists(agentId).vault;
    }

    /// @inheritdoc IAgentRegistry
    function trackOf(uint256 agentId) external view returns (Track) {
        return _requireAgentExists(agentId).track;
    }

    /// @inheritdoc IAgentRegistry
    function statusOf(uint256 agentId) external view returns (AgentStatus) {
        return _requireAgentExists(agentId).status;
    }

    /// @inheritdoc IAgentRegistry
    function signerOf(uint256 agentId) external view returns (address) {
        return _requireAgentExists(agentId).signer;
    }

    /// @inheritdoc IAgentRegistry
    function payoutRecipientOf(uint256 agentId) external view returns (address) {
        return _requireAgentExists(agentId).payoutRecipient;
    }

    /// @inheritdoc IAgentRegistry
    function hasERC8004Identity(uint256 agentId) external view returns (bool) {
        return _requireAgentExists(agentId).hasERC8004Identity;
    }

    /// @inheritdoc IAgentRegistry
    function agentIdByERC8004(uint256 erc8004AgentId) external view returns (uint256 agentId) {
        return _agentIdByErc8004[erc8004AgentId];
    }

    /// @inheritdoc IAgentRegistry
    function getAgentByERC8004(uint256 erc8004AgentId) external view returns (Agent memory) {
        uint256 agentId = _agentIdByErc8004[erc8004AgentId];
        if (agentId == 0) revert ERC8004NotRegistered(erc8004AgentId);
        return _requireAgentExists(agentId);
    }

    /// @inheritdoc IAgentRegistry
    function isERC8004OwnerCurrent(uint256 agentId) external view returns (bool) {
        Agent storage agent = _requireAgentExists(agentId);
        if (!agent.hasERC8004Identity) return false;
        return IERC721(ERC8004_IDENTITY_REGISTRY).ownerOf(agent.erc8004AgentId) == agent.owner;
    }

    /// @inheritdoc IAgentRegistry
    function isPayoutEligible(uint256 agentId) external view returns (bool) {
        Agent storage agent = _requireAgentExists(agentId);
        if (agent.status != AgentStatus.Active) return false;
        return agent.track == Track.FUNDED || agent.track == Track.PRIME;
    }

    /// @inheritdoc IAgentRegistry
    function getAgent(uint256 agentId) external view returns (Agent memory) {
        return _requireAgentExists(agentId);
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

    /// @notice Set VaultTrackRegistry for vault approval checks. Required before agent registration.
    function setVaultTrackRegistry(IVaultTrackRegistry vaultTrackRegistry_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        vaultTrackRegistry = vaultTrackRegistry_;
        emit VaultTrackRegistryUpdated(address(vaultTrackRegistry_));
    }

    /// @notice Wire AllocationManager for automatic allocation on register and promote.
    function setAllocationManager(IAllocationManager allocationManager_) external onlyRole(DEFAULT_ADMIN_ROLE) {
        allocationManager = allocationManager_;
        emit AllocationManagerUpdated(address(allocationManager_));
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

    function _verifySelfRegisterSignature(
        address vault,
        string calldata name,
        string calldata metadataURI,
        address signer,
        bool linkERC8004,
        uint256 erc8004AgentId,
        uint256 deadline,
        bytes calldata signature
    ) private {
        if (signer == address(0)) revert ZeroAddress();
        if (block.timestamp > deadline) revert ExpiredDeadline();

        uint256 nonce = nonces(signer);
        bytes32 structHash = keccak256(
            abi.encode(
                SELF_REGISTER_TYPEHASH,
                vault,
                keccak256(bytes(name)),
                keccak256(bytes(metadataURI)),
                signer,
                linkERC8004,
                erc8004AgentId,
                nonce,
                deadline
            )
        );

        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, signature);
        if (recovered != signer) revert InvalidSignature();

        _useCheckedNonce(signer, nonce);
    }

    function _selfRegisterAgent(
        address vault,
        string calldata name,
        string calldata metadataURI,
        address signer,
        bool linkERC8004,
        uint256 erc8004AgentId,
        uint256 deadline,
        bytes calldata signature
    ) private returns (uint256 agentId) {
        _verifySelfRegisterSignature(vault, name, metadataURI, signer, linkERC8004, erc8004AgentId, deadline, signature);

        AgentRegistrationInput memory input;
        input.owner = signer;
        input.vault = vault;
        input.name = name;
        input.metadataURI = metadataURI;
        input.signer = signer;
        input.linkERC8004 = linkERC8004;
        input.erc8004AgentId = erc8004AgentId;
        input.payer = msg.sender;
        agentId = _registerAgent(input, false);
    }

    /// @dev Shared registration path after validation and fee collection.
    function _registerAgent(AgentRegistrationInput memory input, bool skipRegistrationFee)
        private
        returns (uint256 agentId)
    {
        if (input.owner == address(0) || input.vault == address(0) || input.signer == address(0)) {
            revert ZeroAddress();
        }
        if (bytes(input.name).length == 0) revert EmptyName();
        if (!_isVaultApproved(input.vault)) revert VaultNotApproved(input.vault);

        agentId = _nextAgentId++;

        if (!skipRegistrationFee) {
            feeManager.payRegistrationFee(input.payer, agentId);
        }

        _agents[agentId] = Agent({
            owner: input.owner,
            signer: input.signer,
            payoutRecipient: input.owner,
            vault: input.vault,
            track: Track.CHALLENGE,
            status: AgentStatus.Active,
            name: input.name,
            metadataURI: input.metadataURI,
            createdAt: uint64(block.timestamp),
            hasERC8004Identity: false,
            erc8004AgentId: 0
        });

        emit AgentRegistered(agentId, input.vault, input.owner, input.signer, input.metadataURI, Track.CHALLENGE);

        if (input.linkERC8004) {
            _applyErc8004Link(agentId, input.erc8004AgentId);
        }

        if (address(allocationManager) != address(0)) {
            allocationManager.onAgentRegistered(agentId, input.vault, uint256(Track.CHALLENGE));
        }
    }

    function _applyErc8004Link(uint256 agentId, uint256 erc8004AgentId) private {
        Agent storage agent = _requireAgentExists(agentId);
        if (agent.hasERC8004Identity) revert ERC8004AlreadyLinked(agentId);

        address owner = agent.owner;
        if (IERC721(ERC8004_IDENTITY_REGISTRY).ownerOf(erc8004AgentId) != owner) {
            revert NotERC8004Owner(erc8004AgentId, owner);
        }

        uint256 existingAgentId = _agentIdByErc8004[erc8004AgentId];
        if (existingAgentId != 0 && existingAgentId != agentId) revert ERC8004AlreadyRegistered(erc8004AgentId);

        _agentIdByErc8004[erc8004AgentId] = agentId;
        agent.hasERC8004Identity = true;
        agent.erc8004AgentId = erc8004AgentId;

        emit ERC8004IdentityLinked(agentId, ERC8004_IDENTITY_REGISTRY, ERC8004_CHAIN_ID, erc8004AgentId, owner);
    }

    /// @dev Returns the agent record or reverts if it does not exist.
    function _requireAgentExists(uint256 agentId) private view returns (Agent storage agent) {
        agent = _agents[agentId];
        if (agent.owner == address(0)) revert AgentNotFound(agentId);
    }

    /// @dev Mandate owner or registrar may link ERC-8004 and update metadata.
    function _requireAgentOwnerOrRegistrar(uint256 agentId) private view {
        Agent storage agent = _agents[agentId];
        if (msg.sender != agent.owner && !hasRole(REGISTRAR_ROLE, msg.sender)) {
            revert NotAgentOwner(agentId, msg.sender);
        }
    }

    /// @dev A vault is approved when CHALLENGE track config is active in VaultTrackRegistry.
    function _isVaultApproved(address vault) private view returns (bool) {
        if (address(vaultTrackRegistry) == address(0)) revert VaultTrackRegistryNotSet();
        return vaultTrackRegistry.isVaultTrackActive(vault, uint256(Track.CHALLENGE));
    }

    /// @dev Terminal statuses release allocation cap via AllocationManager.
    function _isTerminalAgentStatus(AgentStatus status) private pure returns (bool) {
        return status == AgentStatus.Failed || status == AgentStatus.Exited || status == AgentStatus.Graduated;
    }
}
