// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { PositionManager } from "../../src/core/PositionManager.sol";
import { IPositionTypes } from "../../src/interfaces/IPositionTypes.sol";
import { MockERC20 } from "../../src/mocks/MockERC20.sol";
import { TradingTestBase } from "../helpers/TradingTestBase.sol";

contract PositionManagerTest is TradingTestBase {
    function setUp() public override {
        super.setUp();
        setUpTradingStack();
    }

    function test_OpenPositionCreditsLedger() public {
        IPositionTypes.ExitRule[] memory exits = new IPositionTypes.ExitRule[](1);
        exits[0] = IPositionTypes.ExitRule({
            triggerType: IPositionTypes.TriggerType.StopLoss, triggerBps: -1000, exitBps: 10_000
        });

        vm.prank(address(tradeRouter));
        uint256 positionId = positionManager.openPosition(1, vaultAddr, address(nvda), 1e18, 150e6, 1000e6, 100, exits);

        assertEq(positionId, 1);
        assertEq(positionManager.agentTokenBalance(1, address(nvda)), 1e18);
        assertEq(positionManager.totalTokenLedger(address(nvda)), 1e18);
        assertEq(positionManager.openPositionId(1, address(nvda)), positionId);
        assertEq(positionManager.openPositionCountByAgent(1), 1);

        uint256[] memory openIds = positionManager.getOpenPositionIds(1);
        assertEq(openIds.length, 1);
        assertEq(openIds[0], positionId);

        IPositionTypes.Position memory position = positionManager.getPosition(positionId);
        assertEq(position.tokenAmount, 1e18);
        assertEq(position.usdcCostBasis, 1000e6);
        assertEq(uint256(position.status), uint256(IPositionTypes.PositionStatus.Open));
        assertEq(position.realizedPnlUsdc, 0);
    }

    function test_ApplyExitPartialAndClose() public {
        IPositionTypes.ExitRule[] memory exits = new IPositionTypes.ExitRule[](2);
        exits[0] = IPositionTypes.ExitRule({
            triggerType: IPositionTypes.TriggerType.StopLoss, triggerBps: -1000, exitBps: 5000
        });
        exits[1] = IPositionTypes.ExitRule({
            triggerType: IPositionTypes.TriggerType.StopLoss, triggerBps: -1500, exitBps: 10_000
        });

        vm.startPrank(address(tradeRouter));
        uint256 positionId = positionManager.openPosition(1, vaultAddr, address(nvda), 2e18, 150e6, 2000e6, 100, exits);
        positionManager.applyLadderExit(positionId, 1e18, 1000e6, 50e6);
        vm.stopPrank();

        assertEq(positionManager.agentTokenBalance(1, address(nvda)), 1e18);
        assertEq(positionManager.realizedPnlUsdc(positionId), 50e6);
        assertEq(positionManager.openPositionCountByAgent(1), 1);

        vm.prank(address(tradeRouter));
        positionManager.applyLadderExit(positionId, 1e18, 1000e6, -25e6);

        assertEq(positionManager.agentTokenBalance(1, address(nvda)), 0);
        assertEq(positionManager.totalTokenLedger(address(nvda)), 0);
        assertEq(positionManager.openPositionId(1, address(nvda)), 0);
        assertEq(positionManager.openPositionCountByAgent(1), 0);
        assertEq(positionManager.getOpenPositionIds(1).length, 0);
        assertEq(uint256(positionManager.getPosition(positionId).status), uint256(IPositionTypes.PositionStatus.Closed));
        assertEq(positionManager.realizedPnlUsdc(positionId), 25e6);
    }

    function test_GetOpenPositionIds_MultipleTokens() public {
        IPositionTypes.ExitRule[] memory exits = new IPositionTypes.ExitRule[](1);
        exits[0] = IPositionTypes.ExitRule({
            triggerType: IPositionTypes.TriggerType.StopLoss, triggerBps: -1000, exitBps: 10_000
        });

        MockERC20 aapl = new MockERC20("AAPL", "AAPL", 18);
        vm.startPrank(deployer);
        tokenRegistry.registerToken(address(aapl));
        vault.enableToken(address(aapl));
        priceOracle.setPrice(address(aapl), 200e8);
        vm.stopPrank();

        vm.startPrank(address(tradeRouter));
        uint256 first = positionManager.openPosition(1, vaultAddr, address(nvda), 1e18, 150e6, 1000e6, 100, exits);
        uint256 second = positionManager.openPosition(1, vaultAddr, address(aapl), 1e18, 200e6, 1000e6, 100, exits);
        vm.stopPrank();

        assertEq(positionManager.openPositionCountByAgent(1), 2);
        uint256[] memory openIds = positionManager.getOpenPositionIds(1);
        assertEq(openIds.length, 2);
        assertEq(openIds[0], first);
        assertEq(openIds[1], second);
    }

    function test_RevertWhen_NotTradeRouter() public {
        address caller = makeAddr("notTradeRouter");
        vm.expectRevert(abi.encodeWithSelector(PositionManager.NotTradeRouter.selector, caller));
        vm.prank(caller);
        positionManager.openPosition(
            1, vaultAddr, address(nvda), 1e18, 150e6, 1000e6, 100, new IPositionTypes.ExitRule[](0)
        );
    }
}
