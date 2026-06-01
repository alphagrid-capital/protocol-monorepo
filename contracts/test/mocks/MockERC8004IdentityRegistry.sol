// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";

/// @dev Minimal ERC-721 stand-in for ERC-8004 Identity Registry in tests.
contract MockERC8004IdentityRegistry is ERC721 {
    uint256 private _nextTokenId = 1;

    constructor() ERC721("MockERC8004", "M8004") {}

    function mint(address to) external returns (uint256 tokenId) {
        tokenId = _nextTokenId++;
        _mint(to, tokenId);
    }

    /// @dev Mint a specific token id (e.g. id 0) for ERC-8004 implementations that use it.
    function mintWithId(address to, uint256 tokenId) external {
        _mint(to, tokenId);
        if (tokenId >= _nextTokenId) {
            _nextTokenId = tokenId + 1;
        }
    }
}
