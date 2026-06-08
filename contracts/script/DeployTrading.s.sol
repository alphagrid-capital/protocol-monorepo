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
/// @dev Pipeline: deploy → wire → setRoles. Set DEPLOY_MOCK_SWAP_ADAPTER=true (default) for MockSwapAdapter.
///      Vaults: FOUNDATION_VAULT, TECH_VAULT, VOLATILITY_VAULT, MACRO_VAULT (same as ConfigureVaultTracks).
contract DeployTrading is Script {
    struct Deployed {
        PositionManager positionManager;
        TradeRouter tradeRouter;
        ISwapAdapter swapAdapter;
        bool deployMock;
    }

    struct WireConfig {
        address registry;
        address allocationManager;
        address vaultTrackRegistry;
    }

    struct RoleConfig {
        address executor;
        address operator;
        address allocationManager;
    }

    function run()
        external
        returns (PositionManager positionManager, TradeRouter tradeRouter, ISwapAdapter swapAdapter)
    {
        address admin = vm.envAddress("ADMIN");
        bool deployMock = vm.envOr("DEPLOY_MOCK_SWAP_ADAPTER", true);
        address[] memory vaults = _vaultAddresses();

        WireConfig memory wireConfig = WireConfig({
            registry: vm.envAddress("AGENT_REGISTRY"),
            allocationManager: vm.envAddress("ALLOCATION_MANAGER"),
            vaultTrackRegistry: vm.envAddress("VAULT_TRACK_REGISTRY")
        });
        RoleConfig memory roleConfig = RoleConfig({
            executor: vm.envAddress("EXECUTOR"),
            operator: vm.envOr("OPERATOR", admin),
            allocationManager: wireConfig.allocationManager
        });

        vm.startBroadcast();
        Deployed memory deployed = _deploy(admin, wireConfig, deployMock);
        _wire(deployed);
        _setRoles(deployed, roleConfig, vaults);
        vm.stopBroadcast();

        positionManager = deployed.positionManager;
        tradeRouter = deployed.tradeRouter;
        swapAdapter = deployed.swapAdapter;

        _log(deployed, roleConfig, vaults);
    }

    function _deploy(address admin, WireConfig memory wireConfig, bool deployMock)
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
            AgentRegistry(wireConfig.registry),
            AllocationManager(wireConfig.allocationManager),
            deployed.positionManager,
            deployed.swapAdapter,
            VaultTrackRegistry(wireConfig.vaultTrackRegistry)
        );
    }

    function _wire(Deployed memory deployed) private {
        if (deployed.deployMock) {
            MockSwapAdapter(address(deployed.swapAdapter)).setTradeRouter(address(deployed.tradeRouter));
        } else {
            InventorySwapAdapter(address(deployed.swapAdapter)).setTradeRouter(address(deployed.tradeRouter));
        }

        deployed.positionManager.setTradeRouter(address(deployed.tradeRouter));
    }

    function _setRoles(Deployed memory deployed, RoleConfig memory roleConfig, address[] memory vaults) private {
        deployed.tradeRouter.grantRole(deployed.tradeRouter.EXECUTOR_ROLE(), roleConfig.executor);
        deployed.tradeRouter.grantRole(deployed.tradeRouter.OPERATOR_ROLE(), roleConfig.operator);

        bytes32 tradeRouterRole = MandateVault(vaults[0]).TRADE_ROUTER_ROLE();
        for (uint256 i = 0; i < vaults.length; i++) {
            MandateVault(vaults[i]).grantRole(tradeRouterRole, address(deployed.tradeRouter));
        }

        AllocationManager(roleConfig.allocationManager)
            .grantRole(
                AllocationManager(roleConfig.allocationManager).TRADE_ROUTER_ROLE(), address(deployed.tradeRouter)
            );
    }

    function _vaultAddresses() private view returns (address[] memory vaults) {
        vaults = new address[](4);
        vaults[0] = vm.envAddress("FOUNDATION_VAULT");
        vaults[1] = vm.envAddress("TECH_VAULT");
        vaults[2] = vm.envAddress("VOLATILITY_VAULT");
        vaults[3] = vm.envAddress("MACRO_VAULT");
    }

    function _log(Deployed memory deployed, RoleConfig memory roleConfig, address[] memory vaults) private pure {
        console2.log("PositionManager:", address(deployed.positionManager));
        console2.log("TradeRouter:", address(deployed.tradeRouter));
        console2.log("SwapAdapter:", address(deployed.swapAdapter));
        console2.log("MockAdapter:", deployed.deployMock);
        console2.log("Vaults:", vaults.length);
        for (uint256 i = 0; i < vaults.length; i++) {
            console2.log("  Vault:", vaults[i]);
        }
        console2.log("Operator:", roleConfig.operator);
    }
}
