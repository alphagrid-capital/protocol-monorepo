// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IVaultTrackRegistry } from "../interfaces/IVaultTrackRegistry.sol";

/// @title VaultTrackRegistry
/// @notice Vault allowlist and per-vault track policy (global track types + VaultTrackConfig).
contract VaultTrackRegistry is IVaultTrackRegistry, AccessControl {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    bytes32 public constant CONFIG_ADMIN_ROLE = keccak256("CONFIG_ADMIN_ROLE");

    uint256 public constant MAX_TRACK_ID = 2;
    uint256 public constant MAX_BPS = 10_000;

    bytes32 private constant NAME_CHALLENGE = "CHALLENGE";
    bytes32 private constant NAME_FUNDED = "FUNDED";
    bytes32 private constant NAME_PRIME = "PRIME";

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    address[] private _vaults;
    mapping(address => bool) private _isRegisteredVault;

    mapping(uint256 trackId => TrackType) private _trackTypes;
    mapping(address vault => mapping(uint256 trackId => VaultTrackConfig)) private _vaultTrackConfigs;

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error InvalidTrackId(uint256 trackId);
    error BpsOutOfRange(uint256 bps);
    error AllocationOutOfRange(uint256 initialAllocation, uint256 maxAllocation);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param admin Receives `DEFAULT_ADMIN_ROLE` and `CONFIG_ADMIN_ROLE`.
    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(CONFIG_ADMIN_ROLE, admin);

        _trackTypes[0] =
            TrackType({ trackId: 0, name: NAME_CHALLENGE, capitalMode: CapitalMode.Simulated, active: true });
        _trackTypes[1] = TrackType({ trackId: 1, name: NAME_FUNDED, capitalMode: CapitalMode.Real, active: true });
        _trackTypes[2] = TrackType({ trackId: 2, name: NAME_PRIME, capitalMode: CapitalMode.Real, active: true });

        emit TrackTypeUpdated(0, NAME_CHALLENGE, CapitalMode.Simulated, true);
        emit TrackTypeUpdated(1, NAME_FUNDED, CapitalMode.Real, true);
        emit TrackTypeUpdated(2, NAME_PRIME, CapitalMode.Real, true);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @inheritdoc IVaultTrackRegistry
    function setVaultTrackConfig(address vault, uint256 trackId, VaultTrackConfig calldata config)
        external
        onlyRole(CONFIG_ADMIN_ROLE)
    {
        if (vault == address(0)) revert ZeroAddress();
        _validateTrackId(trackId);
        _validateBps(config.maxDrawdownBps);
        _validateBps(config.maxTradeSizeBps);
        _validateBps(config.maxDailyTurnoverBps);
        _validateBps(config.maxDailyLossBps);
        _validateBps(config.maxStopLossBps);
        _validateBps(config.minTakeProfitBps);
        _validateBps(config.maxTakeProfitBps);
        if (config.initialAllocation > config.maxAllocation) {
            revert AllocationOutOfRange(config.initialAllocation, config.maxAllocation);
        }

        _registerVaultIfNeeded(vault);

        VaultTrackConfig memory stored = VaultTrackConfig({
            vault: vault,
            trackId: trackId,
            initialAllocation: config.initialAllocation,
            maxAllocation: config.maxAllocation,
            maxDrawdownBps: config.maxDrawdownBps,
            maxTradeSizeBps: config.maxTradeSizeBps,
            maxDailyTurnoverBps: config.maxDailyTurnoverBps,
            maxDailyLossBps: config.maxDailyLossBps,
            evaluationPeriod: config.evaluationPeriod,
            minTrades: config.minTrades,
            promotionScore: config.promotionScore,
            active: config.active,
            maxStopLossBps: config.maxStopLossBps,
            minTakeProfitBps: config.minTakeProfitBps,
            maxTakeProfitBps: config.maxTakeProfitBps,
            requireStopLoss: config.requireStopLoss,
            requireTakeProfit: config.requireTakeProfit
        });

        _vaultTrackConfigs[vault][trackId] = stored;
        emit VaultTrackConfigUpdated(vault, trackId, stored);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @inheritdoc IVaultTrackRegistry
    function vaultCount() external view returns (uint256) {
        return _vaults.length;
    }

    /// @inheritdoc IVaultTrackRegistry
    function vaultAt(uint256 index) external view returns (address) {
        return _vaults[index];
    }

    /// @inheritdoc IVaultTrackRegistry
    function isRegisteredVault(address vault) external view returns (bool) {
        return _isRegisteredVault[vault];
    }

    /// @inheritdoc IVaultTrackRegistry
    function getTrackType(uint256 trackId) external view returns (TrackType memory) {
        _validateTrackId(trackId);
        return _trackTypes[trackId];
    }

    /// @inheritdoc IVaultTrackRegistry
    function getVaultTrackConfig(address vault, uint256 trackId) external view returns (VaultTrackConfig memory) {
        _validateTrackId(trackId);
        return _vaultTrackConfigs[vault][trackId];
    }

    /// @inheritdoc IVaultTrackRegistry
    function isVaultTrackActive(address vault, uint256 trackId) external view returns (bool) {
        if (vault == address(0)) return false;
        if (trackId > MAX_TRACK_ID) return false;
        return _vaultTrackConfigs[vault][trackId].active;
    }

    /// @inheritdoc IVaultTrackRegistry
    function capitalModeOf(address vault, uint256 trackId) external view returns (CapitalMode) {
        vault;
        _validateTrackId(trackId);
        return _trackTypes[trackId].capitalMode;
    }

    // -------------------------------------------------------------------------
    // Private Functions
    // -------------------------------------------------------------------------

    function _registerVaultIfNeeded(address vault) private {
        if (_isRegisteredVault[vault]) return;
        _isRegisteredVault[vault] = true;
        _vaults.push(vault);
        emit VaultRegistered(vault);
    }

    /// @dev Ensures `trackId` is within the MVP range.
    function _validateTrackId(uint256 trackId) private pure {
        if (trackId > MAX_TRACK_ID) revert InvalidTrackId(trackId);
    }

    /// @dev Ensures basis-point values do not exceed 100%.
    function _validateBps(uint256 bps) private pure {
        if (bps > MAX_BPS) revert BpsOutOfRange(bps);
    }
}
