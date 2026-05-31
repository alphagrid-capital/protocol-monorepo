// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { BaseTest } from "../helpers/BaseTest.sol";
import { AllocationManager } from "../../src/core/AllocationManager.sol";
import { AgentRegistry } from "../../src/core/AgentRegistry.sol";
import { TrackConfig } from "../../src/core/TrackConfig.sol";
import { FeeManager } from "../../src/core/FeeManager.sol";
import { AlphaGridVault } from "../../src/vaults/AlphaGridVault.sol";
import { TokenRegistry } from "../../src/core/TokenRegistry.sol";
import { IAllocationManager } from "../../src/interfaces/IAllocationManager.sol";
import { ITrackConfig } from "../../src/interfaces/ITrackConfig.sol";
import { IAgentRegistry } from "../../src/interfaces/IAgentRegistry.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract AllocationManagerTest is BaseTest {
    AllocationManager internal allocationManager;
    AgentRegistry internal registry;
    FeeManager internal feeManager;
    TrackConfig internal trackConfig;
    AlphaGridVault internal vault;

    address internal operator;
    address internal treasury;

    uint256 internal constant CHALLENGE_CAP = 10_000e6;
    uint256 internal constant FUNDED_CAP = 50_000e6;

    function setUp() public override {
        super.setUp();

        operator = makeAddr("operator");
        treasury = makeAddr("treasury");

        vm.startPrank(deployer);
        feeManager = new FeeManager(deployer, treasury, address(usdc));
        trackConfig = new TrackConfig(deployer);
        registry = new AgentRegistry(deployer, feeManager);
        allocationManager = new AllocationManager(deployer, trackConfig);

        TokenRegistry tokenRegistry = new TokenRegistry(deployer);
        vault = new AlphaGridVault(
            IERC20(address(usdc)), "AlphaGrid Tech Vault", "agTECH", "TECH", tokenRegistry, deployer
        );

        feeManager.setAgentRegistry(address(registry));
        registry.setTrackConfig(trackConfig);
        registry.setAllocationManager(allocationManager);
        allocationManager.setAgentRegistry(address(registry));

        registry.grantRole(registry.OPERATOR_ROLE(), operator);
        registry.grantRole(registry.REGISTRAR_ROLE(), operator);
        allocationManager.grantRole(allocationManager.OPERATOR_ROLE(), operator);

        _setTrackConfig(address(vault), 0, CHALLENGE_CAP, 25_000e6);
        _setTrackConfig(address(vault), 1, FUNDED_CAP, 100_000e6);
        vm.stopPrank();
    }

    function test_OnAgentRegisteredCreatesAllocation() public {
        vm.prank(operator);
        uint256 agentId = registry.registerAgent(alice, address(vault), "Bot", "ipfs://bot", alice);

        IAllocationManager.Allocation memory allocation = allocationManager.getAllocation(agentId);
        assertEq(allocation.agentId, agentId);
        assertEq(allocation.vault, address(vault));
        assertEq(allocation.trackId, 0);
        assertEq(allocation.cap, CHALLENGE_CAP);
        assertEq(allocation.used, 0);
        assertEq(uint256(allocation.status), uint256(IAllocationManager.AllocationStatus.Active));
        assertEq(allocationManager.totalAgentCaps(address(vault)), CHALLENGE_CAP);
    }

    function test_OnAgentPromotedUpdatesCap() public {
        vm.startPrank(operator);
        uint256 agentId = registry.registerAgent(alice, address(vault), "Bot", "ipfs://bot", alice);
        registry.promoteAgent(agentId, IAgentRegistry.Track.FUNDED);
        vm.stopPrank();

        IAllocationManager.Allocation memory allocation = allocationManager.getAllocation(agentId);
        assertEq(allocation.trackId, 1);
        assertEq(allocation.cap, FUNDED_CAP);
        assertEq(allocationManager.totalAgentCaps(address(vault)), FUNDED_CAP);
    }

    function test_RevertWhen_NotAgentRegistry() public {
        vm.expectRevert(abi.encodeWithSelector(AllocationManager.NotAgentRegistry.selector, alice));
        vm.prank(alice);
        allocationManager.onAgentRegistered(1, address(vault), 0);
    }

    function test_RevertWhen_PromoteVaultMismatch() public {
        vm.startPrank(operator);
        uint256 agentId = registry.registerAgent(alice, address(vault), "Bot", "ipfs://bot", alice);
        vm.stopPrank();

        address wrongVault = makeAddr("wrongVault");

        vm.expectRevert(
            abi.encodeWithSelector(AllocationManager.VaultMismatch.selector, agentId, address(vault), wrongVault)
        );
        vm.prank(address(registry));
        allocationManager.onAgentPromoted(agentId, wrongVault, 0, 1);
    }

    function test_RevertWhen_PromoteTrackMismatch() public {
        vm.startPrank(operator);
        uint256 agentId = registry.registerAgent(alice, address(vault), "Bot", "ipfs://bot", alice);
        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSelector(AllocationManager.TrackMismatch.selector, agentId, 0, 1));
        vm.prank(address(registry));
        allocationManager.onAgentPromoted(agentId, address(vault), 1, 1);
    }

    function test_SetAllocationUsed_UpdatesUsed() public {
        vm.startPrank(operator);
        uint256 agentId = registry.registerAgent(alice, address(vault), "Bot", "ipfs://bot", alice);
        allocationManager.setAllocationUsed(agentId, 5_000e6);
        vm.stopPrank();

        assertEq(allocationManager.allocationUsed(agentId), 5_000e6);
    }

    function test_RevertWhen_UsedExceedsCap() public {
        vm.startPrank(operator);
        uint256 agentId = registry.registerAgent(alice, address(vault), "Bot", "ipfs://bot", alice);

        vm.expectRevert(
            abi.encodeWithSelector(AllocationManager.UsedExceedsCap.selector, agentId, CHALLENGE_CAP + 1, CHALLENGE_CAP)
        );
        allocationManager.setAllocationUsed(agentId, CHALLENGE_CAP + 1);
        vm.stopPrank();
    }

    function test_RevertWhen_SetUsedWithoutOperator() public {
        vm.prank(operator);
        uint256 agentId = registry.registerAgent(alice, address(vault), "Bot", "ipfs://bot", alice);

        vm.expectRevert();
        vm.prank(alice);
        allocationManager.setAllocationUsed(agentId, 1e6);
    }

    function test_SetAllocationStatus_UpdatesStatus() public {
        vm.startPrank(operator);
        uint256 agentId = registry.registerAgent(alice, address(vault), "Bot", "ipfs://bot", alice);
        allocationManager.setAllocationStatus(agentId, IAllocationManager.AllocationStatus.Paused);
        vm.stopPrank();

        IAllocationManager.Allocation memory allocation = allocationManager.getAllocation(agentId);
        assertEq(uint256(allocation.status), uint256(IAllocationManager.AllocationStatus.Paused));
    }

    function test_RevertWhen_AllocationExists() public {
        vm.startPrank(operator);
        uint256 agentId = registry.registerAgent(alice, address(vault), "Bot", "ipfs://bot", alice);
        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSelector(AllocationManager.AllocationExists.selector, agentId));
        vm.prank(address(registry));
        allocationManager.onAgentRegistered(agentId, address(vault), 0);
    }

    function test_RevertWhen_AllocationNotFound() public {
        vm.expectRevert(abi.encodeWithSelector(AllocationManager.AllocationNotFound.selector, 999));
        allocationManager.getAllocation(999);
    }

    function test_TotalAgentCaps_SumsMultipleAgents() public {
        vm.startPrank(operator);
        registry.registerAgent(alice, address(vault), "Bot A", "ipfs://a", alice);
        registry.registerAgent(bob, address(vault), "Bot B", "ipfs://b", bob);
        vm.stopPrank();

        assertEq(allocationManager.totalAgentCaps(address(vault)), CHALLENGE_CAP * 2);
    }

    function test_SetAgentRegistry_EmitsEvent() public {
        address newRegistry = makeAddr("newRegistry");

        vm.expectEmit(true, false, false, false);
        emit IAllocationManager.AgentRegistryUpdated(newRegistry);
        vm.prank(deployer);
        allocationManager.setAgentRegistry(newRegistry);

        assertEq(allocationManager.agentRegistry(), newRegistry);
    }

    function test_SetTrackConfig_EmitsEvent() public {
        TrackConfig newTrackConfig = new TrackConfig(deployer);

        vm.expectEmit(true, false, false, false);
        emit IAllocationManager.TrackConfigUpdated(address(newTrackConfig));
        vm.prank(deployer);
        allocationManager.setTrackConfig(newTrackConfig);

        assertEq(address(allocationManager.trackConfig()), address(newTrackConfig));
    }

    function _setTrackConfig(address vault_, uint256 trackId, uint256 initialAllocation, uint256 maxAllocation)
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
