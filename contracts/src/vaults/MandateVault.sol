// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { IERC4626 } from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import { Initializable } from "@openzeppelin/contracts/proxy/utils/Initializable.sol";
import { ERC20 } from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { ERC4626 } from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import { IERC20Metadata } from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { Math } from "@openzeppelin/contracts/utils/math/Math.sol";
import { IMandateVault } from "../interfaces/IMandateVault.sol";
import { ITokenRegistry } from "../interfaces/ITokenRegistry.sol";
import { OracleLib } from "../libraries/OracleLib.sol";

/// @title MandateVault
/// @notice USDC ERC-4626 vault. Deposits are USDC-only; NAV includes whitelisted token holdings at oracle prices.
/// @dev EIP-1167 clone deployments: implementation constructor binds the ERC-4626 asset; per-clone state is set in {initialize}.
contract MandateVault is IMandateVault, Initializable, ERC4626, AccessControl {
    using Math for uint256;
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // Constants
    // -------------------------------------------------------------------------

    bytes32 public constant VAULT_ADMIN_ROLE = keccak256("VAULT_ADMIN_ROLE");

    bytes32 public constant TRADE_ROUTER_ROLE = keccak256("TRADE_ROUTER_ROLE");

    uint256 public constant MAX_BPS = 10_000;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    uint8 private immutable _ASSET_DECIMALS;

    string private _shareName;
    string private _shareSymbol;
    bytes32 private _vaultName;
    ITokenRegistry private _tokenRegistry;

    address[] private _allowedTokens;
    mapping(address token => bool enabled) private _tokenEnabled;
    mapping(address token => bool listed) private _tokenListed;

    uint256 public maxPriceAge;
    uint256 public depositFeeBps;
    uint256 public withdrawFeeBps;
    address public feeRecipient;

    bool public liquidityPaused;
    bool public tradingPaused;

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error LiquidityOperationsPaused();
    error TradingOperationsPaused();
    error TokenNotRegistered(address token);
    error TokenNotActive(address token);
    error TokenNotAllowed(address token);
    error TokenAlreadyAllowed(address token);
    error BpsOutOfRange(uint256 bps);
    error FeeRecipientRequired();
    error InsufficientIdleUsdc(uint256 requested, uint256 available);
    error InsufficientTokenBalance(address token, uint256 requested, uint256 available);

    // -------------------------------------------------------------------------
    // Constructor (implementation only)
    // -------------------------------------------------------------------------

    /// @param asset_ ERC-4626 underlying asset (e.g. USDC). Shared by all clones using this implementation.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor(IERC20 asset_) ERC20("", "") ERC4626(asset_) {
        _ASSET_DECIMALS = IERC20Metadata(address(asset_)).decimals();
        _disableInitializers();
    }

    // -------------------------------------------------------------------------
    // Initializer (clone instances)
    // -------------------------------------------------------------------------

    /// @notice Initializes a minimal-clone vault instance.
    function initialize(
        string calldata shareName_,
        string calldata shareSymbol_,
        bytes32 vaultName_,
        ITokenRegistry tokenRegistry_,
        address admin_,
        address feeRecipient_
    ) external initializer {
        if (admin_ == address(0) || address(tokenRegistry_) == address(0)) revert ZeroAddress();

        _shareName = shareName_;
        _shareSymbol = shareSymbol_;
        _vaultName = vaultName_;
        _tokenRegistry = tokenRegistry_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(VAULT_ADMIN_ROLE, admin_);

        if (feeRecipient_ != address(0)) {
            feeRecipient = feeRecipient_;
            emit FeeRecipientUpdated(feeRecipient_);
        }
    }

    // -------------------------------------------------------------------------
    // ERC-20 metadata (per-proxy)
    // -------------------------------------------------------------------------

    function name() public view override(ERC20, IERC20Metadata) returns (string memory) {
        return _shareName;
    }

    function symbol() public view override(ERC20, IERC20Metadata) returns (string memory) {
        return _shareSymbol;
    }

    // -------------------------------------------------------------------------
    // ERC-4626 overrides
    // -------------------------------------------------------------------------

    /// @inheritdoc IMandateVault
    /// @notice Thematic mandate identifier (e.g. TECH). Not the ERC-20 share token name.
    function vaultName() external view returns (bytes32) {
        return _vaultName;
    }

    /// @inheritdoc IMandateVault
    function tokenRegistry() external view returns (ITokenRegistry) {
        return _tokenRegistry;
    }

    /// @inheritdoc IMandateVault
    function idleAssets() public view returns (uint256) {
        return IERC20(asset()).balanceOf(address(this));
    }

    /// @inheritdoc IMandateVault
    function assetDecimals() external view returns (uint8) {
        return _ASSET_DECIMALS;
    }

    /// @inheritdoc ERC4626
    function previewDeposit(uint256 assets) public view override(ERC4626, IERC4626) returns (uint256) {
        return _convertToShares(_netDepositAssets(assets), Math.Rounding.Floor);
    }

    /// @inheritdoc ERC4626
    function previewMint(uint256 shares) public view override(ERC4626, IERC4626) returns (uint256) {
        return _grossDepositAssets(_convertToAssets(shares, Math.Rounding.Ceil));
    }

    /// @inheritdoc ERC4626
    function previewWithdraw(uint256 assets) public view override(ERC4626, IERC4626) returns (uint256) {
        return _convertToShares(_grossWithdrawAssets(assets), Math.Rounding.Ceil);
    }

    /// @inheritdoc ERC4626
    function previewRedeem(uint256 shares) public view override(ERC4626, IERC4626) returns (uint256) {
        uint256 gross = _convertToAssets(shares, Math.Rounding.Floor);
        return gross - _withdrawFee(gross);
    }

    /// @inheritdoc ERC4626
    function totalAssets() public view override(ERC4626, IERC4626) returns (uint256) {
        uint256 total = idleAssets();
        uint256 len = _allowedTokens.length;
        for (uint256 i = 0; i < len; i++) {
            address token = _allowedTokens[i];
            if (!_tokenListed[token] || !_tokenEnabled[token]) continue;
            if (!_tokenRegistry.isTokenActive(token)) continue;

            uint256 balance = IERC20(token).balanceOf(address(this));
            if (balance == 0) continue;

            total += OracleLib.valueInAsset(
                balance,
                _tokenRegistry.priceOracle(),
                token,
                _tokenRegistry.tokenDecimals(token),
                _ASSET_DECIMALS,
                maxPriceAge
            );
        }
        return total;
    }

    /// @inheritdoc ERC4626
    function maxWithdraw(address owner) public view override(ERC4626, IERC4626) returns (uint256) {
        uint256 ownerNet = _convertToAssets(balanceOf(owner), Math.Rounding.Floor);
        uint256 maxNetFromIdle = _maxNetWithdrawFromIdle(idleAssets());
        return ownerNet < maxNetFromIdle ? ownerNet : maxNetFromIdle;
    }

    /// @inheritdoc ERC4626
    function maxRedeem(address owner) public view override(ERC4626, IERC4626) returns (uint256) {
        uint256 shares = balanceOf(owner);
        if (shares == 0) return 0;

        uint256 idle = idleAssets();
        if (idle == 0) return 0;

        uint256 maxSharesFromIdle = _convertToShares(idle, Math.Rounding.Floor);
        return shares < maxSharesFromIdle ? shares : maxSharesFromIdle;
    }

    /// @inheritdoc ERC4626
    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        if (liquidityPaused) revert LiquidityOperationsPaused();
        IERC20 token = IERC20(asset());
        token.safeTransferFrom(caller, address(this), assets);

        uint256 fee = _depositFee(assets);
        if (fee != 0) {
            token.safeTransfer(feeRecipient, fee);
            emit LiquidityFeeCollected(caller, feeRecipient, fee, true);
        }

        _mint(receiver, shares);
        emit Deposit(caller, receiver, assets, shares);
    }

    /// @inheritdoc ERC4626
    function _withdraw(address caller, address receiver, address owner, uint256 assets, uint256 shares)
        internal
        override
    {
        if (liquidityPaused) revert LiquidityOperationsPaused();

        if (caller != owner) {
            _spendAllowance(owner, caller, shares);
        }

        _burn(owner, shares);

        uint256 fee = _withdrawFee(assets);
        IERC20 token = IERC20(asset());
        if (fee != 0) {
            token.safeTransfer(feeRecipient, fee);
            emit LiquidityFeeCollected(owner, feeRecipient, fee, false);
        }
        token.safeTransfer(receiver, assets);

        emit Withdraw(caller, receiver, owner, assets, shares);
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @inheritdoc IMandateVault
    function isAllowedToken(address token) external view returns (bool) {
        return _tokenListed[token] && _tokenEnabled[token] && _tokenRegistry.isTokenActive(token);
    }

    /// @inheritdoc IMandateVault
    function priceOracle() external view returns (address) {
        return _tokenRegistry.priceOracle();
    }

    /// @inheritdoc IMandateVault
    function allowedTokenAt(uint256 index) external view returns (address) {
        return _allowedTokens[index];
    }

    /// @inheritdoc IMandateVault
    function allowedTokenCount() external view returns (uint256) {
        return _allowedTokens.length;
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @inheritdoc IMandateVault
    function enableToken(address token) external onlyRole(VAULT_ADMIN_ROLE) {
        if (!_tokenListed[token]) {
            if (!_tokenRegistry.isTokenListed(token)) revert TokenNotRegistered(token);
            if (!_tokenRegistry.isTokenActive(token)) revert TokenNotActive(token);

            _tokenListed[token] = true;
            _tokenEnabled[token] = true;
            _allowedTokens.push(token);

            emit MandateTokenEnabled(token);
            return;
        }

        revert TokenAlreadyAllowed(token);
    }

    /// @inheritdoc IMandateVault
    function setTokenEnabled(address token, bool enabled) external onlyRole(VAULT_ADMIN_ROLE) {
        if (!_tokenListed[token]) revert TokenNotAllowed(token);
        if (enabled && !_tokenRegistry.isTokenActive(token)) revert TokenNotActive(token);

        _tokenEnabled[token] = enabled;
        emit MandateTokenStatusUpdated(token, enabled);
    }

    /// @inheritdoc IMandateVault
    function setMaxPriceAge(uint256 maxPriceAge_) external onlyRole(VAULT_ADMIN_ROLE) {
        maxPriceAge = maxPriceAge_;
        emit MaxPriceAgeUpdated(maxPriceAge_);
    }

    /// @inheritdoc IMandateVault
    function setDepositFeeBps(uint256 depositFeeBps_) external onlyRole(VAULT_ADMIN_ROLE) {
        _validateFeeBps(depositFeeBps_);
        if (depositFeeBps_ != 0 && feeRecipient == address(0)) revert FeeRecipientRequired();
        depositFeeBps = depositFeeBps_;
        emit DepositFeeUpdated(depositFeeBps_);
    }

    /// @inheritdoc IMandateVault
    function setWithdrawFeeBps(uint256 withdrawFeeBps_) external onlyRole(VAULT_ADMIN_ROLE) {
        _validateFeeBps(withdrawFeeBps_);
        if (withdrawFeeBps_ != 0 && feeRecipient == address(0)) revert FeeRecipientRequired();
        withdrawFeeBps = withdrawFeeBps_;
        emit WithdrawFeeUpdated(withdrawFeeBps_);
    }

    /// @inheritdoc IMandateVault
    function setFeeRecipient(address feeRecipient_) external onlyRole(VAULT_ADMIN_ROLE) {
        if (feeRecipient_ == address(0)) revert ZeroAddress();
        feeRecipient = feeRecipient_;
        emit FeeRecipientUpdated(feeRecipient_);
    }

    /// @inheritdoc IMandateVault
    function setLiquidityPaused(bool paused) external onlyRole(VAULT_ADMIN_ROLE) {
        liquidityPaused = paused;
        emit LiquidityPauseUpdated(paused);
    }

    /// @inheritdoc IMandateVault
    function setTradingPaused(bool paused) external onlyRole(VAULT_ADMIN_ROLE) {
        tradingPaused = paused;
        emit TradingPauseUpdated(paused);
    }

    /// @inheritdoc IMandateVault
    function pullUsdcForTrade(address to, uint256 amount) external onlyRole(TRADE_ROUTER_ROLE) {
        if (tradingPaused) revert TradingOperationsPaused();
        _pullUsdc(to, amount);
    }

    /// @inheritdoc IMandateVault
    function pullTokenForTrade(address token, address to, uint256 amount) external onlyRole(TRADE_ROUTER_ROLE) {
        if (tradingPaused) revert TradingOperationsPaused();
        _pullToken(token, to, amount);
    }

    /// @inheritdoc IMandateVault
    function pullTokenForForceClose(address token, address to, uint256 amount) external onlyRole(TRADE_ROUTER_ROLE) {
        _pullToken(token, to, amount);
    }

    // -------------------------------------------------------------------------
    // Private Functions
    // -------------------------------------------------------------------------

    function _pullUsdc(address to, uint256 amount) private {
        if (to == address(0)) revert ZeroAddress();
        uint256 idle = idleAssets();
        if (amount > idle) revert InsufficientIdleUsdc(amount, idle);
        IERC20(asset()).safeTransfer(to, amount);
    }

    function _pullToken(address token, address to, uint256 amount) private {
        if (to == address(0)) revert ZeroAddress();
        if (!_tokenListed[token] || !_tokenEnabled[token]) revert TokenNotAllowed(token);
        uint256 balance = IERC20(token).balanceOf(address(this));
        if (amount > balance) revert InsufficientTokenBalance(token, amount, balance);
        IERC20(token).safeTransfer(to, amount);
    }

    function _depositFee(uint256 assets) private view returns (uint256) {
        return assets.mulDiv(depositFeeBps, MAX_BPS, Math.Rounding.Floor);
    }

    function _withdrawFee(uint256 assets) private view returns (uint256) {
        return assets.mulDiv(withdrawFeeBps, MAX_BPS, Math.Rounding.Floor);
    }

    function _netDepositAssets(uint256 assets) private view returns (uint256) {
        return assets - _depositFee(assets);
    }

    function _grossDepositAssets(uint256 netAssets) private view returns (uint256) {
        if (depositFeeBps == 0) return netAssets;
        if (depositFeeBps >= MAX_BPS) return netAssets == 0 ? 0 : type(uint256).max;
        return netAssets.mulDiv(MAX_BPS, MAX_BPS - depositFeeBps, Math.Rounding.Ceil);
    }

    function _grossWithdrawAssets(uint256 netAssets) private view returns (uint256) {
        return netAssets + _withdrawFee(netAssets);
    }

    function _maxNetWithdrawFromIdle(uint256 idle) private view returns (uint256) {
        if (withdrawFeeBps == 0) return idle;
        return idle.mulDiv(MAX_BPS, MAX_BPS + withdrawFeeBps, Math.Rounding.Floor);
    }

    function _validateFeeBps(uint256 bps) private pure {
        if (bps > MAX_BPS) revert BpsOutOfRange(bps);
    }

    function _requireAllowedToken(address token) private view {
        if (!_tokenListed[token]) revert TokenNotAllowed(token);
    }
}
