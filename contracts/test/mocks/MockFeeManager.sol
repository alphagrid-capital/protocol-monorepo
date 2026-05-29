// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { IFeeManager } from "../../src/interfaces/IFeeManager.sol";

/// @title MockFeeManager
/// @notice Test double for registration and promotion fee collection.
contract MockFeeManager is IFeeManager {
    struct RegistrationPayment {
        address payer;
        uint256 agentId;
    }

    struct PromotionPayment {
        address payer;
        uint256 agentId;
        address vault;
        uint256 fromTrackId;
        uint256 toTrackId;
    }

    RegistrationPayment[] public registrationPayments;
    PromotionPayment[] public promotionPayments;
    bool public shouldRevert;

    function feeAsset() external pure returns (address) {
        return address(0);
    }

    function payRegistrationFee(address payer, uint256 agentId) external {
        if (shouldRevert) revert("MockFeeManager: revert");
        registrationPayments.push(RegistrationPayment({ payer: payer, agentId: agentId }));
    }

    function payPromotionFee(address payer, uint256 agentId, address vault, uint256 fromTrackId, uint256 toTrackId)
        external
    {
        if (shouldRevert) revert("MockFeeManager: revert");
        promotionPayments.push(
            PromotionPayment({
                payer: payer, agentId: agentId, vault: vault, fromTrackId: fromTrackId, toTrackId: toTrackId
            })
        );
    }

    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }

    function paymentCount() external view returns (uint256) {
        return registrationPayments.length;
    }

    function promotionPaymentCount() external view returns (uint256) {
        return promotionPayments.length;
    }

    function setRegistrationFee(uint256) external { }

    function setPromotionFee(address, uint256, uint256, uint256) external { }

    function getRegistrationFee() external pure returns (uint256) {
        return 0;
    }

    function getPromotionFee(address, uint256, uint256) external pure returns (uint256) {
        return 0;
    }
}
