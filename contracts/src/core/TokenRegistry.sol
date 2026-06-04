// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { ITokenRegistry } from "../interfaces/ITokenRegistry.sol";

/// @title TokenRegistry
/// @notice Canonical token catalog shared across AlphaGrid vaults with one global price oracle.
contract TokenRegistry is ITokenRegistry, AccessControl {
    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    bytes32 public constant REGISTRY_ADMIN_ROLE = keccak256("REGISTRY_ADMIN_ROLE");

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    address public priceOracle;

    address[] private _tokens;
    mapping(address token => TokenConfig config) private _configs;
    mapping(address token => bool listed) private _listed;

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error PriceOracleNotSet();
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
        return _listed[token];
    }

    /// @inheritdoc ITokenRegistry
    function isTokenActive(address token) external view returns (bool) {
        TokenConfig storage config = _configs[token];
        return _listed[token] && config.active;
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
    function setPriceOracle(address priceOracle_) external onlyRole(REGISTRY_ADMIN_ROLE) {
        if (priceOracle_ == address(0)) revert ZeroAddress();
        priceOracle = priceOracle_;
        emit PriceOracleSet(priceOracle_);
    }

    /// @inheritdoc ITokenRegistry
    function registerToken(address token) external onlyRole(REGISTRY_ADMIN_ROLE) {
        if (token == address(0)) revert ZeroAddress();
        if (priceOracle == address(0)) revert PriceOracleNotSet();
        if (_listed[token]) revert TokenAlreadyListed(token);

        uint8 decimals = IERC20Metadata(token).decimals();

        _listed[token] = true;
        _configs[token] = TokenConfig({ decimals: decimals, active: true });
        _tokens.push(token);

        emit TokenRegistered(token, decimals);
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
        if (!_listed[token]) revert TokenNotListed(token);
        config = _configs[token];
    }
}
