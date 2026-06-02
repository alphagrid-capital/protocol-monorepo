// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";
import { MessageHashUtils } from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import { AgentRegistry } from "../../src/core/AgentRegistry.sol";
import { FeeManager } from "../../src/core/FeeManager.sol";
import { VaultTrackRegistry } from "../../src/core/VaultTrackRegistry.sol";
import { IAgentRegistry } from "../../src/interfaces/IAgentRegistry.sol";
import { IFeeManager } from "../../src/interfaces/IFeeManager.sol";
import { IVaultTrackRegistry } from "../../src/interfaces/IVaultTrackRegistry.sol";
import { AgentTestLib } from "../helpers/AgentTestLib.sol";
import { BaseTest } from "../helpers/BaseTest.sol";
import { MockERC8004IdentityRegistry } from "../mocks/MockERC8004IdentityRegistry.sol";

contract FeeManagerTest is BaseTest {
    FeeManager internal feeManager;
    AgentRegistry internal registry;
    VaultTrackRegistry internal vaultTrackRegistry;
    MockERC8004IdentityRegistry internal identityRegistry;

    address internal treasury;
    address internal operator;
    address internal vault;

    uint256 internal constant REGISTRATION_FEE = 100e6;
    uint256 internal constant PROMOTION_FEE = 250e6;
    uint256 internal constant AGENT_SIGNER_PRIVATE_KEY = 0xA11CE;

    function setUp() public override {
        super.setUp();

        treasury = makeAddr("treasury");
        operator = makeAddr("operator");
        vault = makeAddr("vault");

        vm.startPrank(deployer);
        feeManager = new FeeManager(deployer, treasury, address(usdc));
        vaultTrackRegistry = new VaultTrackRegistry(deployer);
        identityRegistry = AgentTestLib.deployERC8004IdentityRegistry();
        registry = new AgentRegistry(deployer, feeManager, address(identityRegistry), block.chainid);
        feeManager.setAgentRegistry(address(registry));
        registry.setVaultTrackRegistry(vaultTrackRegistry);
        registry.grantRole(registry.OPERATOR_ROLE(), operator);
        registry.grantRole(registry.REGISTRAR_ROLE(), operator);
        _setVaultChallengeConfig(vault, true);
        feeManager.setRegistrationFee(REGISTRATION_FEE);
        feeManager.setPromotionFee(vault, 0, 1, PROMOTION_FEE);
        vm.stopPrank();

        usdc.mint(operator, 10_000e6);
    }

    function _registerAlice() internal returns (uint256 agentId) {
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, alice);
        agentId = registry.registerAgent(alice, vault, "Bot", "ipfs://bot", alice, true, erc8004Id);
    }

    function test_SetAgentRegistry_EmitsEvent() public {
        AgentRegistry newRegistry = new AgentRegistry(deployer, feeManager, address(identityRegistry), block.chainid);

        vm.expectEmit(true, false, false, false, address(feeManager));
        emit IFeeManager.AgentRegistryUpdated(address(newRegistry));

        vm.prank(deployer);
        feeManager.setAgentRegistry(address(newRegistry));
    }

    function test_FeeAsset_IsImmutable() public view {
        assertEq(feeManager.feeAsset(), address(usdc));
    }

    function test_SetAndGetRegistrationFee() public view {
        assertEq(feeManager.getRegistrationFee(), REGISTRATION_FEE);
    }

    function test_SetAndGetPromotionFee() public view {
        assertEq(feeManager.getPromotionFee(vault, 0, 1), PROMOTION_FEE);
    }

    function test_RegisterAgent_RegistrarSkipsRegistrationFee() public {
        vm.startPrank(operator);
        uint256 agentId = _registerAlice();
        vm.stopPrank();

        assertEq(usdc.balanceOf(treasury), 0);
        assertEq(usdc.balanceOf(operator), 10_000e6);
        assertEq(agentId, 1);
    }

    function test_PayPromotionFee_TransfersToTreasury() public {
        vm.startPrank(operator);
        usdc.approve(address(feeManager), PROMOTION_FEE);
        uint256 agentId = _registerAlice();
        registry.promoteAgent(agentId, IAgentRegistry.Track.FUNDED);
        vm.stopPrank();

        assertEq(usdc.balanceOf(treasury), PROMOTION_FEE);
    }

    function test_ZeroRegistrationFeeSkipsTransfer() public {
        vm.prank(deployer);
        feeManager.setRegistrationFee(0);

        vm.startPrank(operator);
        _registerAlice();
        vm.stopPrank();

        assertEq(usdc.balanceOf(treasury), 0);
    }

    function test_ZeroPromotionFeeSkipsTransfer() public {
        vm.prank(deployer);
        feeManager.setPromotionFee(vault, 0, 1, 0);

        vm.startPrank(operator);
        uint256 agentId = _registerAlice();
        registry.promoteAgent(agentId, IAgentRegistry.Track.FUNDED);
        vm.stopPrank();
        assertEq(usdc.balanceOf(treasury), 0);
    }

    function test_RevertWhen_NotAgentRegistryCaller() public {
        vm.expectRevert(abi.encodeWithSelector(FeeManager.NotAgentRegistry.selector, bob));
        vm.prank(bob);
        feeManager.payRegistrationFee(bob, 1);
    }

    function test_RevertWhen_InsufficientAllowance() public {
        address agentSigner = vm.addr(AGENT_SIGNER_PRIVATE_KEY);
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, agentSigner);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = _signSelfRegister(agentSigner, erc8004Id, deadline);
        usdc.mint(agentSigner, REGISTRATION_FEE);

        vm.prank(agentSigner);
        vm.expectRevert();
        registry.selfRegisterAgent(vault, "Bot", "ipfs://bot", agentSigner, true, erc8004Id, deadline, signature);
    }

    function test_RevertWhen_InsufficientBalance() public {
        address agentSigner = vm.addr(AGENT_SIGNER_PRIVATE_KEY);
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, agentSigner);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = _signSelfRegister(agentSigner, erc8004Id, deadline);

        vm.startPrank(agentSigner);
        usdc.approve(address(feeManager), REGISTRATION_FEE);
        usdc.burn(agentSigner, usdc.balanceOf(agentSigner));
        vm.expectRevert();
        registry.selfRegisterAgent(vault, "Bot", "ipfs://bot", agentSigner, true, erc8004Id, deadline, signature);
        vm.stopPrank();
    }

    function test_RevertWhen_SetFeeWithoutFeeAdmin() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, bob, feeManager.FEE_ADMIN_ROLE()
            )
        );
        vm.prank(bob);
        feeManager.setRegistrationFee(1);
    }

    function test_FeeAdminCanSetRegistrationFee() public {
        address feeAdmin = makeAddr("feeAdmin");

        vm.startPrank(deployer);
        feeManager.grantRole(feeManager.FEE_ADMIN_ROLE(), feeAdmin);
        vm.stopPrank();

        vm.prank(feeAdmin);
        feeManager.setRegistrationFee(200e6);

        assertEq(feeManager.getRegistrationFee(), 200e6);
    }

    function test_RevertWhen_SetTreasuryWithoutAdmin() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, bob, feeManager.DEFAULT_ADMIN_ROLE()
            )
        );
        vm.prank(bob);
        feeManager.setTreasury(makeAddr("newTreasury"));
    }

    function test_SelfRegisterAgent_PaysRegistrationFeeToTreasury() public {
        address agentSigner = vm.addr(AGENT_SIGNER_PRIVATE_KEY);

        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, agentSigner);
        uint256 deadline = block.timestamp + 1 hours;
        bytes memory signature = _signSelfRegister(agentSigner, erc8004Id, deadline);
        usdc.mint(agentSigner, REGISTRATION_FEE);
        vm.prank(agentSigner);
        usdc.approve(address(feeManager), REGISTRATION_FEE);
        vm.prank(agentSigner);
        uint256 agentId =
            registry.selfRegisterAgent(vault, "Bot", "ipfs://bot", agentSigner, true, erc8004Id, deadline, signature);

        assertEq(agentId, 1);
        assertEq(usdc.balanceOf(treasury), REGISTRATION_FEE);
    }

    function test_RegisterAgent_RegistrarSkipsFeeWhenSelfRegisterFeeConfigured() public {
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, alice);
        vm.prank(operator);
        registry.registerAgent(alice, vault, "Bot", "ipfs://bot", alice, true, erc8004Id);

        assertEq(usdc.balanceOf(treasury), 0);
    }

    function _signSelfRegister(address signer, uint256 erc8004Id, uint256 deadline)
        internal
        view
        returns (bytes memory signature)
    {
        bytes32 structHash = keccak256(
            abi.encode(
                registry.SELF_REGISTER_TYPEHASH(),
                vault,
                keccak256(bytes("Bot")),
                keccak256(bytes("ipfs://bot")),
                signer,
                true,
                erc8004Id,
                registry.nonces(signer),
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
                active: active
            })
        );
    }
}
