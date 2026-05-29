// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { BaseTest } from "../helpers/BaseTest.sol";
import { AgentRegistry } from "../../src/core/AgentRegistry.sol";
import { TrackConfig } from "../../src/core/TrackConfig.sol";
import { IAgentRegistry } from "../../src/interfaces/IAgentRegistry.sol";
import { ITrackConfig } from "../../src/interfaces/ITrackConfig.sol";
import { MockFeeManager } from "../mocks/MockFeeManager.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";

contract AgentRegistryTest is BaseTest {
    AgentRegistry internal registry;
    MockFeeManager internal feeManager;
    TrackConfig internal trackConfig;

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
        trackConfig = new TrackConfig(deployer);
        registry = new AgentRegistry(deployer, feeManager);
        registry.setTrackConfig(trackConfig);
        registry.grantRole(registry.OPERATOR_ROLE(), operator);
        registry.grantRole(registry.REGISTRAR_ROLE(), operator);
        _setVaultChallengeConfig(vault, true);
        vm.stopPrank();
    }

    function test_RegisterAgent_PaysFeeAndStoresState() public {
        vm.prank(operator);
        uint256 agentId = registry.registerAgent(agentOwner, vault, AGENT_NAME, METADATA_URI, agentSigner);

        assertEq(agentId, 1);
        assertEq(feeManager.paymentCount(), 1);

        (address payer, uint256 paidAgentId) = feeManager.registrationPayments(0);
        assertEq(payer, operator);
        assertEq(paidAgentId, agentId);

        IAgentRegistry.Agent memory agent = registry.getAgent(agentId);
        assertEq(agent.owner, agentOwner);
        assertEq(agent.signer, agentSigner);
        assertEq(agent.vault, vault);
        assertEq(uint256(agent.track), uint256(IAgentRegistry.Track.CHALLENGE));
        assertEq(uint256(agent.status), uint256(IAgentRegistry.AgentStatus.Active));
        assertEq(agent.name, AGENT_NAME);
        assertEq(agent.metadataURI, METADATA_URI);
        assertGt(agent.createdAt, 0);

        assertEq(registry.ownerOf(agentId), agentOwner);
        assertEq(registry.vaultOf(agentId), vault);
        assertEq(uint256(registry.trackOf(agentId)), uint256(IAgentRegistry.Track.CHALLENGE));
        assertEq(uint256(registry.statusOf(agentId)), uint256(IAgentRegistry.AgentStatus.Active));
        assertEq(registry.signerOf(agentId), agentSigner);
        assertEq(registry.nextAgentId(), 2);
    }

    function test_SelfRegisterAgent_WithValidSignature() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = _signSelfRegister(vault, AGENT_NAME, METADATA_URI, agentSigner, 0, deadline);

        vm.prank(agentSigner);
        uint256 agentId = registry.selfRegisterAgent(vault, AGENT_NAME, METADATA_URI, agentSigner, deadline, signature);

        assertEq(agentId, 1);
        assertEq(registry.ownerOf(agentId), agentSigner);
        assertEq(registry.signerOf(agentId), agentSigner);
        (address payer,) = feeManager.registrationPayments(0);
        assertEq(payer, agentSigner);
        assertEq(registry.nonces(agentSigner), 1);
    }

    function test_RevertWhen_SelfRegisterBadSignature() public {
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = _signSelfRegister(vault, AGENT_NAME, METADATA_URI, agentSigner, 0, deadline);

        vm.expectRevert(AgentRegistry.InvalidSignature.selector);
        registry.selfRegisterAgent(vault, AGENT_NAME, METADATA_URI, bob, deadline, signature);
    }

    function test_RevertWhen_SelfRegisterExpiredDeadline() public {
        uint256 deadline = block.timestamp - 1;
        bytes memory signature = _signSelfRegister(vault, AGENT_NAME, METADATA_URI, agentSigner, 0, deadline);

        vm.expectRevert(AgentRegistry.ExpiredDeadline.selector);
        registry.selfRegisterAgent(vault, AGENT_NAME, METADATA_URI, agentSigner, deadline, signature);
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
        registry.registerAgent(agentOwner, unapprovedVault, AGENT_NAME, METADATA_URI, agentSigner);
    }

    function test_RevertWhen_TrackConfigNotSet() public {
        AgentRegistry freshRegistry = new AgentRegistry(deployer, feeManager);

        vm.startPrank(deployer);
        freshRegistry.grantRole(freshRegistry.REGISTRAR_ROLE(), operator);
        vm.stopPrank();

        vm.prank(operator);
        vm.expectRevert(AgentRegistry.TrackConfigNotSet.selector);
        freshRegistry.registerAgent(agentOwner, vault, AGENT_NAME, METADATA_URI, agentSigner);
    }

    function test_RevertWhen_ZeroAddressRegistration() public {
        vm.startPrank(operator);
        vm.expectRevert(AgentRegistry.ZeroAddress.selector);
        registry.registerAgent(address(0), vault, AGENT_NAME, METADATA_URI, agentSigner);

        vm.expectRevert(AgentRegistry.ZeroAddress.selector);
        registry.registerAgent(agentOwner, address(0), AGENT_NAME, METADATA_URI, agentSigner);

        vm.expectRevert(AgentRegistry.ZeroAddress.selector);
        registry.registerAgent(agentOwner, vault, AGENT_NAME, METADATA_URI, address(0));
        vm.stopPrank();
    }

    function test_RevertWhen_EmptyName() public {
        vm.prank(operator);
        vm.expectRevert(AgentRegistry.EmptyName.selector);
        registry.registerAgent(agentOwner, vault, "", METADATA_URI, agentSigner);
    }

    function test_RevertWhen_AgentNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.AgentNotFound.selector, 99));
        registry.ownerOf(99);
    }

    function test_RevertWhen_RegisterWithoutRegistrarRole() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, bob, registry.REGISTRAR_ROLE()
            )
        );
        vm.prank(bob);
        registry.registerAgent(agentOwner, vault, AGENT_NAME, METADATA_URI, agentSigner);
    }

    function test_AdminSetsFeeManager() public {
        MockFeeManager newFeeManager = new MockFeeManager();

        vm.prank(deployer);
        registry.setFeeManager(newFeeManager);

        assertEq(address(registry.feeManager()), address(newFeeManager));
    }

    function test_Pause_BlocksRegistration() public {
        vm.prank(operator);
        registry.pause();

        vm.prank(operator);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        registry.registerAgent(agentOwner, vault, AGENT_NAME, METADATA_URI, agentSigner);

        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = _signSelfRegister(vault, AGENT_NAME, METADATA_URI, agentSigner, 0, deadline);

        vm.prank(agentSigner);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        registry.selfRegisterAgent(vault, AGENT_NAME, METADATA_URI, agentSigner, deadline, signature);
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
        uint256 agentId = registry.registerAgent(agentOwner, vault, AGENT_NAME, METADATA_URI, agentSigner);
        vm.stopPrank();

        assertEq(agentId, 1);
        assertEq(registry.ownerOf(agentId), agentOwner);
    }

    function test_MultipleAgentsIncrementIds() public {
        vm.startPrank(operator);
        uint256 first = registry.registerAgent(agentOwner, vault, "Agent One", METADATA_URI, agentSigner);
        uint256 second = registry.registerAgent(bob, vault, "Agent Two", METADATA_URI, makeAddr("signerTwo"));
        vm.stopPrank();

        assertEq(first, 1);
        assertEq(second, 2);
        assertEq(registry.nextAgentId(), 3);
    }

    function _registerAgent() internal returns (uint256 agentId) {
        vm.prank(operator);
        agentId = registry.registerAgent(agentOwner, vault, AGENT_NAME, METADATA_URI, agentSigner);
    }

    function _setVaultChallengeConfig(address vault_, bool active) internal {
        trackConfig.setVaultTrackConfig(
            vault_,
            0,
            ITrackConfig.VaultTrackConfig({
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
                active: active
            })
        );
    }

    function _signSelfRegister(
        address vault_,
        string memory name,
        string memory metadataURI,
        address signer,
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
