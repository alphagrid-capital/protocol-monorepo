// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { BaseTest } from "../helpers/BaseTest.sol";
import { AgentRegistry } from "../../src/core/AgentRegistry.sol";
import { FeeManager } from "../../src/core/FeeManager.sol";
import { TrackConfig } from "../../src/core/TrackConfig.sol";
import { AllocationManager } from "../../src/core/AllocationManager.sol";
import { AlphaGridVault } from "../../src/vaults/AlphaGridVault.sol";
import { TokenRegistry } from "../../src/core/TokenRegistry.sol";
import { IAgentRegistry } from "../../src/interfaces/IAgentRegistry.sol";
import { ITrackConfig } from "../../src/interfaces/ITrackConfig.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice End-to-end wiring for vault deposits, allocations, and agent funding.
contract VaultAndAllocationIntegrationTest is BaseTest {
    AgentRegistry internal registry;
    FeeManager internal feeManager;
    TrackConfig internal trackConfig;
    AllocationManager internal allocationManager;
    AlphaGridVault internal techVault;

    address internal treasury;
    address internal operator;
    address internal lp;

    uint256 internal constant SEED_DEPOSIT = 500_000e6;
    uint256 internal constant CHALLENGE_CAP = 10_000e6;

    function setUp() public override {
        super.setUp();

        treasury = makeAddr("treasury");
        operator = makeAddr("operator");
        lp = makeAddr("lp");

        vm.startPrank(deployer);
        feeManager = new FeeManager(deployer, treasury, address(usdc));
        trackConfig = new TrackConfig(deployer);
        registry = new AgentRegistry(deployer, feeManager);
        allocationManager = new AllocationManager(deployer, trackConfig);
        TokenRegistry tokenRegistry = new TokenRegistry(deployer);
        techVault = new AlphaGridVault(
            IERC20(address(usdc)), "AlphaGrid Tech Vault", "agTECH", "TECH", tokenRegistry, deployer
        );

        feeManager.setAgentRegistry(address(registry));
        registry.setTrackConfig(trackConfig);
        registry.setAllocationManager(allocationManager);
        allocationManager.setAgentRegistry(address(registry));

        registry.grantRole(registry.OPERATOR_ROLE(), operator);
        registry.grantRole(registry.REGISTRAR_ROLE(), operator);

        _setVaultTrackConfig(address(techVault), 0, CHALLENGE_CAP, 25_000e6);
        _setVaultTrackConfig(address(techVault), 1, 50_000e6, 100_000e6);

        usdc.mint(lp, SEED_DEPOSIT);
        vm.stopPrank();

        vm.startPrank(lp);
        usdc.approve(address(techVault), SEED_DEPOSIT);
        techVault.deposit(SEED_DEPOSIT, lp);
        vm.stopPrank();
    }

    function test_RegisterAgentCreatesAllocationAgainstRealVault() public {
        vm.prank(operator);
        uint256 agentId = registry.registerAgent(alice, address(techVault), "Alpha Bot", "ipfs://alpha", alice);

        assertEq(allocationManager.allocationCap(agentId), CHALLENGE_CAP);
        assertEq(techVault.totalAssets(), SEED_DEPOSIT);
    }

    function test_PromoteUpdatesAllocationCap() public {
        vm.startPrank(operator);
        uint256 agentId = registry.registerAgent(alice, address(techVault), "Alpha Bot", "ipfs://alpha", alice);
        registry.promoteAgent(agentId, IAgentRegistry.Track.FUNDED);
        vm.stopPrank();

        assertEq(allocationManager.allocationCap(agentId), 50_000e6);
        assertEq(uint256(registry.trackOf(agentId)), uint256(IAgentRegistry.Track.FUNDED));
    }

    function _setVaultTrackConfig(address vault_, uint256 trackId, uint256 initialAllocation, uint256 maxAllocation)
        internal
    {
        trackConfig.setVaultTrackConfig(
            vault_,
            trackId,
            ITrackConfig.VaultTrackConfig({
                vault: vault_,
                trackId: trackId,
                initialAllocation: initialAllocation,
                maxAllocation: maxAllocation,
                maxDrawdownBps: 1500,
                maxTradeSizeBps: 500,
                maxDailyTurnoverBps: 2500,
                evaluationPeriod: 14 days,
                minTrades: 5,
                promotionScore: 70,
                active: true
            })
        );
    }
}
