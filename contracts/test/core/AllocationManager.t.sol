// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AgentRegistry } from "../../src/core/AgentRegistry.sol";
import { AllocationManager } from "../../src/core/AllocationManager.sol";
import { FeeManager } from "../../src/core/FeeManager.sol";
import { TokenRegistry } from "../../src/core/TokenRegistry.sol";
import { VaultTrackRegistry } from "../../src/core/VaultTrackRegistry.sol";
import { IAgentRegistry } from "../../src/interfaces/IAgentRegistry.sol";
import { IAllocationManager } from "../../src/interfaces/IAllocationManager.sol";
import { IVaultTrackRegistry } from "../../src/interfaces/IVaultTrackRegistry.sol";
import { MandateVault } from "../../src/vaults/MandateVault.sol";
import { MandateVaultFactory } from "../../src/vaults/MandateVaultFactory.sol";
import { AgentTestLib } from "../helpers/AgentTestLib.sol";
import { BaseTest } from "../helpers/BaseTest.sol";
import { MockERC8004IdentityRegistry } from "../mocks/MockERC8004IdentityRegistry.sol";
import { VaultTestLib } from "../helpers/VaultTestLib.sol";

contract AllocationManagerTest is BaseTest {
    AllocationManager internal allocationManager;
    AgentRegistry internal registry;
    FeeManager internal feeManager;
    VaultTrackRegistry internal vaultTrackRegistry;
    MandateVault internal vault;
    MockERC8004IdentityRegistry internal identityRegistry;

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
        vaultTrackRegistry = new VaultTrackRegistry(deployer);
        identityRegistry = AgentTestLib.deployERC8004IdentityRegistry();
        registry = new AgentRegistry(deployer, feeManager, address(identityRegistry), block.chainid);
        allocationManager = new AllocationManager(deployer, vaultTrackRegistry);

        TokenRegistry tokenRegistry = new TokenRegistry(deployer);
        MandateVaultFactory vaultFactory;
        (vaultFactory,) = VaultTestLib.deployFactory(IERC20(address(usdc)));
        vault = VaultTestLib.deployVault(
            vaultFactory,
            IERC20(address(usdc)),
            "AlphaGrid Tech Vault",
            "agTECH",
            "TECH",
            tokenRegistry,
            deployer,
            address(0)
        );

        feeManager.setAgentRegistry(address(registry));
        registry.setVaultTrackRegistry(vaultTrackRegistry);
        registry.setAllocationManager(allocationManager);
        allocationManager.setAgentRegistry(address(registry));

        registry.grantRole(registry.OPERATOR_ROLE(), operator);
        registry.grantRole(registry.REGISTRAR_ROLE(), operator);
        allocationManager.grantRole(allocationManager.OPERATOR_ROLE(), operator);

        _setVaultTrackConfig(address(vault), 0, CHALLENGE_CAP, 25_000e6);
        _setVaultTrackConfig(address(vault), 1, FUNDED_CAP, 100_000e6);
        vm.stopPrank();
    }

    function _registerAgent(address owner, string memory name, string memory metadataURI)
        internal
        returns (uint256 agentId)
    {
        uint256 erc8004Id = AgentTestLib.mintERC8004(identityRegistry, owner);
        agentId = registry.registerAgent(owner, address(vault), name, metadataURI, owner, true, erc8004Id);
    }

    function test_OnAgentRegisteredCreatesAllocation() public {
        vm.startPrank(operator);
        uint256 agentId = _registerAgent(alice, "Bot", "ipfs://bot");
        vm.stopPrank();

        IAllocationManager.Allocation memory allocation = allocationManager.getAllocation(agentId);
        assertEq(allocation.agentId, agentId);
        assertEq(allocation.vault, address(vault));
        assertEq(allocation.trackId, 0);
        assertEq(allocation.cap, CHALLENGE_CAP);
        assertEq(allocation.used, 0);
        assertEq(uint256(allocation.status), uint256(IAllocationManager.AllocationStatus.Active));
        assertEq(allocationManager.totalAgentCaps(address(vault)), CHALLENGE_CAP);
    }

    function test_OnAgentPromoted_AllowsUsedAboveNewCap() public {
        uint256 challengeCap = 50_000e6;
        uint256 fundedCap = 30_000e6;
        uint256 used = 40_000e6;

        vm.startPrank(deployer);
        _setVaultTrackConfig(address(vault), 0, challengeCap, 100_000e6);
        _setVaultTrackConfig(address(vault), 1, fundedCap, 100_000e6);
        vm.stopPrank();

        vm.startPrank(operator);
        uint256 agentId = _registerAgent(alice, "Bot", "ipfs://bot");
        allocationManager.setAllocationUsed(agentId, used);
        registry.promoteAgent(agentId, IAgentRegistry.Track.FUNDED, alice, false);
        vm.stopPrank();

        IAllocationManager.Allocation memory allocation = allocationManager.getAllocation(agentId);
        assertEq(allocation.used, used);
        assertEq(allocation.cap, fundedCap);
        assertGt(allocation.used, allocation.cap);
        assertEq(allocationManager.totalAgentCaps(address(vault)), fundedCap);
    }

    function test_OnAgentPromoted_IgnoresInactiveTargetTrack() public {
        vm.prank(deployer);
        _setVaultTrackConfigWithActive(address(vault), 1, FUNDED_CAP, 100_000e6, false);

        vm.startPrank(operator);
        uint256 agentId = _registerAgent(alice, "Bot", "ipfs://bot");
        registry.promoteAgent(agentId, IAgentRegistry.Track.FUNDED, alice, false);
        vm.stopPrank();

        IAllocationManager.Allocation memory allocation = allocationManager.getAllocation(agentId);
        assertEq(allocation.trackId, 1);
        assertEq(allocation.cap, FUNDED_CAP);
    }

    function test_OnAgentRegistered_IgnoresInactiveTrack() public {
        vm.prank(deployer);
        _setVaultTrackConfigWithActive(address(vault), 0, CHALLENGE_CAP, 25_000e6, false);

        vm.prank(address(registry));
        allocationManager.onAgentRegistered(1, address(vault), 0);

        assertEq(allocationManager.allocationCap(1), CHALLENGE_CAP);
    }

    function test_OnAgentPromotedUpdatesCap() public {
        vm.startPrank(operator);
        uint256 agentId = _registerAgent(alice, "Bot", "ipfs://bot");
        registry.promoteAgent(agentId, IAgentRegistry.Track.FUNDED, alice, false);
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
        uint256 agentId = _registerAgent(alice, "Bot", "ipfs://bot");
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
        uint256 agentId = _registerAgent(alice, "Bot", "ipfs://bot");
        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSelector(AllocationManager.TrackMismatch.selector, agentId, 0, 1));
        vm.prank(address(registry));
        allocationManager.onAgentPromoted(agentId, address(vault), 1, 1);
    }

    function test_SetAllocationUsed_UpdatesUsed() public {
        vm.startPrank(operator);
        uint256 agentId = _registerAgent(alice, "Bot", "ipfs://bot");
        allocationManager.setAllocationUsed(agentId, 5_000e6);
        vm.stopPrank();

        assertEq(allocationManager.allocationUsed(agentId), 5_000e6);
    }

    function test_RevertWhen_UsedExceedsCap() public {
        vm.startPrank(operator);
        uint256 agentId = _registerAgent(alice, "Bot", "ipfs://bot");

        vm.expectRevert(
            abi.encodeWithSelector(AllocationManager.UsedExceedsCap.selector, agentId, CHALLENGE_CAP + 1, CHALLENGE_CAP)
        );
        allocationManager.setAllocationUsed(agentId, CHALLENGE_CAP + 1);
        vm.stopPrank();
    }

    function test_RevertWhen_SetUsedWithoutOperator() public {
        vm.startPrank(operator);
        uint256 agentId = _registerAgent(alice, "Bot", "ipfs://bot");
        vm.stopPrank();

        vm.expectRevert();
        vm.prank(alice);
        allocationManager.setAllocationUsed(agentId, 1e6);
    }

    function test_SetAllocationStatus_UpdatesStatus() public {
        vm.startPrank(operator);
        uint256 agentId = _registerAgent(alice, "Bot", "ipfs://bot");
        allocationManager.setAllocationStatus(agentId, IAllocationManager.AllocationStatus.Paused);
        vm.stopPrank();

        IAllocationManager.Allocation memory allocation = allocationManager.getAllocation(agentId);
        assertEq(uint256(allocation.status), uint256(IAllocationManager.AllocationStatus.Paused));
    }

    function test_RevertWhen_AllocationExists() public {
        vm.startPrank(operator);
        uint256 agentId = _registerAgent(alice, "Bot", "ipfs://bot");
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
        _registerAgent(alice, "Bot A", "ipfs://a");
        _registerAgent(bob, "Bot B", "ipfs://b");
        vm.stopPrank();

        assertEq(allocationManager.totalAgentCaps(address(vault)), CHALLENGE_CAP * 2);
    }

    function test_OnAgentRemoved_ReleasesCap() public {
        vm.startPrank(operator);
        uint256 agentId = _registerAgent(alice, "Bot", "ipfs://bot");
        vm.stopPrank();

        vm.prank(address(registry));
        allocationManager.onAgentRemoved(agentId);

        IAllocationManager.Allocation memory allocation = allocationManager.getAllocation(agentId);
        assertEq(uint256(allocation.status), uint256(IAllocationManager.AllocationStatus.Removed));
        assertEq(allocation.cap, 0);
        assertEq(allocationManager.totalAgentCaps(address(vault)), 0);
    }

    function test_OnAgentRemoved_Idempotent() public {
        vm.startPrank(operator);
        uint256 agentId = _registerAgent(alice, "Bot", "ipfs://bot");
        registry.setAgentStatus(agentId, IAgentRegistry.AgentStatus.Failed);
        registry.setAgentStatus(agentId, IAgentRegistry.AgentStatus.Exited);
        vm.stopPrank();

        assertEq(allocationManager.totalAgentCaps(address(vault)), 0);
    }

    function test_RevertWhen_RemoveWithUsedNonZero() public {
        vm.startPrank(operator);
        uint256 agentId = _registerAgent(alice, "Bot", "ipfs://bot");
        allocationManager.setAllocationUsed(agentId, 1e6);
        vm.stopPrank();

        vm.expectRevert(abi.encodeWithSelector(AllocationManager.AllocationInUse.selector, agentId, 1e6));
        vm.prank(address(registry));
        allocationManager.onAgentRemoved(agentId);
    }

    function test_SetAgentStatus_TerminalStatusReleasesCap() public {
        vm.startPrank(operator);
        uint256 agentId = _registerAgent(alice, "Bot", "ipfs://bot");
        registry.setAgentStatus(agentId, IAgentRegistry.AgentStatus.Failed);
        vm.stopPrank();

        assertEq(allocationManager.totalAgentCaps(address(vault)), 0);
        assertEq(
            uint256(allocationManager.getAllocation(agentId).status),
            uint256(IAllocationManager.AllocationStatus.Removed)
        );
    }

    function test_SetAgentRegistry_EmitsEvent() public {
        address newRegistry = makeAddr("newRegistry");

        vm.expectEmit(true, false, false, false);
        emit IAllocationManager.AgentRegistryUpdated(newRegistry);
        vm.prank(deployer);
        allocationManager.setAgentRegistry(newRegistry);

        assertEq(allocationManager.agentRegistry(), newRegistry);
    }

    function test_SetVaultTrackRegistry_EmitsEvent() public {
        VaultTrackRegistry newVaultTrackRegistry = new VaultTrackRegistry(deployer);

        vm.expectEmit(true, false, false, false);
        emit IAllocationManager.VaultTrackRegistryUpdated(address(newVaultTrackRegistry));
        vm.prank(deployer);
        allocationManager.setVaultTrackRegistry(newVaultTrackRegistry);

        assertEq(address(allocationManager.vaultTrackRegistry()), address(newVaultTrackRegistry));
    }

    function _setVaultTrackConfig(address vault_, uint256 trackId, uint256 initialAllocation, uint256 maxAllocation)
        internal
    {
        _setVaultTrackConfigWithActive(vault_, trackId, initialAllocation, maxAllocation, true);
    }

    function _setVaultTrackConfigWithActive(
        address vault_,
        uint256 trackId,
        uint256 initialAllocation,
        uint256 maxAllocation,
        bool active
    ) internal {
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
                maxDailyLossBps: 0,
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
}
