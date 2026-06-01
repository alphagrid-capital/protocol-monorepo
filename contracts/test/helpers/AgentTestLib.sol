// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { MockERC8004IdentityRegistry } from "../mocks/MockERC8004IdentityRegistry.sol";

/// @dev Helpers for AgentRegistry tests (ERC-8004 identity + registration).
library AgentTestLib {
    function deployERC8004IdentityRegistry() internal returns (MockERC8004IdentityRegistry identityRegistry) {
        identityRegistry = new MockERC8004IdentityRegistry();
    }

    function mintERC8004(MockERC8004IdentityRegistry identityRegistry, address to)
        internal
        returns (uint256 erc8004AgentId)
    {
        erc8004AgentId = identityRegistry.mint(to);
    }
}
