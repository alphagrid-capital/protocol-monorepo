// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { Script, console2 } from "forge-std/Script.sol";
import { MockPriceOracle } from "../src/mocks/MockPriceOracle.sol";
import { TokenRegistry } from "../src/core/TokenRegistry.sol";

/// @notice Deploys MockPriceOracle and wires it on TokenRegistry.
/// @dev Pipeline: deploy → wire. Requires TOKEN_REGISTRY and ADMIN (or uses msg.sender).
contract DeployPriceOracle is Script {
    function run() external returns (MockPriceOracle oracle) {
        address admin = vm.envAddress("ADMIN");
        TokenRegistry registry = TokenRegistry(vm.envAddress("TOKEN_REGISTRY"));

        vm.startBroadcast();
        oracle = new MockPriceOracle(admin);
        registry.setPriceOracle(address(oracle));

        address keeper = vm.envOr("ORACLE_KEEPER", address(0));
        if (keeper != address(0)) {
            oracle.grantRole(oracle.ORACLE_UPDATER_ROLE(), keeper);
            console2.log("ORACLE_UPDATER granted to:", keeper);
        }
        vm.stopBroadcast();

        console2.log("MockPriceOracle:", address(oracle));
        console2.log("TokenRegistry:", address(registry));
    }
}
