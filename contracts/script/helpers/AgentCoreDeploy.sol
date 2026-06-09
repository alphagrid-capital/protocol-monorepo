// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { console2 } from "forge-std/Script.sol";
import { AgentRegistry } from "../../src/core/AgentRegistry.sol";
import { AllocationManager } from "../../src/core/AllocationManager.sol";
import { FeeManager } from "../../src/core/FeeManager.sol";
import { TokenRegistry } from "../../src/core/TokenRegistry.sol";
import { VaultTrackRegistry } from "../../src/core/VaultTrackRegistry.sol";
import { DeploymentEnv } from "./DeploymentEnv.sol";

/// @notice Shared agent-core deploy, wire, and role grants.
abstract contract AgentCoreDeploy is DeploymentEnv {
    struct AgentCoreDeployed {
        FeeManager feeManager;
        VaultTrackRegistry vaultTrackRegistry;
        TokenRegistry tokenRegistry;
        AgentRegistry registry;
        AllocationManager allocationManager;
        bool extended;
    }

    function deployAgentCore(address admin, address treasury, address usdc, bool includeExtended)
        internal
        returns (AgentCoreDeployed memory deployed)
    {
        deployed.extended = includeExtended;
        deployed.feeManager = new FeeManager(admin, treasury, usdc);
        deployed.vaultTrackRegistry = new VaultTrackRegistry(admin);

        if (includeExtended) {
            deployed.tokenRegistry = new TokenRegistry(admin);
        }

        address erc8004IdentityRegistry = vm.envAddress("ERC8004_IDENTITY_REGISTRY");
        deployed.registry = new AgentRegistry(admin, deployed.feeManager, erc8004IdentityRegistry, erc8004ChainId());

        if (includeExtended) {
            deployed.allocationManager = new AllocationManager(admin, deployed.vaultTrackRegistry);
        }
    }

    function wireAgentCore(AgentCoreDeployed memory deployed, uint256 registrationFee) internal {
        deployed.feeManager.setAgentRegistry(address(deployed.registry));
        deployed.registry.setVaultTrackRegistry(deployed.vaultTrackRegistry);

        if (deployed.extended) {
            deployed.registry.setAllocationManager(deployed.allocationManager);
            deployed.allocationManager.setAgentRegistry(address(deployed.registry));
        }

        if (registrationFee > 0) {
            deployed.feeManager.setRegistrationFee(registrationFee);
        }
    }

    function grantRegistrarRole(AgentRegistry registry, address backendRelayer) internal {
        registry.grantRole(registry.REGISTRAR_ROLE(), backendRelayer);
        console2.log("REGISTRAR_ROLE granted to BACKEND_RELAYER:", backendRelayer);
    }
}
