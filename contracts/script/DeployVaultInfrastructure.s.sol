// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Script, console2 } from "forge-std/Script.sol";
import { AgentRegistry } from "../src/core/AgentRegistry.sol";
import { FeeManager } from "../src/core/FeeManager.sol";
import { TrackConfig } from "../src/core/TrackConfig.sol";
import { AllocationManager } from "../src/core/AllocationManager.sol";
import { TokenRegistry } from "../src/core/TokenRegistry.sol";
import { AlphaGridVault } from "../src/vaults/AlphaGridVault.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Greenfield deploy: agent core, token registry, four vaults, and AllocationManager wiring.
contract DeployVaultInfrastructure is Script {
    function run()
        external
        returns (
            FeeManager feeManager,
            TrackConfig trackConfig,
            TokenRegistry tokenRegistry,
            AgentRegistry registry,
            AllocationManager allocationManager,
            AlphaGridVault foundationVault,
            AlphaGridVault techVault,
            AlphaGridVault volatilityVault,
            AlphaGridVault macroVault
        )
    {
        address admin = vm.envAddress("ADMIN");
        address treasury = vm.envAddress("TREASURY");
        address usdc = vm.envAddress("USDC");

        vm.startBroadcast();

        feeManager = new FeeManager(admin, treasury, usdc);
        trackConfig = new TrackConfig(admin);
        tokenRegistry = new TokenRegistry(admin);
        registry = new AgentRegistry(admin, feeManager);
        allocationManager = new AllocationManager(admin, trackConfig);

        foundationVault =
            new AlphaGridVault(IERC20(usdc), "AlphaGrid Foundation Vault", "agFND", "FOUNDATION", tokenRegistry, admin);
        techVault = new AlphaGridVault(IERC20(usdc), "AlphaGrid Tech Vault", "agTECH", "TECH", tokenRegistry, admin);
        volatilityVault =
            new AlphaGridVault(IERC20(usdc), "AlphaGrid Volatility Vault", "agVOL", "VOLATILITY", tokenRegistry, admin);
        macroVault = new AlphaGridVault(IERC20(usdc), "AlphaGrid Macro Vault", "agMAC", "MACRO", tokenRegistry, admin);

        foundationVault.setFeeRecipient(treasury);
        techVault.setFeeRecipient(treasury);
        volatilityVault.setFeeRecipient(treasury);
        macroVault.setFeeRecipient(treasury);

        feeManager.setAgentRegistry(address(registry));
        registry.setTrackConfig(trackConfig);
        registry.setAllocationManager(allocationManager);
        allocationManager.setAgentRegistry(address(registry));

        vm.stopBroadcast();

        console2.log("FeeManager:", address(feeManager));
        console2.log("TrackConfig:", address(trackConfig));
        console2.log("TokenRegistry:", address(tokenRegistry));
        console2.log("AgentRegistry:", address(registry));
        console2.log("AllocationManager:", address(allocationManager));
        console2.log("FoundationVault:", address(foundationVault));
        console2.log("TechVault:", address(techVault));
        console2.log("VolatilityVault:", address(volatilityVault));
        console2.log("MacroVault:", address(macroVault));
    }
}
