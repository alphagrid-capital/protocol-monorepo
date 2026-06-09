// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { TradeRouter } from "../../src/core/TradeRouter.sol";
import { IPositionTypes } from "../../src/interfaces/IPositionTypes.sol";
import { TradingTestBase } from "../helpers/TradingTestBase.sol";

contract TradeRouterAdjustTest is TradingTestBase {
    function setUp() public override {
        super.setUp();
        setUpTradingStack();
    }

    function test_ReducePartialThenFull() public {
        uint256 agentId = _registerAgent();
        uint256 positionId = _openPosition(agentId, 10_000e6, -1000);

        IPositionTypes.ReducePositionIntent memory reduce = IPositionTypes.ReducePositionIntent({
            agentId: agentId, positionId: positionId, exitBps: 3000, deadline: 0, nonce: 0
        });
        bytes memory sig = _signReducePosition(reduce);
        vm.prank(executor);
        tradeRouter.reducePosition(reduce, sig);

        assertApproxEqAbs(allocationManager.allocationUsed(agentId), 7000e6, 2);
        assertEq(positionManager.getPosition(positionId).nextRuleIndex, 0);

        reduce.exitBps = 10_000;
        sig = _signReducePosition(reduce);
        vm.prank(executor);
        tradeRouter.reducePosition(reduce, sig);

        assertEq(allocationManager.allocationUsed(agentId), 0);
        assertEq(uint256(positionManager.getPosition(positionId).status), uint256(IPositionTypes.PositionStatus.Closed));
    }

    function test_ReduceDoesNotAdvanceLadderIndex() public {
        uint256 agentId = _registerAgent();
        uint256 positionId = _openPosition(agentId, 10_000e6, -1000);

        IPositionTypes.ReducePositionIntent memory reduce = IPositionTypes.ReducePositionIntent({
            agentId: agentId, positionId: positionId, exitBps: 3000, deadline: 0, nonce: 0
        });
        bytes memory sig = _signReducePosition(reduce);
        vm.prank(executor);
        tradeRouter.reducePosition(reduce, sig);

        assertEq(positionManager.getPosition(positionId).nextRuleIndex, 0);

        _setTokenPrice(address(nvda), 130e8);
        assertTrue(tradeRouter.isTriggerMet(positionId));
    }

    function test_AddToPositionWeightedEntry() public {
        uint256 agentId = _registerAgent();
        uint256 positionId = _openPosition(agentId, 10_000e6, -1000);
        uint256 entryBefore = positionManager.getPosition(positionId).entryPriceUsdc;

        _setTokenPrice(address(nvda), 120e8);

        IPositionTypes.AddToPositionIntent memory add = IPositionTypes.AddToPositionIntent({
            agentId: agentId,
            positionId: positionId,
            usdcAmount: 5000e6,
            minTokenOut: 0,
            maxSlippageBps: 100,
            deadline: 0,
            nonce: 0
        });
        bytes memory sig = _signAddToPosition(add);
        vm.prank(executor);
        tradeRouter.addToPosition(add, sig);

        assertEq(allocationManager.allocationUsed(agentId), 15_000e6);
        uint256 entryAfter = positionManager.getPosition(positionId).entryPriceUsdc;
        assertGt(entryAfter, 0);
        assertNotEq(entryAfter, entryBefore);
    }

    function test_UpdateExitLadderReplacesPendingOnly() public {
        uint256 agentId = _registerAgent();

        IPositionTypes.ExitRule[] memory exits = new IPositionTypes.ExitRule[](2);
        exits[0] = IPositionTypes.ExitRule({
            triggerType: IPositionTypes.TriggerType.TakeProfit, triggerBps: 1000, exitBps: 5000
        });
        exits[1] = IPositionTypes.ExitRule({
            triggerType: IPositionTypes.TriggerType.StopLoss, triggerBps: -1000, exitBps: 10_000
        });

        IPositionTypes.PositionIntent memory intent = IPositionTypes.PositionIntent({
            agentId: agentId,
            vault: vaultAddr,
            token: address(nvda),
            usdcAmount: 10_000e6,
            minTokenOut: 0,
            maxSlippageBps: 100,
            exits: exits,
            deadline: block.timestamp + 1 hours,
            nonce: tradeRouter.nonces(agentId)
        });
        bytes memory openSig = _signOpenPosition(intent);
        vm.prank(executor);
        uint256 positionId = tradeRouter.openPosition(intent, openSig);

        _setTokenPrice(address(nvda), 165e8);
        vm.prank(makeAddr("keeper"));
        tradeRouter.executeExit(positionId);

        assertEq(positionManager.getPosition(positionId).nextRuleIndex, 1);

        IPositionTypes.ExitRule[] memory newPending = new IPositionTypes.ExitRule[](1);
        newPending[0] = IPositionTypes.ExitRule({
            triggerType: IPositionTypes.TriggerType.StopLoss, triggerBps: -800, exitBps: 10_000
        });

        IPositionTypes.UpdateExitLadderIntent memory update = IPositionTypes.UpdateExitLadderIntent({
            agentId: agentId, positionId: positionId, exits: newPending, deadline: 0, nonce: 0
        });
        bytes memory updateSig = _signUpdateExitLadder(update);
        vm.prank(executor);
        tradeRouter.updateExitLadder(update, updateSig);

        assertEq(positionManager.getPosition(positionId).nextRuleIndex, 1);
        IPositionTypes.ExitRule memory next = positionManager.getNextExitRule(positionId);
        assertEq(next.triggerBps, -800);
    }

    function test_RevertWhen_UpdateSlTooWide() public {
        uint256 agentId = _registerAgent();
        uint256 positionId = _openPosition(agentId, 10_000e6, -1000);

        IPositionTypes.ExitRule[] memory newPending = new IPositionTypes.ExitRule[](1);
        newPending[0] = IPositionTypes.ExitRule({
            triggerType: IPositionTypes.TriggerType.StopLoss, triggerBps: -2000, exitBps: 10_000
        });

        IPositionTypes.UpdateExitLadderIntent memory update = IPositionTypes.UpdateExitLadderIntent({
            agentId: agentId, positionId: positionId, exits: newPending, deadline: 0, nonce: 0
        });
        bytes memory updateSig = _signUpdateExitLadder(update);

        vm.expectRevert(TradeRouter.ExitRulesOutOfBounds.selector);
        vm.prank(executor);
        tradeRouter.updateExitLadder(update, updateSig);
    }

    function test_RevertWhen_UpdatePendingRuleAlreadyTriggered() public {
        uint256 agentId = _registerAgent();
        uint256 positionId = _openPosition(agentId, 10_000e6, -1000);

        _setTokenPrice(address(nvda), 130e8);

        IPositionTypes.ExitRule[] memory newPending = new IPositionTypes.ExitRule[](1);
        newPending[0] = IPositionTypes.ExitRule({
            triggerType: IPositionTypes.TriggerType.StopLoss, triggerBps: -800, exitBps: 10_000
        });

        IPositionTypes.UpdateExitLadderIntent memory update = IPositionTypes.UpdateExitLadderIntent({
            agentId: agentId, positionId: positionId, exits: newPending, deadline: 0, nonce: 0
        });
        bytes memory updateSig = _signUpdateExitLadder(update);

        vm.expectRevert(abi.encodeWithSelector(TradeRouter.PendingRuleAlreadyTriggered.selector, positionId));
        vm.prank(executor);
        tradeRouter.updateExitLadder(update, updateSig);
    }

    function test_RevertWhen_AddBlockedByRegistryPaused() public {
        uint256 agentId = _registerAgent();
        uint256 positionId = _openPosition(agentId, 10_000e6, -1000);

        vm.prank(operator);
        registry.pause();

        IPositionTypes.AddToPositionIntent memory add = IPositionTypes.AddToPositionIntent({
            agentId: agentId,
            positionId: positionId,
            usdcAmount: 1000e6,
            minTokenOut: 0,
            maxSlippageBps: 100,
            deadline: 0,
            nonce: 0
        });
        bytes memory sig = _signAddToPosition(add);

        vm.expectRevert(TradeRouter.RegistryPaused.selector);
        vm.prank(executor);
        tradeRouter.addToPosition(add, sig);
    }

    function test_RevertWhen_OpenNoTakeProfitWhenRequired() public {
        _setRequireTakeProfit(true);

        uint256 agentId = _registerAgent();
        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, 10_000e6, -1000);
        bytes memory sig = _signOpenPosition(intent);

        vm.expectRevert(TradeRouter.ExitRulesOutOfBounds.selector);
        vm.prank(executor);
        tradeRouter.openPosition(intent, sig);
    }

    function test_RevertWhen_UpdateNoTakeProfitWhenRequired() public {
        _setRequireTakeProfit(true);

        uint256 agentId = _registerAgent();

        IPositionTypes.ExitRule[] memory exits = new IPositionTypes.ExitRule[](2);
        exits[0] = IPositionTypes.ExitRule({
            triggerType: IPositionTypes.TriggerType.TakeProfit, triggerBps: 1000, exitBps: 5000
        });
        exits[1] = IPositionTypes.ExitRule({
            triggerType: IPositionTypes.TriggerType.StopLoss, triggerBps: -1000, exitBps: 10_000
        });

        IPositionTypes.PositionIntent memory intent = IPositionTypes.PositionIntent({
            agentId: agentId,
            vault: vaultAddr,
            token: address(nvda),
            usdcAmount: 10_000e6,
            minTokenOut: 0,
            maxSlippageBps: 100,
            exits: exits,
            deadline: block.timestamp + 1 hours,
            nonce: tradeRouter.nonces(agentId)
        });
        bytes memory openSig = _signOpenPosition(intent);
        vm.prank(executor);
        uint256 positionId = tradeRouter.openPosition(intent, openSig);

        IPositionTypes.ExitRule[] memory slOnly = new IPositionTypes.ExitRule[](1);
        slOnly[0] = IPositionTypes.ExitRule({
            triggerType: IPositionTypes.TriggerType.StopLoss, triggerBps: -1000, exitBps: 10_000
        });

        IPositionTypes.UpdateExitLadderIntent memory update = IPositionTypes.UpdateExitLadderIntent({
            agentId: agentId, positionId: positionId, exits: slOnly, deadline: 0, nonce: 0
        });
        bytes memory updateSig = _signUpdateExitLadder(update);

        vm.expectRevert(TradeRouter.ExitRulesOutOfBounds.selector);
        vm.prank(executor);
        tradeRouter.updateExitLadder(update, updateSig);
    }

    function test_ReduceAllowedWhenRegistryPaused() public {
        uint256 agentId = _registerAgent();
        uint256 positionId = _openPosition(agentId, 10_000e6, -1000);

        vm.prank(operator);
        registry.pause();

        IPositionTypes.ReducePositionIntent memory reduce = IPositionTypes.ReducePositionIntent({
            agentId: agentId, positionId: positionId, exitBps: 10_000, deadline: 0, nonce: 0
        });
        bytes memory sig = _signReducePosition(reduce);
        vm.prank(executor);
        tradeRouter.reducePosition(reduce, sig);

        assertEq(allocationManager.allocationUsed(agentId), 0);
    }
}
