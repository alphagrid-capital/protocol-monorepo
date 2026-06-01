// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Script, console2 } from "forge-std/Script.sol";
import { InventorySwapAdapter } from "../src/adapters/InventorySwapAdapter.sol";
import { MockSwapAdapter } from "../src/adapters/MockSwapAdapter.sol";
import { AgentRegistry } from "../src/core/AgentRegistry.sol";
import { AllocationManager } from "../src/core/AllocationManager.sol";
import { PositionManager } from "../src/core/PositionManager.sol";
import { TradeRouter } from "../src/core/TradeRouter.sol";
import { VaultTrackRegistry } from "../src/core/VaultTrackRegistry.sol";
import { ISwapAdapter } from "../src/interfaces/ISwapAdapter.sol";
import { MandateVault } from "../src/vaults/MandateVault.sol";

/// @notice Deploys PositionManager, TradeRouter, swap adapter; wires roles to existing vault stack.
/// @dev Set DEPLOY_MOCK_SWAP_ADAPTER=true (default) for MockSwapAdapter, false for InventorySwapAdapter.
contract DeployTrading is Script {
    function run()
        external
        returns (PositionManager positionManager, TradeRouter tradeRouter, ISwapAdapter swapAdapter)
    {
        address admin = vm.envAddress("ADMIN");
        address executor = vm.envAddress("EXECUTOR");
        address operator = vm.envOr("OPERATOR", admin);
        address registry = vm.envAddress("AGENT_REGISTRY");
        address allocationManager = vm.envAddress("ALLOCATION_MANAGER");
        address trackConfig = vm.envAddress("TRACK_CONFIG");
        address vault = vm.envAddress("VAULT");
        bool deployMock = vm.envOr("DEPLOY_MOCK_SWAP_ADAPTER", true);

        vm.startBroadcast();

        positionManager = new PositionManager(admin);

        if (deployMock) {
            MockSwapAdapter mock = new MockSwapAdapter(address(0));
            swapAdapter = ISwapAdapter(address(mock));
        } else {
            InventorySwapAdapter inventory = new InventorySwapAdapter(address(0));
            swapAdapter = ISwapAdapter(address(inventory));
        }

        tradeRouter = new TradeRouter(
            admin,
            AgentRegistry(registry),
            AllocationManager(allocationManager),
            positionManager,
            swapAdapter,
            VaultTrackRegistry(trackConfig)
        );

        if (deployMock) {
            MockSwapAdapter(address(swapAdapter)).setTradeRouter(address(tradeRouter));
        } else {
            InventorySwapAdapter(address(swapAdapter)).setTradeRouter(address(tradeRouter));
        }

        positionManager.setTradeRouter(address(tradeRouter));
        tradeRouter.grantRole(tradeRouter.EXECUTOR_ROLE(), executor);
        tradeRouter.grantRole(tradeRouter.OPERATOR_ROLE(), operator);

        MandateVault(vault).grantRole(MandateVault(vault).TRADE_ROUTER_ROLE(), address(tradeRouter));
        AllocationManager(allocationManager)
            .grantRole(AllocationManager(allocationManager).TRADE_ROUTER_ROLE(), address(tradeRouter));

        vm.stopBroadcast();

        console2.log("PositionManager:", address(positionManager));
        console2.log("TradeRouter:", address(tradeRouter));
        console2.log("SwapAdapter:", address(swapAdapter));
        console2.log("MockAdapter:", deployMock);
        console2.log("Vault:", vault);
        console2.log("Operator:", operator);
    }
}
