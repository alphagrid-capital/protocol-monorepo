// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { AgentRegistry } from "../../src/core/AgentRegistry.sol";
import { VaultTrackRegistry } from "../../src/core/VaultTrackRegistry.sol";
import { IAgentRegistry } from "../../src/interfaces/IAgentRegistry.sol";
import { IVaultTrackRegistry } from "../../src/interfaces/IVaultTrackRegistry.sol";
import { AgentTestLib } from "../helpers/AgentTestLib.sol";
import { BaseTest } from "../helpers/BaseTest.sol";
import { MockERC8004IdentityRegistry } from "../mocks/MockERC8004IdentityRegistry.sol";
import { MockFeeManager } from "../mocks/MockFeeManager.sol";

contract AgentRegistryTest is BaseTest {
    AgentRegistry internal registry;
    MockFeeManager internal feeManager;
    VaultTrackRegistry internal vaultTrackRegistry;
    MockERC8004IdentityRegistry internal identityRegistry;

    address internal operator;
    address internal vault;
    address internal unapprovedVault;
    address internal agentOwner;
    address internal agentSigner;

    uint256 internal constant AGENT_SIGNER_PRIVATE_KEY = 0xA11CE;

    string internal constant AGENT_NAME = "Alpha Bot";
    string internal constant METADATA_URI = "ipfs://alpha-bot";

    function setUp() public override {
        super.setUp();

        operator = makeAddr("operator");
        vault = makeAddr("vault");
        unapprovedVault = makeAddr("unapprovedVault");
        agentOwner = makeAddr("agentOwner");
        agentSigner = vm.addr(AGENT_SIGNER_PRIVATE_KEY);

        feeManager = new MockFeeManager();

        vm.startPrank(deployer);
        vaultTrackRegistry = new VaultTrackRegistry(deployer);
        identityRegistry = AgentTestLib.deployERC8004IdentityRegistry();
        registry = new AgentRegistry(deployer, feeManager, address(identityRegistry), block.chainid);
        registry.setVaultTrackRegistry(vaultTrackRegistry);
        registry.grantRole(registry.OPERATOR_ROLE(), operator);
        registry.grantRole(registry.REGISTRAR_ROLE(), operator);
        _setVaultChallengeConfig(vault, true);
        vm.stopPrank();
    }

    function test_RegisterAgent_PaysFeeAndStoresState() public {
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, agentOwner);

        vm.prank(operator);
        uint256 agentId =
            registry.registerAgent(agentOwner, vault, AGENT_NAME, METADATA_URI, agentSigner, true, erc8004Id);

        assertEq(agentId, 1);
        assertEq(feeManager.paymentCount(), 0);

        IAgentRegistry.Agent memory agent = registry.getAgent(agentId);
        assertEq(agent.owner, agentOwner);
        assertEq(agent.signer, agentSigner);
        assertEq(agent.payoutRecipient, agentOwner);
        assertEq(agent.vault, vault);
        assertEq(uint256(agent.track), uint256(IAgentRegistry.Track.CHALLENGE));
        assertEq(uint256(agent.status), uint256(IAgentRegistry.AgentStatus.Active));
        assertEq(agent.name, AGENT_NAME);
        assertEq(agent.metadataURI, METADATA_URI);
        assertGt(agent.createdAt, 0);
        assertTrue(agent.hasERC8004Identity);
        assertEq(agent.erc8004AgentId, erc8004Id);
        assertTrue(registry.hasERC8004Identity(agentId));
        assertTrue(registry.isERC8004OwnerCurrent(agentId));
        assertEq(registry.agentIdByERC8004(erc8004Id), agentId);
        IAgentRegistry.Agent memory byErc8004 = registry.getAgentByERC8004(erc8004Id);
        assertEq(byErc8004.owner, agent.owner);
        assertEq(byErc8004.vault, agent.vault);
        assertEq(byErc8004.erc8004AgentId, erc8004Id);
        assertEq(registry.payoutRecipientOf(agentId), agentOwner);
        assertFalse(registry.isPayoutEligible(agentId));

        assertEq(registry.ownerOf(agentId), agentOwner);
        assertEq(registry.vaultOf(agentId), vault);
        assertEq(uint256(registry.trackOf(agentId)), uint256(IAgentRegistry.Track.CHALLENGE));
        assertEq(uint256(registry.statusOf(agentId)), uint256(IAgentRegistry.AgentStatus.Active));
        assertEq(registry.signerOf(agentId), agentSigner);
        assertEq(registry.nextAgentId(), 2);
    }

    function test_SelfRegisterAgent_WithValidSignature() public {
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, agentSigner);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature =
            _signSelfRegister(vault, AGENT_NAME, METADATA_URI, agentSigner, true, erc8004Id, 0, deadline);

        vm.prank(agentSigner);
        uint256 agentId = registry.selfRegisterAgent(
            vault, AGENT_NAME, METADATA_URI, agentSigner, true, erc8004Id, deadline, signature
        );

        assertEq(agentId, 1);
        assertEq(registry.ownerOf(agentId), agentSigner);
        assertEq(registry.signerOf(agentId), agentSigner);
        (address payer,) = feeManager.registrationPayments(0);
        assertEq(payer, agentSigner);
        assertEq(registry.nonces(agentSigner), 1);
    }

    function test_RevertWhen_SelfRegisterBadSignature() public {
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, agentSigner);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature =
            _signSelfRegister(vault, AGENT_NAME, METADATA_URI, agentSigner, false, erc8004Id, 0, deadline);

        vm.expectRevert(AgentRegistry.InvalidSignature.selector);
        registry.selfRegisterAgent(vault, AGENT_NAME, METADATA_URI, bob, false, erc8004Id, deadline, signature);
    }

    function test_RevertWhen_SelfRegisterExpiredDeadline() public {
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, agentSigner);
        uint256 deadline = block.timestamp - 1;
        bytes memory signature =
            _signSelfRegister(vault, AGENT_NAME, METADATA_URI, agentSigner, false, erc8004Id, 0, deadline);

        vm.expectRevert(AgentRegistry.ExpiredDeadline.selector);
        registry.selfRegisterAgent(vault, AGENT_NAME, METADATA_URI, agentSigner, false, erc8004Id, deadline, signature);
    }

    function test_ERC8004ChainId_IsImmutableFromConstructor() public view {
        assertEq(registry.erc8004ChainId(), block.chainid);
    }

    function test_RegisterEmitsERC8004IdentityLinked() public {
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, agentOwner);

        vm.expectEmit(true, true, false, true);
        emit IAgentRegistry.ERC8004IdentityLinked(1, address(identityRegistry), block.chainid, erc8004Id, agentOwner);

        vm.prank(operator);
        registry.registerAgent(agentOwner, vault, AGENT_NAME, METADATA_URI, agentSigner, true, erc8004Id);
    }

    function test_RevertWhen_InvalidERC8004Config() public {
        vm.expectRevert(AgentRegistry.InvalidERC8004Config.selector);
        new AgentRegistry(deployer, feeManager, address(0), 0);

        vm.expectRevert(AgentRegistry.InvalidERC8004Config.selector);
        new AgentRegistry(deployer, feeManager, address(identityRegistry), 0);

        vm.expectRevert(AgentRegistry.InvalidERC8004Config.selector);
        new AgentRegistry(deployer, feeManager, address(0), block.chainid);
    }

    function test_RevertWhen_ERC8004AlreadyRegistered() public {
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, agentOwner);
        _registerAgentWithErc8004(erc8004Id);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.ERC8004AlreadyRegistered.selector, erc8004Id));
        registry.registerAgent(agentOwner, vault, "Other", METADATA_URI, agentSigner, true, erc8004Id);
    }

    function test_RevertWhen_NotERC8004OwnerOnRegister() public {
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, bob);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.NotERC8004Owner.selector, erc8004Id, agentOwner));
        registry.registerAgent(agentOwner, vault, AGENT_NAME, METADATA_URI, agentSigner, true, erc8004Id);
    }

    function test_RegisterWithoutERC8004Link() public {
        vm.prank(operator);
        uint256 agentId = registry.registerAgent(agentOwner, vault, AGENT_NAME, METADATA_URI, agentSigner, false, 0);

        assertFalse(registry.hasERC8004Identity(agentId));
        assertEq(registry.getAgent(agentId).erc8004AgentId, 0);
    }

    function test_LinkERC8004IdentityAfterRegister() public {
        uint256 agentId = _registerAgentWithoutErc8004();
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, agentOwner);

        vm.prank(agentOwner);
        registry.linkERC8004Identity(agentId, erc8004Id);

        assertTrue(registry.hasERC8004Identity(agentId));
        assertEq(registry.getAgent(agentId).erc8004AgentId, erc8004Id);
        assertTrue(registry.isERC8004OwnerCurrent(agentId));
    }

    function test_RegistrarCanLinkERC8004WhenOwnerHoldsNFT() public {
        uint256 agentId = _registerAgentWithoutErc8004();
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, agentOwner);

        vm.prank(operator);
        registry.linkERC8004Identity(agentId, erc8004Id);

        assertTrue(registry.hasERC8004Identity(agentId));
        assertEq(registry.getAgent(agentId).erc8004AgentId, erc8004Id);
    }

    function test_RegistrarCanUpdateMetadata() public {
        uint256 agentId = _registerAgent();
        string memory updated = "ipfs://registrar-updated";

        vm.prank(operator);
        registry.updateAgentMetadata(agentId, updated);

        assertEq(registry.getAgent(agentId).metadataURI, updated);
    }

    function test_RegistrarCannotUpdateMetadataWhenSuspended() public {
        uint256 agentId = _registerAgent();

        vm.prank(operator);
        registry.setAgentStatus(agentId, IAgentRegistry.AgentStatus.Suspended);

        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.MetadataUpdateNotAllowed.selector, agentId));
        registry.updateAgentMetadata(agentId, "ipfs://blocked");
    }

    function test_IsERC8004OwnerCurrent_FalseWhenNotLinked() public {
        uint256 agentId = _registerAgentWithoutErc8004();
        assertFalse(registry.isERC8004OwnerCurrent(agentId));
    }

    function test_IsERC8004OwnerCurrent_FalseAfterNftTransfer() public {
        uint256 agentId = _registerAgent();
        uint256 erc8004Id = registry.getAgent(agentId).erc8004AgentId;

        vm.prank(agentOwner);
        identityRegistry.transferFrom(agentOwner, bob, erc8004Id);

        assertFalse(registry.isERC8004OwnerCurrent(agentId));
    }

    function test_RevertWhen_NonOwnerLinksERC8004() public {
        uint256 agentId = _registerAgentWithoutErc8004();
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, bob);

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.NotAgentOwner.selector, agentId, bob));
        registry.linkERC8004Identity(agentId, erc8004Id);
    }

    function test_RevertWhen_MandateOwnerLinksWithoutHoldingNFT() public {
        uint256 agentId = _registerAgentWithoutErc8004();
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, bob);

        vm.prank(agentOwner);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.NotERC8004Owner.selector, erc8004Id, agentOwner));
        registry.linkERC8004Identity(agentId, erc8004Id);
    }

    function test_LinkERC8004WithZeroAgentId() public {
        uint256 agentId = _registerAgentWithoutErc8004();
        identityRegistry.mintWithId(agentOwner, 0);

        vm.prank(agentOwner);
        registry.linkERC8004Identity(agentId, 0);

        assertTrue(registry.hasERC8004Identity(agentId));
        assertEq(registry.getAgent(agentId).erc8004AgentId, 0);
        assertTrue(registry.isERC8004OwnerCurrent(agentId));
    }

    function test_RevertWhen_ERC8004AlreadyLinkedOnSecondLink() public {
        uint256 agentId = _registerAgent();
        uint256 otherId = AgentTestLib.mintERC8004(identityRegistry, agentOwner);

        vm.prank(agentOwner);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.ERC8004AlreadyLinked.selector, agentId));
        registry.linkERC8004Identity(agentId, otherId);
    }

    function test_TransferAgentOwnership() public {
        uint256 agentId = _registerAgent();
        address newOwner = makeAddr("newOwner");

        vm.prank(agentOwner);
        registry.transferAgentOwnership(agentId, newOwner);

        assertEq(registry.ownerOf(agentId), newOwner);
        assertEq(registry.payoutRecipientOf(agentId), agentOwner);
    }

    function test_OwnerSetsPayoutRecipient() public {
        uint256 agentId = _registerAgent();
        address payee = makeAddr("payee");

        vm.prank(agentOwner);
        registry.setPayoutRecipient(agentId, payee);

        assertEq(registry.payoutRecipientOf(agentId), payee);
    }

    function test_IsPayoutEligible_OnFundedAndPrime() public {
        uint256 agentId = _registerAgent();
        assertFalse(registry.isPayoutEligible(agentId));

        vm.startPrank(operator);
        registry.promoteAgent(agentId, IAgentRegistry.Track.FUNDED);
        assertTrue(registry.isPayoutEligible(agentId));

        registry.promoteAgent(agentId, IAgentRegistry.Track.PRIME);
        assertTrue(registry.isPayoutEligible(agentId));
        vm.stopPrank();
    }

    function test_IsPayoutEligible_FalseWhenSuspended() public {
        uint256 agentId = _registerAgent();

        vm.startPrank(operator);
        registry.promoteAgent(agentId, IAgentRegistry.Track.FUNDED);
        registry.setAgentStatus(agentId, IAgentRegistry.AgentStatus.Suspended);
        vm.stopPrank();

        assertFalse(registry.isPayoutEligible(agentId));
    }

    function test_OwnerUpdatesMetadata() public {
        uint256 agentId = _registerAgent();

        string memory updated = "ipfs://updated";
        vm.prank(agentOwner);
        registry.updateAgentMetadata(agentId, updated);

        assertEq(registry.getAgent(agentId).metadataURI, updated);
    }

    function test_RevertWhen_SuspendedOwnerUpdatesMetadata() public {
        uint256 agentId = _registerAgent();

        vm.prank(operator);
        registry.setAgentStatus(agentId, IAgentRegistry.AgentStatus.Suspended);

        vm.prank(agentOwner);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.MetadataUpdateNotAllowed.selector, agentId));
        registry.updateAgentMetadata(agentId, "ipfs://blocked");
    }

    function test_OwnerUpdatesSigner() public {
        uint256 agentId = _registerAgent();
        address newSigner = makeAddr("newSigner");

        vm.prank(agentOwner);
        registry.setAgentSigner(agentId, newSigner);

        assertEq(registry.signerOf(agentId), newSigner);
    }

    function test_RevertWhen_NonOwnerUpdatesSigner() public {
        uint256 agentId = _registerAgent();

        vm.prank(bob);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.NotAgentOwner.selector, agentId, bob));
        registry.setAgentSigner(agentId, makeAddr("newSigner"));
    }

    function test_OperatorSetsStatus() public {
        uint256 agentId = _registerAgent();

        vm.prank(operator);
        registry.setAgentStatus(agentId, IAgentRegistry.AgentStatus.Suspended);
        assertEq(uint256(registry.statusOf(agentId)), uint256(IAgentRegistry.AgentStatus.Suspended));

        vm.prank(operator);
        registry.setAgentStatus(agentId, IAgentRegistry.AgentStatus.Failed);
        assertEq(uint256(registry.statusOf(agentId)), uint256(IAgentRegistry.AgentStatus.Failed));
    }

    function test_PromoteChallengeToFundedToPrime() public {
        uint256 agentId = _registerAgent();

        vm.startPrank(operator);
        registry.promoteAgent(agentId, IAgentRegistry.Track.FUNDED);
        assertEq(uint256(registry.trackOf(agentId)), uint256(IAgentRegistry.Track.FUNDED));
        assertEq(feeManager.promotionPaymentCount(), 1);

        registry.promoteAgent(agentId, IAgentRegistry.Track.PRIME);
        assertEq(uint256(registry.trackOf(agentId)), uint256(IAgentRegistry.Track.PRIME));
        assertEq(feeManager.promotionPaymentCount(), 2);
        vm.stopPrank();
    }

    function test_RevertWhen_PromoteSkipTrack() public {
        uint256 agentId = _registerAgent();

        vm.prank(operator);
        vm.expectRevert(
            abi.encodeWithSelector(
                AgentRegistry.InvalidPromotion.selector,
                agentId,
                IAgentRegistry.Track.CHALLENGE,
                IAgentRegistry.Track.PRIME
            )
        );
        registry.promoteAgent(agentId, IAgentRegistry.Track.PRIME);
    }

    function test_RevertWhen_PromoteDemotion() public {
        uint256 agentId = _registerAgent();

        vm.startPrank(operator);
        registry.promoteAgent(agentId, IAgentRegistry.Track.FUNDED);

        vm.expectRevert(
            abi.encodeWithSelector(
                AgentRegistry.InvalidPromotion.selector,
                agentId,
                IAgentRegistry.Track.FUNDED,
                IAgentRegistry.Track.CHALLENGE
            )
        );
        registry.promoteAgent(agentId, IAgentRegistry.Track.CHALLENGE);
        vm.stopPrank();
    }

    function test_RevertWhen_PromoteWrongRole() public {
        uint256 agentId = _registerAgent();

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, bob, registry.OPERATOR_ROLE()
            )
        );
        vm.prank(bob);
        registry.promoteAgent(agentId, IAgentRegistry.Track.FUNDED);
    }

    function test_RevertWhen_UnapprovedVault() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.VaultNotApproved.selector, unapprovedVault));
        registry.registerAgent(agentOwner, unapprovedVault, AGENT_NAME, METADATA_URI, agentSigner, false, 0);
    }

    function test_RevertWhen_VaultTrackRegistryNotSet() public {
        AgentRegistry freshRegistry = new AgentRegistry(deployer, feeManager, address(identityRegistry), block.chainid);
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, agentOwner);

        vm.startPrank(deployer);
        freshRegistry.grantRole(freshRegistry.REGISTRAR_ROLE(), operator);
        vm.stopPrank();

        vm.prank(operator);
        vm.expectRevert(AgentRegistry.VaultTrackRegistryNotSet.selector);
        freshRegistry.registerAgent(agentOwner, vault, AGENT_NAME, METADATA_URI, agentSigner, true, erc8004Id);
    }

    function test_RevertWhen_ZeroAddressRegistration() public {
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, agentOwner);

        vm.startPrank(operator);
        vm.expectRevert(AgentRegistry.ZeroAddress.selector);
        registry.registerAgent(address(0), vault, AGENT_NAME, METADATA_URI, agentSigner, true, erc8004Id);

        vm.expectRevert(AgentRegistry.ZeroAddress.selector);
        registry.registerAgent(agentOwner, address(0), AGENT_NAME, METADATA_URI, agentSigner, true, erc8004Id);

        vm.expectRevert(AgentRegistry.ZeroAddress.selector);
        registry.registerAgent(agentOwner, vault, AGENT_NAME, METADATA_URI, address(0), true, erc8004Id);
        vm.stopPrank();
    }

    function test_RevertWhen_EmptyName() public {
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, agentOwner);

        vm.prank(operator);
        vm.expectRevert(AgentRegistry.EmptyName.selector);
        registry.registerAgent(agentOwner, vault, "", METADATA_URI, agentSigner, true, erc8004Id);
    }

    function test_RevertWhen_AgentNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.AgentNotFound.selector, 99));
        registry.ownerOf(99);
    }

    function test_RevertWhen_GetAgentByERC8004NotRegistered() public {
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.ERC8004NotRegistered.selector, 42));
        registry.getAgentByERC8004(42);
    }

    function test_RevertWhen_RegisterWithoutRegistrarRole() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, bob, registry.REGISTRAR_ROLE()
            )
        );
        vm.prank(bob);
        registry.registerAgent(agentOwner, vault, AGENT_NAME, METADATA_URI, agentSigner, false, 0);
    }

    function test_AdminSetsFeeManager() public {
        MockFeeManager newFeeManager = new MockFeeManager();

        vm.prank(deployer);
        registry.setFeeManager(newFeeManager);

        assertEq(address(registry.feeManager()), address(newFeeManager));
    }

    function test_Pause_BlocksRegistration() public {
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, agentOwner);

        vm.prank(operator);
        registry.pause();

        vm.prank(operator);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        registry.registerAgent(agentOwner, vault, AGENT_NAME, METADATA_URI, agentSigner, true, erc8004Id);

        uint256 selfErc8004Id = AgentTestLib.mintERC8004(identityRegistry, agentSigner);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature =
            _signSelfRegister(vault, AGENT_NAME, METADATA_URI, agentSigner, false, selfErc8004Id, 0, deadline);

        vm.prank(agentSigner);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        registry.selfRegisterAgent(
            vault, AGENT_NAME, METADATA_URI, agentSigner, false, selfErc8004Id, deadline, signature
        );
    }

    function test_Pause_UnpauseByOperator() public {
        assertFalse(registry.paused());

        vm.prank(operator);
        registry.pause();
        assertTrue(registry.paused());

        vm.prank(operator);
        registry.unpause();
        assertFalse(registry.paused());
    }

    function test_Pause_RevertWhenNotOperator() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, bob, registry.OPERATOR_ROLE()
            )
        );
        vm.prank(bob);
        registry.pause();

        vm.prank(operator);
        registry.pause();

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, bob, registry.OPERATOR_ROLE()
            )
        );
        vm.prank(bob);
        registry.unpause();
    }

    function test_Unpause_RestoresRegistration() public {
        vm.startPrank(operator);
        registry.pause();
        registry.unpause();
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, agentOwner);
        uint256 agentId =
            registry.registerAgent(agentOwner, vault, AGENT_NAME, METADATA_URI, agentSigner, true, erc8004Id);
        vm.stopPrank();

        assertEq(agentId, 1);
        assertEq(registry.ownerOf(agentId), agentOwner);
    }

    function test_MultipleAgentsIncrementIds() public {
        uint256 erc8004One = AgentTestLib.mintERC8004(identityRegistry, agentOwner);
        uint256 erc8004Two = AgentTestLib.mintERC8004(identityRegistry, bob);

        vm.startPrank(operator);
        uint256 first =
            registry.registerAgent(agentOwner, vault, "Agent One", METADATA_URI, agentSigner, true, erc8004One);
        uint256 second =
            registry.registerAgent(bob, vault, "Agent Two", METADATA_URI, makeAddr("signerTwo"), true, erc8004Two);
        vm.stopPrank();

        assertEq(first, 1);
        assertEq(second, 2);
        assertEq(registry.nextAgentId(), 3);
    }

    function _registerAgent() internal returns (uint256 agentId) {
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, agentOwner);
        return _registerAgentWithErc8004(erc8004Id);
    }

    function _registerAgentWithErc8004(uint256 erc8004Id) internal returns (uint256 agentId) {
        vm.prank(operator);
        agentId = registry.registerAgent(agentOwner, vault, AGENT_NAME, METADATA_URI, agentSigner, true, erc8004Id);
    }

    function _registerAgentWithoutErc8004() internal returns (uint256 agentId) {
        vm.prank(operator);
        agentId = registry.registerAgent(agentOwner, vault, AGENT_NAME, METADATA_URI, agentSigner, false, 0);
    }

    function _setVaultChallengeConfig(address vault_, bool active) internal {
        vaultTrackRegistry.setVaultTrackConfig(
            vault_,
            0,
            IVaultTrackRegistry.VaultTrackConfig({
                vault: vault_,
                trackId: 0,
                initialAllocation: 10_000e6,
                maxAllocation: 25_000e6,
                maxDrawdownBps: 1500,
                maxTradeSizeBps: 500,
                maxDailyTurnoverBps: 2500,
                evaluationPeriod: 14 days,
                minTrades: 5,
                promotionScore: 70,
                active: active,
                maxStopLossBps: 1500,
                minTakeProfitBps: 0,
                maxTakeProfitBps: 10_000,
                requireStopLoss: true,
                requireTakeProfit: false
            })
        );
    }

    function _signSelfRegister(
        address vault_,
        string memory name,
        string memory metadataURI,
        address signer,
        bool linkERC8004,
        uint256 erc8004AgentId,
        uint256 nonce,
        uint256 deadline
    ) internal view returns (bytes memory signature) {
        bytes32 structHash = keccak256(
            abi.encode(
                registry.SELF_REGISTER_TYPEHASH(),
                vault_,
                keccak256(bytes(name)),
                keccak256(bytes(metadataURI)),
                signer,
                linkERC8004,
                erc8004AgentId,
                nonce,
                deadline
            )
        );

        bytes32 digest = MessageHashUtils.toTypedDataHash(_domainSeparator(), structHash);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(AGENT_SIGNER_PRIVATE_KEY, digest);
        signature = abi.encodePacked(r, s, v);
    }

    function _domainSeparator() internal view returns (bytes32) {
        (,, string memory version, uint256 chainId, address verifyingContract,,) = registry.eip712Domain();
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("AlphaGrid AgentRegistry")),
                keccak256(bytes(version)),
                chainId,
                verifyingContract
            )
        );
    }
}
