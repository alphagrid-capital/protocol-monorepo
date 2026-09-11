// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { console2 } from "forge-std/Script.sol";
import { AgentRegistry } from "../../src/core/AgentRegistry.sol";
import { TradeRouter } from "../../src/core/TradeRouter.sol";
import { DeploymentEnv } from "../helpers/DeploymentEnv.sol";

/// @notice Grants `OPERATOR_ROLE` on AgentRegistry (and optionally TradeRouter).
/// @dev Broadcaster needs `DEFAULT_ADMIN_ROLE` on each target. Set `AGENT_REGISTRY`
///      and `OPERATOR` (address to grant). Optional `TRADE_ROUTER` also grants
///      TradeRouter.OPERATOR_ROLE (needed for `forceClose`).
///
///      forge script script/ops/GrantOperatorRole.s.sol:GrantOperatorRole \
///        --rpc-url $RPC_URL --broadcast
contract GrantOperatorRole is DeploymentEnv {
    function run() external {
        AgentRegistry registry = AgentRegistry(vm.envAddress("AGENT_REGISTRY"));
        address operator = vm.envAddress("OPERATOR");
        address tradeRouterAddr = vm.envOr("TRADE_ROUTER", address(0));

        bytes32 role = registry.OPERATOR_ROLE();

        vm.startBroadcast();
        if (!registry.hasRole(role, operator)) {
            registry.grantRole(role, operator);
            console2.log("Granted AgentRegistry.OPERATOR_ROLE to", operator);
        } else {
            console2.log("Skip AgentRegistry (already has role):", operator);
        }

        if (tradeRouterAddr != address(0)) {
            TradeRouter tradeRouter = TradeRouter(tradeRouterAddr);
            bytes32 tradeRole = tradeRouter.OPERATOR_ROLE();
            if (!tradeRouter.hasRole(tradeRole, operator)) {
                tradeRouter.grantRole(tradeRole, operator);
                console2.log("Granted TradeRouter.OPERATOR_ROLE to", operator);
            } else {
                console2.log("Skip TradeRouter (already has role):", operator);
            }
        }
        vm.stopBroadcast();

        console2.log("AgentRegistry:", address(registry));
        if (tradeRouterAddr != address(0)) {
            console2.log("TradeRouter:", tradeRouterAddr);
        }
        console2.log("Operator:", operator);
    }
}
