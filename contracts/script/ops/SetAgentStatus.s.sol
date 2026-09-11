// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { console2 } from "forge-std/Script.sol";
import { AgentRegistry } from "../../src/core/AgentRegistry.sol";
import { IAgentRegistry } from "../../src/interfaces/IAgentRegistry.sol";
import { DeploymentEnv } from "../helpers/DeploymentEnv.sol";

/// @notice Sets an agent's lifecycle status (default: Suspended — disables new opens
///         and API/MCP intent relay for that agent).
/// @dev Broadcaster needs AgentRegistry.OPERATOR_ROLE. Env:
///      - AGENT_REGISTRY
///      - AGENT_ID
///      - AGENT_STATUS (optional uint8; default 2 = Suspended)
///        0 Draft, 1 Active, 2 Suspended, 3 Failed, 4 Graduated, 5 Exited
///
///      forge script script/ops/SetAgentStatus.s.sol:SetAgentStatus \
///        --rpc-url $RPC_URL --broadcast
contract SetAgentStatus is DeploymentEnv {
    function run() external {
        AgentRegistry registry = AgentRegistry(vm.envAddress("AGENT_REGISTRY"));
        uint256 agentId = vm.envUint("AGENT_ID");
        uint8 statusRaw = uint8(vm.envOr("AGENT_STATUS", uint256(2)));
        require(statusRaw <= uint8(IAgentRegistry.AgentStatus.Exited), "invalid AGENT_STATUS");

        IAgentRegistry.AgentStatus status = IAgentRegistry.AgentStatus(statusRaw);
        IAgentRegistry.Agent memory before_ = registry.getAgent(agentId);

        vm.startBroadcast();
        registry.setAgentStatus(agentId, status);
        vm.stopBroadcast();

        IAgentRegistry.Agent memory after_ = registry.getAgent(agentId);
        console2.log("AgentRegistry:", address(registry));
        console2.log("Agent id:", agentId);
        console2.log("Name:", after_.name);
        console2.log("Owner:", after_.owner);
        console2.log("Status before:", uint8(before_.status));
        console2.log("Status after:", uint8(after_.status));
    }
}
