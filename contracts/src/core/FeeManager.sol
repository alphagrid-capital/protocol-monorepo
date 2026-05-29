// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Ownable2Step } from "@openzeppelin/contracts/access/Ownable2Step.sol";
import { Ownable } from "@openzeppelin/contracts/access/Ownable.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { IFeeManager } from "../interfaces/IFeeManager.sol";

/// @title FeeManager
/// @notice Defines and collects registration and promotion fees for AlphaGrid.
contract FeeManager is IFeeManager, Ownable2Step {
    using SafeERC20 for IERC20;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    address public immutable FEE_ASSET;
    address public agentRegistry;
    address public treasury;

    uint256 private _registrationFeeAmount;
    mapping(address vault => mapping(uint256 fromTrackId => mapping(uint256 toTrackId => uint256))) private
        _promotionFeeAmounts;

    // -------------------------------------------------------------------------
    // Errors
    // -------------------------------------------------------------------------

    error ZeroAddress();
    error NotAgentRegistry(address caller);

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    /// @param admin Contract owner.
    /// @param treasury_ Fee recipient address.
    /// @param feeAsset_ ERC20 used for all protocol fees.
    constructor(address admin, address treasury_, address feeAsset_) Ownable(admin) {
        if (treasury_ == address(0) || feeAsset_ == address(0)) revert ZeroAddress();

        treasury = treasury_;
        FEE_ASSET = feeAsset_;
    }

    // -------------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------------

    /// @inheritdoc IFeeManager
    function feeAsset() external view returns (address) {
        return FEE_ASSET;
    }

    /// @inheritdoc IFeeManager
    function getRegistrationFee() external view returns (uint256 amount) {
        return _registrationFeeAmount;
    }

    /// @inheritdoc IFeeManager
    function getPromotionFee(address vault, uint256 fromTrackId, uint256 toTrackId)
        external
        view
        returns (uint256 amount)
    {
        return _promotionFeeAmounts[vault][fromTrackId][toTrackId];
    }

    // -------------------------------------------------------------------------
    // Admin
    // -------------------------------------------------------------------------

    /// @notice Wire the AgentRegistry allowed to invoke fee collection.
    function setAgentRegistry(address agentRegistry_) external onlyOwner {
        if (agentRegistry_ == address(0)) revert ZeroAddress();
        agentRegistry = agentRegistry_;
        emit AgentRegistryUpdated(agentRegistry_);
    }

    /// @notice Update the treasury address that receives collected fees.
    function setTreasury(address treasury_) external onlyOwner {
        if (treasury_ == address(0)) revert ZeroAddress();
        treasury = treasury_;
        emit TreasuryUpdated(treasury_);
    }

    /// @inheritdoc IFeeManager
    function setRegistrationFee(uint256 amount) external onlyOwner {
        _registrationFeeAmount = amount;
        emit RegistrationFeeUpdated(FEE_ASSET, amount);
    }

    /// @inheritdoc IFeeManager
    function setPromotionFee(address vault, uint256 fromTrackId, uint256 toTrackId, uint256 amount) external onlyOwner {
        if (vault == address(0)) revert ZeroAddress();
        _promotionFeeAmounts[vault][fromTrackId][toTrackId] = amount;
        emit PromotionFeeUpdated(vault, fromTrackId, toTrackId, FEE_ASSET, amount);
    }

    // -------------------------------------------------------------------------
    // Fee Collection
    // -------------------------------------------------------------------------

    /// @inheritdoc IFeeManager
    function payRegistrationFee(address payer, uint256 agentId) external {
        _onlyAgentRegistry();

        uint256 amount = _registrationFeeAmount;
        if (amount == 0) return;

        IERC20(FEE_ASSET).safeTransferFrom(payer, treasury, amount);
        emit RegistrationFeePaid(agentId, payer, FEE_ASSET, amount);
    }

    /// @inheritdoc IFeeManager
    function payPromotionFee(address payer, uint256 agentId, address vault, uint256 fromTrackId, uint256 toTrackId)
        external
    {
        _onlyAgentRegistry();

        uint256 amount = _promotionFeeAmounts[vault][fromTrackId][toTrackId];
        if (amount == 0) return;

        IERC20(FEE_ASSET).safeTransferFrom(payer, treasury, amount);
        emit PromotionFeePaid(agentId, vault, fromTrackId, toTrackId, payer, FEE_ASSET, amount);
    }

    // -------------------------------------------------------------------------
    // Private Functions
    // -------------------------------------------------------------------------

    /// @dev Restricts fee collection to the configured AgentRegistry.
    function _onlyAgentRegistry() private view {
        if (msg.sender != agentRegistry) revert NotAgentRegistry(msg.sender);
    }
}
