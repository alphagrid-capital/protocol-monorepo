// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Script, console2 } from "forge-std/Script.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { AgentRegistry } from "../src/core/AgentRegistry.sol";
import { AllocationManager } from "../src/core/AllocationManager.sol";
import { FeeManager } from "../src/core/FeeManager.sol";
import { TokenRegistry } from "../src/core/TokenRegistry.sol";
import { VaultTrackRegistry } from "../src/core/VaultTrackRegistry.sol";
import { IMandateVaultFactory } from "../src/interfaces/IMandateVaultFactory.sol";
import { MandateVault } from "../src/vaults/MandateVault.sol";
import { MandateVaultFactory } from "../src/vaults/MandateVaultFactory.sol";

/// @notice Greenfield deploy: agent core, token registry, four vault clones, and AllocationManager wiring.
contract DeployVaultInfrastructure is Script {
    function run()
        external
        returns (
            FeeManager feeManager,
            VaultTrackRegistry vaultTrackRegistry,
            TokenRegistry tokenRegistry,
            AgentRegistry registry,
            AllocationManager allocationManager,
            MandateVaultFactory vaultFactory,
            MandateVault foundationVault,
            MandateVault techVault,
            MandateVault volatilityVault,
            MandateVault macroVault
        )
    {
        address admin = vm.envAddress("ADMIN");
        address treasury = vm.envAddress("TREASURY");
        address usdc = vm.envAddress("USDC");
        vm.startBroadcast();

        feeManager = new FeeManager(admin, treasury, usdc);
        vaultTrackRegistry = new VaultTrackRegistry(admin);
        tokenRegistry = new TokenRegistry(admin);
        registry = new AgentRegistry(admin, feeManager);
        allocationManager = new AllocationManager(admin, vaultTrackRegistry);

        vaultFactory = new MandateVaultFactory(address(0), IERC20(usdc));

        foundationVault = MandateVault(
            vaultFactory.deployVault(
                IMandateVaultFactory.VaultDeploymentConfig({
                    asset: IERC20(usdc),
                    shareName: "AlphaGrid Foundation Vault",
                    shareSymbol: "agFND",
                    mandate: "FOUNDATION",
                    tokenRegistry: tokenRegistry,
                    admin: admin,
                    feeRecipient: treasury
                })
            )
        );
        techVault = MandateVault(
            vaultFactory.deployVault(
                IMandateVaultFactory.VaultDeploymentConfig({
                    asset: IERC20(usdc),
                    shareName: "AlphaGrid Tech Vault",
                    shareSymbol: "agTECH",
                    mandate: "TECH",
                    tokenRegistry: tokenRegistry,
                    admin: admin,
                    feeRecipient: treasury
                })
            )
        );
        volatilityVault = MandateVault(
            vaultFactory.deployVault(
                IMandateVaultFactory.VaultDeploymentConfig({
                    asset: IERC20(usdc),
                    shareName: "AlphaGrid Volatility Vault",
                    shareSymbol: "agVOL",
                    mandate: "VOLATILITY",
                    tokenRegistry: tokenRegistry,
                    admin: admin,
                    feeRecipient: treasury
                })
            )
        );
        macroVault = MandateVault(
            vaultFactory.deployVault(
                IMandateVaultFactory.VaultDeploymentConfig({
                    asset: IERC20(usdc),
                    shareName: "AlphaGrid Macro Vault",
                    shareSymbol: "agMAC",
                    mandate: "MACRO",
                    tokenRegistry: tokenRegistry,
                    admin: admin,
                    feeRecipient: treasury
                })
            )
        );

        feeManager.setAgentRegistry(address(registry));
        registry.setVaultTrackRegistry(vaultTrackRegistry);
        registry.setAllocationManager(allocationManager);
        allocationManager.setAgentRegistry(address(registry));

        vm.stopBroadcast();

        console2.log("FeeManager:", address(feeManager));
        console2.log("VaultTrackRegistry:", address(vaultTrackRegistry));
        console2.log("TokenRegistry:", address(tokenRegistry));
        console2.log("AgentRegistry:", address(registry));
        console2.log("AllocationManager:", address(allocationManager));
        console2.log("VaultFactory:", address(vaultFactory));
        console2.log("VaultImplementation:", vaultFactory.implementation());
        console2.log("FoundationVault:", address(foundationVault));
        console2.log("TechVault:", address(techVault));
        console2.log("VolatilityVault:", address(volatilityVault));
        console2.log("MacroVault:", address(macroVault));
    }
}
