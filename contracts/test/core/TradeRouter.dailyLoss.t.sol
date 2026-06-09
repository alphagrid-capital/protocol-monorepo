// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { TradeRouter } from "../../src/core/TradeRouter.sol";
import { IPositionTypes } from "../../src/interfaces/IPositionTypes.sol";
import { TradingTestBase } from "../helpers/TradingTestBase.sol";

contract TradeRouterDailyLossTest is TradingTestBase {
    function setUp() public override {
        super.setUp();
        setUpTradingStack();
    }

    function test_RevertWhen_OpenAfterDailyLossBreached() public {
        _setMaxDailyLossBps(100); // 1% of 100_000e6 cap = 1_000e6 max realized loss

        uint256 agentId = _registerAgent();
        uint256 positionId = _openPosition(agentId, 10_000e6, -1000);

        _setTokenPrice(address(nvda), 120e8);

        IPositionTypes.ReducePositionIntent memory reduce = IPositionTypes.ReducePositionIntent({
            agentId: agentId, positionId: positionId, exitBps: 10_000, deadline: 0, nonce: 0
        });
        bytes memory reduceSig = _signReducePosition(reduce);
        vm.prank(executor);
        tradeRouter.reducePosition(reduce, reduceSig);

        int256 dailyPnl = tradeRouter.dailyRealizedPnlUsdc(agentId, block.timestamp / 1 days);
        assertLt(dailyPnl, 0);
        uint256 lossUsdc = uint256(-dailyPnl);
        uint256 maxLossUsdc = 1000e6;

        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, 5000e6, -1000);
        bytes memory sig = _signOpenPosition(intent);

        vm.expectRevert(abi.encodeWithSelector(TradeRouter.ExceedsDailyLoss.selector, agentId, lossUsdc, maxLossUsdc));
        vm.prank(executor);
        tradeRouter.openPosition(intent, sig);
    }

    function test_ReduceAllowedAfterDailyLossBreached() public {
        _setMaxDailyLossBps(100);

        uint256 agentId = _registerAgent();
        uint256 positionId = _openPosition(agentId, 10_000e6, -1000);

        _setTokenPrice(address(nvda), 130e8);
        IPositionTypes.ReducePositionIntent memory firstReduce = IPositionTypes.ReducePositionIntent({
            agentId: agentId, positionId: positionId, exitBps: 5000, deadline: 0, nonce: 0
        });
        bytes memory firstSig = _signReducePosition(firstReduce);
        vm.prank(executor);
        tradeRouter.reducePosition(firstReduce, firstSig);

        _setTokenPrice(address(nvda), 110e8);
        firstReduce.exitBps = 10_000;
        firstReduce.nonce = 1;
        firstSig = _signReducePosition(firstReduce);
        vm.prank(executor);
        tradeRouter.reducePosition(firstReduce, firstSig);

        int256 dailyPnl = tradeRouter.dailyRealizedPnlUsdc(agentId, block.timestamp / 1 days);
        assertLt(dailyPnl, 0);
        uint256 lossUsdc = uint256(-dailyPnl);
        uint256 maxLossUsdc = 1000e6;

        IPositionTypes.PositionIntent memory intent = _singleStopIntent(agentId, 1000e6, -1000);
        bytes memory sig = _signOpenPosition(intent);
        vm.expectRevert(abi.encodeWithSelector(TradeRouter.ExceedsDailyLoss.selector, agentId, lossUsdc, maxLossUsdc));
        vm.prank(executor);
        tradeRouter.openPosition(intent, sig);
    }
}
