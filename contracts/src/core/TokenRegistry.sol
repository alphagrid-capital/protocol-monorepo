// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { ITokenRegistry } from "../interfaces/ITokenRegistry.sol";

/// @title TokenRegistry
/// @notice Canonical token and oracle feed catalog shared across AlphaGrid vaults.
contract TokenRegistry is ITokenRegistry, AccessControl {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    bytes32 public constant REGISTRY_ADMIN_ROLE = keccak256("REGISTRY_ADMIN_ROLE");

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    address[] private _tokens;
    mapping(address token => TokenConfig config) private _configs;

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error TokenNotListed(address token);
    error TokenAlreadyListed(address token);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param admin Receives `DEFAULT_ADMIN_ROLE` and `REGISTRY_ADMIN_ROLE`.
    constructor(address admin) {
        if (admin == address(0)) revert ZeroAddress();

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRY_ADMIN_ROLE, admin);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @inheritdoc ITokenRegistry
    function isTokenListed(address token) external view returns (bool) {
        return _configs[token].priceFeed != address(0);
    }

    /// @inheritdoc ITokenRegistry
    function isTokenActive(address token) external view returns (bool) {
        TokenConfig storage config = _configs[token];
        return config.priceFeed != address(0) && config.active;
    }

    /// @inheritdoc ITokenRegistry
    function priceFeedOf(address token) external view returns (address) {
        return _requireListed(token).priceFeed;
    }

    /// @inheritdoc ITokenRegistry
    function tokenDecimals(address token) external view returns (uint8) {
        return _requireListed(token).decimals;
    }

    /// @inheritdoc ITokenRegistry
    function getTokenConfig(address token) external view returns (TokenConfig memory) {
        return _requireListed(token);
    }

    /// @inheritdoc ITokenRegistry
    function tokenAt(uint256 index) external view returns (address) {
        return _tokens[index];
    }

    /// @inheritdoc ITokenRegistry
    function tokenCount() external view returns (uint256) {
        return _tokens.length;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @inheritdoc ITokenRegistry
    function registerToken(address token, address priceFeed) external onlyRole(REGISTRY_ADMIN_ROLE) {
        if (token == address(0) || priceFeed == address(0)) revert ZeroAddress();
        if (_configs[token].priceFeed != address(0)) revert TokenAlreadyListed(token);

        uint8 decimals = IERC20Metadata(token).decimals();

        _configs[token] = TokenConfig({ priceFeed: priceFeed, decimals: decimals, active: true });
        _tokens.push(token);

        emit TokenRegistered(token, priceFeed, decimals);
    }

    /// @inheritdoc ITokenRegistry
    function updatePriceFeed(address token, address priceFeed) external onlyRole(REGISTRY_ADMIN_ROLE) {
        if (priceFeed == address(0)) revert ZeroAddress();
        TokenConfig storage config = _requireListed(token);
        config.priceFeed = priceFeed;
        emit TokenPriceFeedUpdated(token, priceFeed);
    }

    /// @inheritdoc ITokenRegistry
    function setTokenActive(address token, bool active) external onlyRole(REGISTRY_ADMIN_ROLE) {
        TokenConfig storage config = _requireListed(token);
        config.active = active;
        emit TokenActiveUpdated(token, active);
    }

    // -------------------------------------------------------------------------
    // Private Functions
    // -------------------------------------------------------------------------

    function _requireListed(address token) private view returns (TokenConfig storage config) {
        config = _configs[token];
        if (config.priceFeed == address(0)) revert TokenNotListed(token);
    }
}
