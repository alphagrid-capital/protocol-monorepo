// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/// @title IFeeManager
/// @notice Protocol fee configuration and collection for agent registration and promotion.
interface IFeeManager {
    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event RegistrationFeeUpdated(address indexed asset, uint256 amount);

    event PromotionFeeUpdated(
        address indexed vault, uint256 indexed fromTrackId, uint256 indexed toTrackId, address asset, uint256 amount
    );

    event TreasuryUpdated(address indexed treasury);

    event AgentRegistryUpdated(address indexed newRegistry);

    event RegistrationFeePaid(uint256 indexed agentId, address indexed payer, address asset, uint256 amount);

    event PromotionFeePaid(
        uint256 indexed agentId,
        address indexed vault,
        uint256 fromTrackId,
        uint256 toTrackId,
        address indexed payer,
        address asset,
        uint256 amount
    );

    // -------------------------------------------------------------------------
    // Configuration
    // -------------------------------------------------------------------------

    /// @notice ERC20 asset used for all protocol fees.
    function feeAsset() external view returns (address);

    /// @notice Set the global registration fee amount.
    function setRegistrationFee(uint256 amount) external;

    /// @notice Set the promotion fee amount for a vault track transition.
    function setPromotionFee(address vault, uint256 fromTrackId, uint256 toTrackId, uint256 amount) external;

    /// @notice Returns the configured registration fee amount.
    function getRegistrationFee() external view returns (uint256 amount);

    /// @notice Returns the configured promotion fee amount for a vault track transition.
    function getPromotionFee(address vault, uint256 fromTrackId, uint256 toTrackId)
        external
        view
        returns (uint256 amount);

    // -------------------------------------------------------------------------
    // Fee Collection
    // -------------------------------------------------------------------------

    /// @notice Collect registration fee from `payer`. Callable only by AgentRegistry.
    function payRegistrationFee(address payer, uint256 agentId) external;

    /// @notice Record registration fee as prepaid off-chain (x402). Callable only by AgentRegistry.
    function payRegistrationFeePrepaid(uint256 agentId) external;

    /// @notice Relayer that may use `payRegistrationFeePrepaid` on the self-register path.
    function registrationFeeRelayer() external view returns (address);

    /// @notice Collect promotion fee from `payer`. Callable only by AgentRegistry.
    function payPromotionFee(address payer, uint256 agentId, address vault, uint256 fromTrackId, uint256 toTrackId)
        external;
}
