// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IPositionTypes } from "../../src/interfaces/IPositionTypes.sol";
import { TradingTestBase } from "../helpers/TradingTestBase.sol";

contract TradeRouterLadderTest is TradingTestBase {
    function setUp() public override {
        super.setUp();
        setUpTradingStack();
    }

    function test_LadderPartialThenFullExit() public {
        uint256 agentId = _registerAgent();

        IPositionTypes.ExitRule[] memory exits = new IPositionTypes.ExitRule[](2);
        exits[0] = IPositionTypes.ExitRule({
            triggerType: IPositionTypes.TriggerType.StopLoss, triggerBps: -1000, exitBps: 5000
        });
        exits[1] = IPositionTypes.ExitRule({
            triggerType: IPositionTypes.TriggerType.StopLoss, triggerBps: -1500, exitBps: 10_000
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
        bytes memory sig = _signOpenPosition(intent);

        vm.prank(executor);
        uint256 positionId = tradeRouter.openPosition(intent, sig);

        uint256 initialTokens = positionManager.getPosition(positionId).tokenAmount;
        assertEq(allocationManager.allocationUsed(agentId), 10_000e6);

        _setTokenPrice(address(nvda), 135e8);
        vm.prank(makeAddr("keeper1"));
        tradeRouter.executeExit(positionId);

        uint256 remaining = positionManager.getPosition(positionId).tokenAmount;
        assertEq(remaining, initialTokens / 2);
        assertEq(allocationManager.allocationUsed(agentId), 5000e6);

        _setTokenPrice(address(nvda), 115e8);
        vm.prank(makeAddr("keeper2"));
        tradeRouter.executeExit(positionId);

        assertEq(positionManager.getPosition(positionId).tokenAmount, 0);
        assertEq(allocationManager.allocationUsed(agentId), 0);
        assertEq(uint256(positionManager.getPosition(positionId).status), uint256(IPositionTypes.PositionStatus.Closed));
    }

    function test_TakeProfitThenStop() public {
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
            usdcAmount: 8000e6,
            minTokenOut: 0,
            maxSlippageBps: 100,
            exits: exits,
            deadline: block.timestamp + 1 hours,
            nonce: tradeRouter.nonces(agentId)
        });
        bytes memory sig = _signOpenPosition(intent);

        vm.prank(executor);
        uint256 positionId = tradeRouter.openPosition(intent, sig);

        _setTokenPrice(address(nvda), 170e8);
        vm.prank(makeAddr("keeperTp"));
        tradeRouter.executeExit(positionId);

        assertGt(positionManager.getPosition(positionId).tokenAmount, 0);

        _setTokenPrice(address(nvda), 130e8);
        vm.prank(makeAddr("keeperSl"));
        tradeRouter.executeExit(positionId);

        assertEq(positionManager.getPosition(positionId).tokenAmount, 0);
    }
}
