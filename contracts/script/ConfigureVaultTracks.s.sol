// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Script, console2 } from "forge-std/Script.sol";
import { VaultTrackRegistry } from "../src/core/VaultTrackRegistry.sol";
import { IVaultTrackRegistry } from "../src/interfaces/IVaultTrackRegistry.sol";

/// @notice Registers all mandate vaults in VaultTrackRegistry and applies the same track policy on each.
/// @dev Pipeline: configure (single step). Broadcaster needs CONFIG_ADMIN_ROLE. Edit caps/bps below before mainnet.
contract ConfigureVaultTracks is Script {
    uint256 private constant TRACK_CHALLENGE = 0;
    uint256 private constant TRACK_FUNDED = 1;
    uint256 private constant TRACK_PRIME = 2;

    function run() external {
        VaultTrackRegistry registry = VaultTrackRegistry(vm.envAddress("VAULT_TRACK_REGISTRY"));
        address[] memory vaults = _vaultAddresses();

        vm.startBroadcast();
        for (uint256 i = 0; i < vaults.length; i++) {
            _configureVault(registry, vaults[i]);
        }
        vm.stopBroadcast();

        console2.log("VaultTrackRegistry:", address(registry));
        console2.log("Vaults configured:", vaults.length);
    }

    function _configureVault(VaultTrackRegistry registry, address vault) private {
        registry.setVaultTrackConfig(vault, TRACK_CHALLENGE, _challengeConfig(vault));
        registry.setVaultTrackConfig(vault, TRACK_FUNDED, _fundedConfig(vault));
        registry.setVaultTrackConfig(vault, TRACK_PRIME, _primeConfig(vault));
        console2.log("Configured tracks 0-2 for vault:", vault);
    }

    /// @dev CHALLENGE — agent onboarding + simulated capital (USDC 6 decimals).
    function _challengeConfig(address vault) private pure returns (IVaultTrackRegistry.VaultTrackConfig memory) {
        return IVaultTrackRegistry.VaultTrackConfig({
            vault: vault,
            trackId: TRACK_CHALLENGE,
            initialAllocation: 10_000e6,
            maxAllocation: 25_000e6,
            maxDrawdownBps: 1500,
            maxTradeSizeBps: 5000,
            maxDailyTurnoverBps: 2500,
            evaluationPeriod: 14 days,
            minTrades: 5,
            promotionScore: 70,
            active: true,
            maxStopLossBps: 1500,
            minTakeProfitBps: 0,
            maxTakeProfitBps: 10_000,
            requireStopLoss: true,
            requireTakeProfit: false
        });
    }

    /// @dev FUNDED — first real-capital promotion target.
    function _fundedConfig(address vault) private pure returns (IVaultTrackRegistry.VaultTrackConfig memory) {
        return IVaultTrackRegistry.VaultTrackConfig({
            vault: vault,
            trackId: TRACK_FUNDED,
            initialAllocation: 50_000e6,
            maxAllocation: 100_000e6,
            maxDrawdownBps: 1200,
            maxTradeSizeBps: 4000,
            maxDailyTurnoverBps: 2000,
            evaluationPeriod: 30 days,
            minTrades: 10,
            promotionScore: 75,
            active: true,
            maxStopLossBps: 1200,
            minTakeProfitBps: 200,
            maxTakeProfitBps: 8000,
            requireStopLoss: true,
            requireTakeProfit: true
        });
    }

    /// @dev PRIME — top track; tighten risk vs FUNDED.
    function _primeConfig(address vault) private pure returns (IVaultTrackRegistry.VaultTrackConfig memory) {
        return IVaultTrackRegistry.VaultTrackConfig({
            vault: vault,
            trackId: TRACK_PRIME,
            initialAllocation: 100_000e6,
            maxAllocation: 250_000e6,
            maxDrawdownBps: 1000,
            maxTradeSizeBps: 3000,
            maxDailyTurnoverBps: 1500,
            evaluationPeriod: 60 days,
            minTrades: 20,
            promotionScore: 80,
            active: true,
            maxStopLossBps: 1000,
            minTakeProfitBps: 500,
            maxTakeProfitBps: 5000,
            requireStopLoss: true,
            requireTakeProfit: true
        });
    }

    function _vaultAddresses() private view returns (address[] memory vaults) {
        vaults = new address[](4);
        vaults[0] = vm.envAddress("FOUNDATION_VAULT");
        vaults[1] = vm.envAddress("TECH_VAULT");
        vaults[2] = vm.envAddress("VOLATILITY_VAULT");
        vaults[3] = vm.envAddress("MACRO_VAULT");
    }
}
