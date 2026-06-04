// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { TradeRouter } from "../../src/core/TradeRouter.sol";
import { IAgentRegistry } from "../../src/interfaces/IAgentRegistry.sol";
import { IPositionTypes } from "../../src/interfaces/IPositionTypes.sol";
import { MandateVault } from "../../src/vaults/MandateVault.sol";
import { TradingTestBase } from "../helpers/TradingTestBase.sol";

/// @notice End-to-end trading: register agent, open position, keeper exit.
contract TradingFlowIntegrationTest is TradingTestBase {
    function setUp() public override {
        super.setUp();
        setUpTradingStack();
    }

    function test_RegisterOpenExitFlow() public {
        uint256 agentId = _registerAgent();

        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, 25_000e6, -1500);
        bytes memory sig = _signOpenPosition(intent);

        vm.prank(executor);
        uint256 positionId = tradeRouter.openPosition(intent, sig);

        assertEq(registry.vaultOf(agentId), vaultAddr);
        assertEq(allocationManager.allocationCap(agentId), CHALLENGE_CAP);
        assertEq(allocationManager.allocationUsed(agentId), 25_000e6);
        assertTrue(vault.isAllowedToken(address(nvda)));

        _setTokenPrice(address(nvda), 125e8);

        vm.prank(makeAddr("keeper"));
        tradeRouter.executeExit(positionId);

        assertEq(allocationManager.allocationUsed(agentId), 0);
        assertEq(positionManager.openPositionId(agentId, address(nvda)), 0);
    }

    function test_SuspendedAgentCanStillExit() public {
        uint256 agentId = _registerAgent();

        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, 5000e6, -1000);
        bytes memory sig = _signOpenPosition(intent);

        vm.prank(executor);
        uint256 positionId = tradeRouter.openPosition(intent, sig);

        vm.prank(operator);
        registry.setAgentStatus(agentId, IAgentRegistry.AgentStatus.Suspended);

        _setTokenPrice(address(nvda), 120e8);
        vm.prank(makeAddr("keeper"));
        tradeRouter.executeExit(positionId);

        assertEq(positionManager.getPosition(positionId).tokenAmount, 0);
    }

    function test_ForceCloseSuspendedAgent() public {
        uint256 agentId = _registerAgent();

        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, 8000e6, -1000);
        bytes memory sig = _signOpenPosition(intent);

        vm.prank(executor);
        uint256 positionId = tradeRouter.openPosition(intent, sig);

        assertEq(allocationManager.allocationUsed(agentId), 8000e6);

        vm.prank(operator);
        registry.setAgentStatus(agentId, IAgentRegistry.AgentStatus.Suspended);

        vm.prank(operator);
        tradeRouter.forceClose(positionId);

        assertEq(positionManager.getPosition(positionId).tokenAmount, 0);
        assertEq(allocationManager.allocationUsed(agentId), 0);
        assertEq(positionManager.openPositionId(agentId, address(nvda)), 0);
        assertEq(uint256(positionManager.getPosition(positionId).status), uint256(IPositionTypes.PositionStatus.Closed));
    }

    function test_RevertWhen_ForceCloseActiveAgent() public {
        uint256 agentId = _registerAgent();

        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, 3000e6, -1000);
        bytes memory sig = _signOpenPosition(intent);

        vm.prank(executor);
        uint256 positionId = tradeRouter.openPosition(intent, sig);

        vm.expectRevert(abi.encodeWithSelector(TradeRouter.AgentNotSuspended.selector, agentId));
        vm.prank(operator);
        tradeRouter.forceClose(positionId);
    }

    function test_TradingPauseBlocksOpenAndKeeperExit() public {
        uint256 agentId = _registerAgent();

        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, 5000e6, -1000);
        bytes memory sig = _signOpenPosition(intent);

        vm.prank(deployer);
        vault.setTradingPaused(true);

        vm.prank(executor);
        vm.expectRevert(MandateVault.TradingOperationsPaused.selector);
        tradeRouter.openPosition(intent, sig);

        vm.prank(deployer);
        vault.setTradingPaused(false);

        vm.prank(executor);
        uint256 positionId = tradeRouter.openPosition(intent, sig);

        vm.prank(deployer);
        vault.setTradingPaused(true);

        _setTokenPrice(address(nvda), 120e8);
        vm.expectRevert(MandateVault.TradingOperationsPaused.selector);
        vm.prank(makeAddr("keeper"));
        tradeRouter.executeExit(positionId);
    }

    function test_ForceCloseWorksWhenTradingPaused() public {
        uint256 agentId = _registerAgent();

        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, 6000e6, -1000);
        bytes memory sig = _signOpenPosition(intent);

        vm.prank(executor);
        uint256 positionId = tradeRouter.openPosition(intent, sig);

        vm.prank(operator);
        registry.setAgentStatus(agentId, IAgentRegistry.AgentStatus.Suspended);

        vm.prank(deployer);
        vault.setTradingPaused(true);

        vm.prank(operator);
        tradeRouter.forceClose(positionId);

        assertEq(positionManager.getPosition(positionId).tokenAmount, 0);
        assertEq(allocationManager.allocationUsed(agentId), 0);
    }
}
