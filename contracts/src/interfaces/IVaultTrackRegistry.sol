// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title IVaultTrackRegistry
/// @notice Vault allowlist and per-vault track policy for AlphaGrid.
interface IVaultTrackRegistry {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    /// @notice Whether a track uses simulated or real vault capital.
    enum CapitalMode {
        Simulated,
        Real
    }

    /// @notice Global track type definition (lifecycle stage).
    struct TrackType {
        uint256 trackId;
        bytes32 name;
        CapitalMode capitalMode;
        bool active;
    }

    /// @notice Per-vault parameters for a track stage. Promotion criteria are stored for off-chain use.
    struct VaultTrackConfig {
        address vault;
        uint256 trackId;
        uint256 initialAllocation;
        uint256 maxAllocation;
        /// @notice Account-level failure threshold in bps; off-chain risk engine in MVP (not ladder validation).
        uint256 maxDrawdownBps;
        uint256 maxTradeSizeBps;
        uint256 maxDailyTurnoverBps;
        /// @notice Max realized daily loss as bps of allocation cap; 0 = disabled. Enforced in TradeRouter.
        uint256 maxDailyLossBps;
        uint256 evaluationPeriod;
        uint256 minTrades;
        uint256 promotionScore;
        bool active;
        /// @notice Max per-position stop-loss magnitude in bps; 0 = no cap. Independent of maxDrawdownBps.
        uint256 maxStopLossBps;
        /// @notice Minimum take-profit trigger in bps; 0 = no floor.
        uint256 minTakeProfitBps;
        /// @notice Maximum take-profit trigger in bps; 0 = no cap.
        uint256 maxTakeProfitBps;
        /// @notice When true, exit ladders must include at least one StopLoss rule.
        bool requireStopLoss;
        /// @notice When true, exit ladders must include at least one TakeProfit rule.
        bool requireTakeProfit;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event TrackTypeUpdated(uint256 indexed trackId, bytes32 name, CapitalMode capitalMode, bool active);

    event VaultRegistered(address indexed vault);

    event VaultTrackConfigUpdated(address indexed vault, uint256 indexed trackId, VaultTrackConfig config);

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @notice Returns the number of registered vaults.
    function vaultCount() external view returns (uint256);

    /// @notice Returns the vault address at `index` in registration order.
    function vaultAt(uint256 index) external view returns (address);

    /// @notice Returns whether `vault` has been registered via track configuration.
    function isRegisteredVault(address vault) external view returns (bool);

    /// @notice Returns the global track type for `trackId`.
    function getTrackType(uint256 trackId) external view returns (TrackType memory);

    /// @notice Returns the vault-specific configuration for `(vault, trackId)`.
    function getVaultTrackConfig(address vault, uint256 trackId) external view returns (VaultTrackConfig memory);

    /// @notice Returns whether `(vault, trackId)` has an active configuration.
    function isVaultTrackActive(address vault, uint256 trackId) external view returns (bool);

    /// @notice Returns the capital mode for the track type bound to `(vault, trackId)`.
    function capitalModeOf(address vault, uint256 trackId) external view returns (CapitalMode);

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Admin sets or updates vault track configuration; auto-registers vault on first write.
    function setVaultTrackConfig(address vault, uint256 trackId, VaultTrackConfig calldata config) external;
}
