// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { BaseTest } from "../helpers/BaseTest.sol";
import { FeeManager } from "../../src/core/FeeManager.sol";
import { AgentRegistry } from "../../src/core/AgentRegistry.sol";
import { TrackConfig } from "../../src/core/TrackConfig.sol";
import { IAgentRegistry } from "../../src/interfaces/IAgentRegistry.sol";
import { ITrackConfig } from "../../src/interfaces/ITrackConfig.sol";
import { IFeeManager } from "../../src/interfaces/IFeeManager.sol";
import { IAccessControl } from "@openzeppelin/contracts/access/IAccessControl.sol";

contract FeeManagerTest is BaseTest {
    FeeManager internal feeManager;
    AgentRegistry internal registry;
    TrackConfig internal trackConfig;

    address internal treasury;
    address internal operator;
    address internal vault;

    uint256 internal constant REGISTRATION_FEE = 100e6;
    uint256 internal constant PROMOTION_FEE = 250e6;

    function setUp() public override {
        super.setUp();

        treasury = makeAddr("treasury");
        operator = makeAddr("operator");
        vault = makeAddr("vault");

        vm.startPrank(deployer);
        feeManager = new FeeManager(deployer, treasury, address(usdc));
        trackConfig = new TrackConfig(deployer);
        registry = new AgentRegistry(deployer, feeManager);
        feeManager.setAgentRegistry(address(registry));
        registry.setTrackConfig(trackConfig);
        registry.grantRole(registry.OPERATOR_ROLE(), operator);
        registry.grantRole(registry.REGISTRAR_ROLE(), operator);
        _setVaultChallengeConfig(vault, true);
        feeManager.setRegistrationFee(REGISTRATION_FEE);
        feeManager.setPromotionFee(vault, 0, 1, PROMOTION_FEE);
        vm.stopPrank();

        usdc.mint(operator, 10_000e6);
    }

    function test_SetAgentRegistry_EmitsEvent() public {
        AgentRegistry newRegistry = new AgentRegistry(deployer, feeManager);

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

    function test_PayRegistrationFee_TransfersToTreasury() public {
        vm.startPrank(operator);
        usdc.approve(address(feeManager), REGISTRATION_FEE);
        uint256 agentId = registry.registerAgent(alice, vault, "Bot", "ipfs://bot", alice);
        vm.stopPrank();

        assertEq(usdc.balanceOf(treasury), REGISTRATION_FEE);
        assertEq(usdc.balanceOf(operator), 10_000e6 - REGISTRATION_FEE);
        assertEq(agentId, 1);
    }

    function test_PayPromotionFee_TransfersToTreasury() public {
        vm.startPrank(operator);
        usdc.approve(address(feeManager), REGISTRATION_FEE + PROMOTION_FEE);
        uint256 agentId = registry.registerAgent(alice, vault, "Bot", "ipfs://bot", alice);
        registry.promoteAgent(agentId, IAgentRegistry.Track.FUNDED);
        vm.stopPrank();

        assertEq(usdc.balanceOf(treasury), REGISTRATION_FEE + PROMOTION_FEE);
    }

    function test_ZeroRegistrationFeeSkipsTransfer() public {
        vm.prank(deployer);
        feeManager.setRegistrationFee(0);

        vm.prank(operator);
        registry.registerAgent(alice, vault, "Bot", "ipfs://bot", alice);

        assertEq(usdc.balanceOf(treasury), 0);
    }

    function test_ZeroPromotionFeeSkipsTransfer() public {
        vm.prank(deployer);
        feeManager.setPromotionFee(vault, 0, 1, 0);

        vm.startPrank(operator);
        usdc.approve(address(feeManager), REGISTRATION_FEE);
        uint256 agentId = registry.registerAgent(alice, vault, "Bot", "ipfs://bot", alice);
        registry.promoteAgent(agentId, IAgentRegistry.Track.FUNDED);
        vm.stopPrank();

        assertEq(usdc.balanceOf(treasury), REGISTRATION_FEE);
    }

    function test_RevertWhen_NotAgentRegistryCaller() public {
        vm.expectRevert(abi.encodeWithSelector(FeeManager.NotAgentRegistry.selector, bob));
        vm.prank(bob);
        feeManager.payRegistrationFee(bob, 1);
    }

    function test_RevertWhen_InsufficientAllowance() public {
        vm.expectRevert();
        vm.prank(operator);
        registry.registerAgent(alice, vault, "Bot", "ipfs://bot", alice);
    }

    function test_RevertWhen_InsufficientBalance() public {
        vm.startPrank(operator);
        usdc.approve(address(feeManager), REGISTRATION_FEE);
        usdc.burn(operator, usdc.balanceOf(operator));
        vm.expectRevert();
        registry.registerAgent(alice, vault, "Bot", "ipfs://bot", alice);
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
}
