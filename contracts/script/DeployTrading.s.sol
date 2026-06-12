// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { console2 } from "forge-std/Script.sol";
import { InventorySwapAdapter } from "../src/adapters/InventorySwapAdapter.sol";
import { MockSwapAdapter } from "../src/adapters/MockSwapAdapter.sol";
import { AgentRegistry } from "../src/core/AgentRegistry.sol";
import { AllocationManager } from "../src/core/AllocationManager.sol";
import { PositionManager } from "../src/core/PositionManager.sol";
import { TradeRouter } from "../src/core/TradeRouter.sol";
import { TradeRouterLens } from "../src/core/TradeRouterLens.sol";
import { VaultTrackRegistry } from "../src/core/VaultTrackRegistry.sol";
import { ISwapAdapter } from "../src/interfaces/ISwapAdapter.sol";
import { MandateVault } from "../src/vaults/MandateVault.sol";
import { DeploymentEnv } from "./helpers/DeploymentEnv.sol";

/// @notice Deploys PositionManager, TradeRouter, swap adapter; wires roles to existing vault stack.
/// @dev Pipeline: deploy → wire → setRoles. Set DEPLOY_MOCK_SWAP_ADAPTER=true (default) for MockSwapAdapter.
///      Vaults: FOUNDATION_VAULT, TECH_VAULT, VOLATILITY_VAULT, MACRO_VAULT.
contract DeployTrading is DeploymentEnv {
    struct Deployed {
        PositionManager positionManager;
        TradeRouter tradeRouter;
        TradeRouterLens tradeRouterLens;
        ISwapAdapter swapAdapter;
        bool deployMock;
    }

    function run()
        external
        returns (PositionManager positionManager, TradeRouter tradeRouter, ISwapAdapter swapAdapter)
    {
        address admin = vm.envAddress("ADMIN");
        bool deployMock = vm.envOr("DEPLOY_MOCK_SWAP_ADAPTER", true);
        address[] memory vaults = vaultAddresses();
        TradingAddresses memory trading = loadTradingAddresses();

        vm.startBroadcast();
        Deployed memory deployed = _deploy(admin, trading, deployMock);
        _wire(deployed);
        _setRoles(deployed, trading, vaults);
        vm.stopBroadcast();

        positionManager = deployed.positionManager;
        tradeRouter = deployed.tradeRouter;
        swapAdapter = deployed.swapAdapter;

        _log(deployed, trading, vaults);
    }

    function _deploy(address admin, TradingAddresses memory trading, bool deployMock)
        private
        returns (Deployed memory deployed)
    {
        deployed.deployMock = deployMock;
        deployed.positionManager = new PositionManager(admin);

        if (deployMock) {
            deployed.swapAdapter = ISwapAdapter(address(new MockSwapAdapter(address(0))));
        } else {
            deployed.swapAdapter = ISwapAdapter(address(new InventorySwapAdapter(address(0))));
        }

        deployed.tradeRouter = new TradeRouter(
            admin,
            AgentRegistry(trading.agentRegistry),
            AllocationManager(trading.allocationManager),
            deployed.positionManager,
            deployed.swapAdapter,
            VaultTrackRegistry(trading.vaultTrackRegistry)
        );
        deployed.tradeRouterLens = new TradeRouterLens(
            deployed.tradeRouter, AllocationManager(trading.allocationManager), deployed.positionManager
        );
        deployed.tradeRouter.setLens(deployed.tradeRouterLens);
    }

    function _wire(Deployed memory deployed) private {
        if (deployed.deployMock) {
            MockSwapAdapter(address(deployed.swapAdapter)).setTradeRouter(address(deployed.tradeRouter));
        } else {
            InventorySwapAdapter(address(deployed.swapAdapter)).setTradeRouter(address(deployed.tradeRouter));
        }

        deployed.positionManager.setTradeRouter(address(deployed.tradeRouter));
    }

    function _setRoles(Deployed memory deployed, TradingAddresses memory trading, address[] memory vaults) private {
        deployed.tradeRouter.grantRole(deployed.tradeRouter.EXECUTOR_ROLE(), trading.executor);
        deployed.tradeRouter.grantRole(deployed.tradeRouter.OPERATOR_ROLE(), trading.operator);

        bytes32 tradeRouterRole = MandateVault(vaults[0]).TRADE_ROUTER_ROLE();
        for (uint256 i = 0; i < vaults.length; i++) {
            MandateVault(vaults[i]).grantRole(tradeRouterRole, address(deployed.tradeRouter));
        }

        AllocationManager(trading.allocationManager)
            .grantRole(AllocationManager(trading.allocationManager).TRADE_ROUTER_ROLE(), address(deployed.tradeRouter));
    }

    function _log(Deployed memory deployed, TradingAddresses memory trading, address[] memory vaults) private pure {
        console2.log("PositionManager:", address(deployed.positionManager));
        console2.log("TradeRouter:", address(deployed.tradeRouter));
        console2.log("TradeRouterLens:", address(deployed.tradeRouterLens));
        console2.log("SwapAdapter:", address(deployed.swapAdapter));
        console2.log("MockAdapter:", deployed.deployMock);
        console2.log("Vaults:", vaults.length);
        for (uint256 i = 0; i < vaults.length; i++) {
            console2.log("  Vault:", vaults[i]);
        }
        console2.log("Operator:", trading.operator);
    }
}
