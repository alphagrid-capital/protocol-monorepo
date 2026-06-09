// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { VaultTrackRegistry } from "../../src/core/VaultTrackRegistry.sol";
import { IVaultTrackRegistry } from "../../src/interfaces/IVaultTrackRegistry.sol";

/// @notice Vault track policy configs (CHALLENGE / FUNDED / PRIME).
library VaultTrackPolicies {
    uint256 internal constant TRACK_CHALLENGE = 0;
    uint256 internal constant TRACK_FUNDED = 1;
    uint256 internal constant TRACK_PRIME = 2;

    function configureVault(VaultTrackRegistry registry, address vault) internal {
        registry.setVaultTrackConfig(vault, TRACK_CHALLENGE, challenge(vault));
        registry.setVaultTrackConfig(vault, TRACK_FUNDED, funded(vault));
        registry.setVaultTrackConfig(vault, TRACK_PRIME, prime(vault));
    }

    /// @dev CHALLENGE — agent onboarding + simulated capital (USDC 6 decimals).
    function challenge(address vault) internal pure returns (IVaultTrackRegistry.VaultTrackConfig memory) {
        return IVaultTrackRegistry.VaultTrackConfig({
            vault: vault,
            trackId: TRACK_CHALLENGE,
            initialAllocation: 10_000e6,
            maxAllocation: 25_000e6,
            maxDrawdownBps: 1500,
            maxTradeSizeBps: 5000,
            maxDailyTurnoverBps: 2500,
            maxDailyLossBps: 500,
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
    function funded(address vault) internal pure returns (IVaultTrackRegistry.VaultTrackConfig memory) {
        return IVaultTrackRegistry.VaultTrackConfig({
            vault: vault,
            trackId: TRACK_FUNDED,
            initialAllocation: 50_000e6,
            maxAllocation: 100_000e6,
            maxDrawdownBps: 1200,
            maxTradeSizeBps: 4000,
            maxDailyTurnoverBps: 2000,
            maxDailyLossBps: 400,
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
    function prime(address vault) internal pure returns (IVaultTrackRegistry.VaultTrackConfig memory) {
        return IVaultTrackRegistry.VaultTrackConfig({
            vault: vault,
            trackId: TRACK_PRIME,
            initialAllocation: 100_000e6,
            maxAllocation: 250_000e6,
            maxDrawdownBps: 1000,
            maxTradeSizeBps: 3000,
            maxDailyTurnoverBps: 1500,
            maxDailyLossBps: 300,
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
}
