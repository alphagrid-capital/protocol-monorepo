// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { BaseTest } from "../helpers/BaseTest.sol";
import { AgentRegistry } from "../../src/core/AgentRegistry.sol";
import { FeeManager } from "../../src/core/FeeManager.sol";
import { TrackConfig } from "../../src/core/TrackConfig.sol";
import { IAgentRegistry } from "../../src/interfaces/IAgentRegistry.sol";
import { ITrackConfig } from "../../src/interfaces/ITrackConfig.sol";

/// @notice End-to-end wiring for agent registration, fees, and track config.
contract AgentRegistrationIntegrationTest is BaseTest {
    AgentRegistry internal registry;
    FeeManager internal feeManager;
    TrackConfig internal trackConfig;

    address internal treasury;
    address internal operator;
    address internal vault;
    address internal unconfiguredVault;

    uint256 internal constant REGISTRATION_FEE = 50e6;
    uint256 internal constant CHALLENGE_TO_FUNDED_FEE = 200e6;

    function setUp() public override {
        super.setUp();

        treasury = makeAddr("treasury");
        operator = makeAddr("operator");
        vault = makeAddr("vault");
        unconfiguredVault = makeAddr("unconfiguredVault");

        vm.startPrank(deployer);
        feeManager = new FeeManager(deployer, treasury, address(usdc));
        trackConfig = new TrackConfig(deployer);
        registry = new AgentRegistry(deployer, feeManager);

        feeManager.setAgentRegistry(address(registry));
        registry.setTrackConfig(trackConfig);

        registry.grantRole(registry.OPERATOR_ROLE(), operator);
        registry.grantRole(registry.REGISTRAR_ROLE(), operator);

        feeManager.setRegistrationFee(REGISTRATION_FEE);
        feeManager.setPromotionFee(vault, 0, 1, CHALLENGE_TO_FUNDED_FEE);

        _setVaultChallengeConfig(vault, true);
        vm.stopPrank();

        usdc.mint(operator, 10_000e6);
    }

    function test_RegisterWithTrackConfigApproval() public {
        vm.startPrank(operator);
        usdc.approve(address(feeManager), REGISTRATION_FEE);
        uint256 agentId = registry.registerAgent(alice, vault, "Alpha Bot", "ipfs://alpha", alice);
        vm.stopPrank();

        assertEq(agentId, 1);
        assertEq(usdc.balanceOf(treasury), REGISTRATION_FEE);
        assertEq(uint256(registry.trackOf(agentId)), uint256(IAgentRegistry.Track.CHALLENGE));
    }

    function test_RevertWhen_VaultMissingChallengeConfig() public {
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.VaultNotApproved.selector, unconfiguredVault));
        registry.registerAgent(alice, unconfiguredVault, "Alpha Bot", "ipfs://alpha", alice);
    }

    function test_PromotionCollectsFeeFromOperator() public {
        vm.startPrank(operator);
        usdc.approve(address(feeManager), REGISTRATION_FEE + CHALLENGE_TO_FUNDED_FEE);
        uint256 agentId = registry.registerAgent(alice, vault, "Alpha Bot", "ipfs://alpha", alice);
        registry.promoteAgent(agentId, IAgentRegistry.Track.FUNDED);
        vm.stopPrank();

        assertEq(uint256(registry.trackOf(agentId)), uint256(IAgentRegistry.Track.FUNDED));
        assertEq(usdc.balanceOf(treasury), REGISTRATION_FEE + CHALLENGE_TO_FUNDED_FEE);
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
