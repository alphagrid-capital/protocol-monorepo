// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IERC4626 } from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import { ITokenRegistry } from "./ITokenRegistry.sol";

/// @title IMandateVault
/// @notice ERC-4626 vault with asset deposits and oracle-based NAV for mandate-allowed holdings.
interface IMandateVault is IERC4626 {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event MandateTokenEnabled(address indexed token);

    event MandateTokenStatusUpdated(address indexed token, bool enabled);

    event MaxPriceAgeUpdated(uint256 maxPriceAge);

    event DepositFeeUpdated(uint256 depositFeeBps);

    event WithdrawFeeUpdated(uint256 withdrawFeeBps);

    event FeeRecipientUpdated(address indexed feeRecipient);

    event LiquidityFeeCollected(address indexed payer, address indexed recipient, uint256 fee, bool isDeposit);

    event LiquidityPauseUpdated(bool paused);

    event TradingPauseUpdated(bool paused);

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @notice Thematic mandate identifier (e.g. TECH). Not the ERC-20 share token name.
    function vaultName() external view returns (bytes32);

    function tokenRegistry() external view returns (ITokenRegistry);

    function depositFeeBps() external view returns (uint256);

    function withdrawFeeBps() external view returns (uint256);

    /// @notice Asset recipient for LP deposit and withdraw fees.
    function feeRecipient() external view returns (address);

    function idleAssets() external view returns (uint256);

    /// @notice Decimals of the ERC-4626 underlying asset (cached at implementation deploy).
    function assetDecimals() external view returns (uint8);

    function maxPriceAge() external view returns (uint256);

    /// @notice Whether `token` is enabled for this vault mandate and active in the registry.
    function isAllowedToken(address token) external view returns (bool);

    function priceOracle() external view returns (address);

    function allowedTokenAt(uint256 index) external view returns (address);

    function allowedTokenCount() external view returns (uint256);

    /// @notice When true, LP deposits and withdrawals are blocked.
    function liquidityPaused() external view returns (bool);

    /// @notice When true, routine trade pulls are blocked; force-close pulls remain available.
    function tradingPaused() external view returns (bool);

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Allow a registry-listed token for this vault mandate.
    function enableToken(address token) external;

    /// @notice Enable or disable a mandate-allowed token without removing it.
    function setTokenEnabled(address token, bool enabled) external;

    function setMaxPriceAge(uint256 maxPriceAge) external;

    function setDepositFeeBps(uint256 depositFeeBps) external;

    function setWithdrawFeeBps(uint256 withdrawFeeBps) external;

    function setFeeRecipient(address feeRecipient) external;

    function setLiquidityPaused(bool paused) external;

    function setTradingPaused(bool paused) external;

    // -------------------------------------------------------------------------
    // Trade router
    // -------------------------------------------------------------------------

    function pullAssetsForTrade(address to, uint256 amount) external;

    function pullTokenForTrade(address token, address to, uint256 amount) external;

    /// @notice Pull tokens for operator force-close while trading is paused.
    function pullTokenForForceClose(address token, address to, uint256 amount) external;
}
