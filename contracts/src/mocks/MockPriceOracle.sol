// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IPriceFeed } from "../interfaces/IPriceFeed.sol";

/// @title MockPriceOracle
/// @notice Single contract holding mock prices for all tradable ERC20 assets.
contract MockPriceOracle is IPriceFeed, AccessControl {
    // -------------------------------------------------------------------------
    // Types
    // -------------------------------------------------------------------------

    struct PriceSnapshot {
        int256 price;
        uint256 updatedAt;
        uint8 feedDecimals;
        bool set;
    }

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    bytes32 public constant ORACLE_UPDATER_ROLE = keccak256("ORACLE_UPDATER_ROLE");
    uint8 public constant DEFAULT_FEED_DECIMALS = 8;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    mapping(address asset => PriceSnapshot snapshot) private _snapshots;

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error TokenNotQuoted(address asset);
    error LengthMismatch();

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param admin Receives `DEFAULT_ADMIN_ROLE` and `ORACLE_UPDATER_ROLE`.
    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ORACLE_UPDATER_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    function setPrice(address asset, int256 price) external onlyRole(ORACLE_UPDATER_ROLE) {
        if (asset == address(0)) revert ZeroAddress();
        PriceSnapshot storage snap = _snapshots[asset];
        snap.price = price;
        snap.updatedAt = block.timestamp;
        if (!snap.set) {
            snap.feedDecimals = DEFAULT_FEED_DECIMALS;
            snap.set = true;
        }
    }

    function setPrices(address[] calldata assets, int256[] calldata prices) external onlyRole(ORACLE_UPDATER_ROLE) {
        if (assets.length != prices.length) revert LengthMismatch();
        uint256 len = assets.length;
        for (uint256 i = 0; i < len; i++) {
            address asset = assets[i];
            if (asset == address(0)) revert ZeroAddress();
            PriceSnapshot storage snap = _snapshots[asset];
            snap.price = prices[i];
            snap.updatedAt = block.timestamp;
            if (!snap.set) {
                snap.feedDecimals = DEFAULT_FEED_DECIMALS;
                snap.set = true;
            }
        }
    }

    /// @dev Test helper to simulate stale prices without changing the quote.
    function setUpdatedAt(address asset, uint256 updatedAt_) external onlyRole(ORACLE_UPDATER_ROLE) {
        _requireQuoted(asset).updatedAt = updatedAt_;
    }

    // -------------------------------------------------------------------------
    // Views — IPriceFeed
    // -------------------------------------------------------------------------

    function latestRoundData(address asset)
        external
        view
        returns (uint80 roundId, int256 answer, uint256 startedAt, uint256 updatedAt, uint80 answeredInRound)
    {
        PriceSnapshot storage snap = _requireQuoted(asset);
        roundId = 1;
        answer = snap.price;
        startedAt = snap.updatedAt;
        updatedAt = snap.updatedAt;
        answeredInRound = 1;
    }

    function decimals(address asset) external view returns (uint8) {
        return _requireQuoted(asset).feedDecimals;
    }

    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------

    function _requireQuoted(address asset) private view returns (PriceSnapshot storage snap) {
        snap = _snapshots[asset];
        if (!snap.set) revert TokenNotQuoted(asset);
    }
}
