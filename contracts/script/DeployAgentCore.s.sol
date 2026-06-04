// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Script, console2 } from "forge-std/Script.sol";
import { AgentRegistry } from "../src/core/AgentRegistry.sol";
import { FeeManager } from "../src/core/FeeManager.sol";
import { VaultTrackRegistry } from "../src/core/VaultTrackRegistry.sol";

/// @notice Deploys agent onboarding core: FeeManager, VaultTrackRegistry, and AgentRegistry.
/// @dev Pipeline: deploy → wire → setRoles
contract DeployAgentCore is Script {
    struct Deployed {
        FeeManager feeManager;
        VaultTrackRegistry vaultTrackRegistry;
        AgentRegistry registry;
    }

    function run()
        external
        returns (FeeManager feeManager, VaultTrackRegistry vaultTrackRegistry, AgentRegistry registry)
    {
        address admin = vm.envAddress("ADMIN");
        address treasury = vm.envAddress("TREASURY");
        address usdc = vm.envAddress("USDC");
        uint256 registrationFeeAmount = vm.envUint("REGISTRATION_FEE_AMOUNT");

        vm.startBroadcast();
        Deployed memory deployed = _deploy(admin, treasury, usdc);
        _wire(deployed, registrationFeeAmount);
        _setRoles(deployed.registry);
        vm.stopBroadcast();

        feeManager = deployed.feeManager;
        vaultTrackRegistry = deployed.vaultTrackRegistry;
        registry = deployed.registry;

        _log(deployed, admin, treasury, usdc);
    }

    function _deploy(address admin, address treasury, address usdc) private returns (Deployed memory deployed) {
        deployed.feeManager = new FeeManager(admin, treasury, usdc);
        deployed.vaultTrackRegistry = new VaultTrackRegistry(admin);

        address erc8004IdentityRegistry = vm.envAddress("ERC8004_IDENTITY_REGISTRY");
        uint256 erc8004ChainId = vm.envUint("ERC8004_CHAIN_ID");
        require(erc8004ChainId == block.chainid, "ERC8004_CHAIN_ID must equal broadcast chain");

        deployed.registry = new AgentRegistry(admin, deployed.feeManager, erc8004IdentityRegistry, erc8004ChainId);
    }

    function _wire(Deployed memory deployed, uint256 registrationFeeAmount) private {
        deployed.feeManager.setAgentRegistry(address(deployed.registry));
        deployed.registry.setVaultTrackRegistry(deployed.vaultTrackRegistry);

        if (registrationFeeAmount > 0) {
            deployed.feeManager.setRegistrationFee(registrationFeeAmount);
        }
    }

    function _setRoles(AgentRegistry registry) private {
        address backendRelayer = vm.envAddress("BACKEND_RELAYER");
        registry.grantRole(registry.REGISTRAR_ROLE(), backendRelayer);
        console2.log("REGISTRAR_ROLE granted to BACKEND_RELAYER:", backendRelayer);
    }

    function _log(Deployed memory deployed, address admin, address treasury, address usdc) private pure {
        console2.log("FeeManager:", address(deployed.feeManager));
        console2.log("VaultTrackRegistry:", address(deployed.vaultTrackRegistry));
        console2.log("AgentRegistry:", address(deployed.registry));
        console2.log("Admin:", admin);
        console2.log("Treasury:", treasury);
        console2.log("Fee asset (USDC):", usdc);
    }
}
