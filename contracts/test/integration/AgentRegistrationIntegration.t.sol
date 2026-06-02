// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AgentRegistry } from "../../src/core/AgentRegistry.sol";
import { FeeManager } from "../../src/core/FeeManager.sol";
import { VaultTrackRegistry } from "../../src/core/VaultTrackRegistry.sol";
import { IAgentRegistry } from "../../src/interfaces/IAgentRegistry.sol";
import { IVaultTrackRegistry } from "../../src/interfaces/IVaultTrackRegistry.sol";
import { AgentTestLib } from "../helpers/AgentTestLib.sol";
import { BaseTest } from "../helpers/BaseTest.sol";
import { MockERC8004IdentityRegistry } from "../mocks/MockERC8004IdentityRegistry.sol";

/// @notice End-to-end wiring for agent registration, fees, and track config.
contract AgentRegistrationIntegrationTest is BaseTest {
    AgentRegistry internal registry;
    FeeManager internal feeManager;
    VaultTrackRegistry internal vaultTrackRegistry;
    MockERC8004IdentityRegistry internal identityRegistry;

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
        vaultTrackRegistry = new VaultTrackRegistry(deployer);
        identityRegistry = AgentTestLib.deployERC8004IdentityRegistry();
        registry = new AgentRegistry(deployer, feeManager, address(identityRegistry), block.chainid);

        feeManager.setAgentRegistry(address(registry));
        registry.setVaultTrackRegistry(vaultTrackRegistry);

        registry.grantRole(registry.OPERATOR_ROLE(), operator);
        registry.grantRole(registry.REGISTRAR_ROLE(), operator);

        feeManager.setRegistrationFee(REGISTRATION_FEE);
        feeManager.setPromotionFee(vault, 0, 1, CHALLENGE_TO_FUNDED_FEE);

        _setVaultChallengeConfig(vault, true);
        vm.stopPrank();

        usdc.mint(operator, 10_000e6);
    }

    function _registerAlice() internal returns (uint256 agentId) {
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, alice);
        agentId = registry.registerAgent(alice, vault, "Alpha Bot", "ipfs://alpha", alice, true, erc8004Id);
    }

    function test_RegisterWithVaultTrackRegistryApproval() public {
        vm.startPrank(operator);
        uint256 agentId = _registerAlice();
        vm.stopPrank();

        assertEq(agentId, 1);
        assertEq(usdc.balanceOf(treasury), 0);
        assertEq(uint256(registry.trackOf(agentId)), uint256(IAgentRegistry.Track.CHALLENGE));
    }

    function test_RevertWhen_VaultMissingChallengeConfig() public {
        AgentTestLib.mintERC8004(identityRegistry, alice);
        vm.prank(operator);
        vm.expectRevert(abi.encodeWithSelector(AgentRegistry.VaultNotApproved.selector, unconfiguredVault));
        registry.registerAgent(alice, unconfiguredVault, "Alpha Bot", "ipfs://alpha", alice, false, 0);
    }

    function test_PromotionCollectsFeeFromOperator() public {
        vm.startPrank(operator);
        usdc.approve(address(feeManager), CHALLENGE_TO_FUNDED_FEE);
        uint256 agentId = _registerAlice();
        registry.promoteAgent(agentId, IAgentRegistry.Track.FUNDED);
        vm.stopPrank();

        assertEq(uint256(registry.trackOf(agentId)), uint256(IAgentRegistry.Track.FUNDED));
        assertEq(usdc.balanceOf(treasury), CHALLENGE_TO_FUNDED_FEE);
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
