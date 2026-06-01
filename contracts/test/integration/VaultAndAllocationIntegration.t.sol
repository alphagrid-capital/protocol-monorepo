// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AgentRegistry } from "../../src/core/AgentRegistry.sol";
import { AllocationManager } from "../../src/core/AllocationManager.sol";
import { FeeManager } from "../../src/core/FeeManager.sol";
import { TokenRegistry } from "../../src/core/TokenRegistry.sol";
import { VaultTrackRegistry } from "../../src/core/VaultTrackRegistry.sol";
import { IAgentRegistry } from "../../src/interfaces/IAgentRegistry.sol";
import { IVaultTrackRegistry } from "../../src/interfaces/IVaultTrackRegistry.sol";
import { MandateVault } from "../../src/vaults/MandateVault.sol";
import { MandateVaultFactory } from "../../src/vaults/MandateVaultFactory.sol";
import { BaseTest } from "../helpers/BaseTest.sol";
import { VaultTestLib } from "../helpers/VaultTestLib.sol";

/// @notice End-to-end wiring for vault deposits, allocations, and agent funding.
contract VaultAndAllocationIntegrationTest is BaseTest {
    AgentRegistry internal registry;
    FeeManager internal feeManager;
    VaultTrackRegistry internal vaultTrackRegistry;
    AllocationManager internal allocationManager;
    MandateVault internal techVault;

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
        vaultTrackRegistry = new VaultTrackRegistry(deployer);
        registry = new AgentRegistry(deployer, feeManager);
        allocationManager = new AllocationManager(deployer, vaultTrackRegistry);
        TokenRegistry tokenRegistry = new TokenRegistry(deployer);
        MandateVaultFactory vaultFactory;
        (vaultFactory,) = VaultTestLib.deployFactory(IERC20(address(usdc)));
        techVault = VaultTestLib.deployVault(
            vaultFactory,
            IERC20(address(usdc)),
            "AlphaGrid Tech Vault",
            "agTECH",
            "TECH",
            tokenRegistry,
            deployer,
            treasury
        );

        feeManager.setAgentRegistry(address(registry));
        registry.setVaultTrackRegistry(vaultTrackRegistry);
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
        vaultTrackRegistry.setVaultTrackConfig(
            vault_,
            trackId,
            IVaultTrackRegistry.VaultTrackConfig({
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
