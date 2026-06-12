// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { console2 } from "forge-std/Script.sol";
import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { MandateVault } from "../../src/vaults/MandateVault.sol";
import { Fees } from "../config/Fees.sol";
import { DeploymentEnv } from "../helpers/DeploymentEnv.sol";

/// @notice Deposits vault stablecoin into the Genesis vault (ERC-4626).
/// @dev Requires VAULT_ASSET (or legacy USDC), GENESIS_VAULT, DEPOSITOR, and PRIVATE_KEY in `.env`.
///      forge script script/ops/DepositToGenesisVault.s.sol:DepositToGenesisVault \
///        --rpc-url $RPC_URL --broadcast
contract DepositToGenesisVault is DeploymentEnv {
    function run() external {
        address vaultAsset = tryLoadVaultAsset();
        if (vaultAsset == address(0)) revert("VAULT_ASSET or USDC required");
        IERC20 usdc = IERC20(vaultAsset);
        MandateVault vault = MandateVault(vm.envAddress("GENESIS_VAULT"));
        address depositor = vm.envAddress("DEPOSITOR");
        uint256 depositAmount = vm.envOr("DEPOSIT_AMOUNT", Fees.DEFAULT_GENESIS_DEPOSIT);

        vm.startBroadcast();
        usdc.approve(address(vault), depositAmount);
        uint256 shares = vault.deposit(depositAmount, depositor);
        vm.stopBroadcast();

        console2.log("Vault:", address(vault));
        console2.log("Depositor:", depositor);
        console2.log("Deposited (raw):", depositAmount);
        console2.log("Shares received:", shares);
    }
}
