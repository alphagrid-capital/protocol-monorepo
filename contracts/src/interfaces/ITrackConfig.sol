// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title ITrackConfig
/// @notice Global track types and per-vault track configuration for AlphaGrid.
interface ITrackConfig {
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
        uint256 maxDrawdownBps;
        uint256 maxTradeSizeBps;
        uint256 maxDailyTurnoverBps;
        uint256 evaluationPeriod;
        uint256 minTrades;
        uint256 promotionScore;
        bool active;
    }

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event TrackTypeUpdated(uint256 indexed trackId, bytes32 name, CapitalMode capitalMode, bool active);

    event VaultTrackConfigUpdated(address indexed vault, uint256 indexed trackId, VaultTrackConfig config);

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

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

    /// @notice Admin sets or updates vault track configuration.
    function setVaultTrackConfig(address vault, uint256 trackId, VaultTrackConfig calldata config) external;
}
