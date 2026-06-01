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
    bytes32 private constant MANDATE_FOUNDATION = "FOUNDATION";
    bytes32 private constant MANDATE_TECH = "TECH";
    bytes32 private constant MANDATE_VOLATILITY = "VOLATILITY";
    bytes32 private constant MANDATE_MACRO = "MACRO";
    struct AgentCore {
        FeeManager feeManager;
        VaultTrackRegistry vaultTrackRegistry;
        TokenRegistry tokenRegistry;
        AgentRegistry registry;
        AllocationManager allocationManager;
    }

    struct VaultSet {
        MandateVaultFactory factory;
        MandateVault foundationVault;
        MandateVault techVault;
        MandateVault volatilityVault;
        MandateVault macroVault;
    }

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
        AgentCore memory core = _deployAgentCore(admin, treasury, usdc);
        VaultSet memory vaults = _deployVaults(usdc, core.tokenRegistry, admin, treasury);
        _wire(core);
        vm.stopBroadcast();

        feeManager = core.feeManager;
        vaultTrackRegistry = core.vaultTrackRegistry;
        tokenRegistry = core.tokenRegistry;
        registry = core.registry;
        allocationManager = core.allocationManager;
        vaultFactory = vaults.factory;
        foundationVault = vaults.foundationVault;
        techVault = vaults.techVault;
        volatilityVault = vaults.volatilityVault;
        macroVault = vaults.macroVault;

        _log(core, vaults);
    }

    function _deployAgentCore(address admin, address treasury, address usdc)
        private
        returns (AgentCore memory core)
    {
        core.feeManager = new FeeManager(admin, treasury, usdc);
        core.vaultTrackRegistry = new VaultTrackRegistry(admin);
        core.tokenRegistry = new TokenRegistry(admin);
        address erc8004IdentityRegistry = vm.envAddress("ERC8004_IDENTITY_REGISTRY");
        uint256 erc8004ChainId = vm.envOr("ERC8004_CHAIN_ID", block.chainid);
        core.registry = new AgentRegistry(admin, core.feeManager, erc8004IdentityRegistry, erc8004ChainId);
        core.allocationManager = new AllocationManager(admin, core.vaultTrackRegistry);
    }

    function _deployVaults(address usdc, TokenRegistry tokenRegistry_, address admin, address treasury)
        private
        returns (VaultSet memory vaults)
    {
        IERC20 asset = IERC20(usdc);
        vaults.factory = new MandateVaultFactory(address(0), asset);
        vaults.foundationVault = _deployVault(
            vaults.factory,
            asset,
            tokenRegistry_,
            admin,
            treasury,
            "AlphaGrid Foundation Vault",
            "agFND",
            MANDATE_FOUNDATION
        );
        vaults.techVault = _deployVault(
            vaults.factory, asset, tokenRegistry_, admin, treasury, "AlphaGrid Tech Vault", "agTECH", MANDATE_TECH
        );
        vaults.volatilityVault = _deployVault(
            vaults.factory,
            asset,
            tokenRegistry_,
            admin,
            treasury,
            "AlphaGrid Volatility Vault",
            "agVOL",
            MANDATE_VOLATILITY
        );
        vaults.macroVault = _deployVault(
            vaults.factory, asset, tokenRegistry_, admin, treasury, "AlphaGrid Macro Vault", "agMAC", MANDATE_MACRO
        );
    }

    function _wire(AgentCore memory core) private {
        core.feeManager.setAgentRegistry(address(core.registry));
        core.registry.setVaultTrackRegistry(core.vaultTrackRegistry);
        core.registry.setAllocationManager(core.allocationManager);
        core.allocationManager.setAgentRegistry(address(core.registry));
    }

    function _log(AgentCore memory core, VaultSet memory vaults) private view {
        console2.log("FeeManager:", address(core.feeManager));
        console2.log("VaultTrackRegistry:", address(core.vaultTrackRegistry));
        console2.log("TokenRegistry:", address(core.tokenRegistry));
        console2.log("AgentRegistry:", address(core.registry));
        console2.log("AllocationManager:", address(core.allocationManager));
        console2.log("VaultFactory:", address(vaults.factory));
        console2.log("VaultImplementation:", vaults.factory.implementation());
        console2.log("FoundationVault:", address(vaults.foundationVault));
        console2.log("TechVault:", address(vaults.techVault));
        console2.log("VolatilityVault:", address(vaults.volatilityVault));
        console2.log("MacroVault:", address(vaults.macroVault));
    }

    function _deployVault(
        MandateVaultFactory factory,
        IERC20 asset,
        TokenRegistry tokenRegistry_,
        address admin,
        address treasury,
        string memory shareName,
        string memory shareSymbol,
        bytes32 mandate
    ) private returns (MandateVault vault) {
        vault = MandateVault(
            factory.deployVault(
                IMandateVaultFactory.VaultDeploymentConfig({
                    asset: asset,
                    shareName: shareName,
                    shareSymbol: shareSymbol,
                    mandate: mandate,
                    tokenRegistry: tokenRegistry_,
                    admin: admin,
                    feeRecipient: treasury
                })
            )
        );
    }
}
