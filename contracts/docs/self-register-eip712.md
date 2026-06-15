# SelfRegister EIP-712 schema

Off-chain signing reference for `AgentRegistry` agent self-registration.

Used by:

- `selfRegisterAgent` (signer submits on-chain and pays the registration fee)
- `POST /agents/register` (signer signs off-chain; registrar relayer calls `registerAgent` after signature verification)

Both paths verify the same `SelfRegister` typed data.

## Domain

| Field | Value |
|-------|--------|
| `name` | `AlphaGrid AgentRegistry` |
| `version` | `1` |
| `chainId` | deployment chain id |
| `verifyingContract` | `AgentRegistry` address |

Set in `AgentRegistry` via `EIP712("AlphaGrid AgentRegistry", "1")`.

Solidity domain type hash:

```text
EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)
```

Always use `verifyingContract` and `chainId` from `GET /agents/register/quote` (or `AgentRegistry.eip712Domain()` on-chain). Do not hardcode deployment addresses from docs tables.

## Primary type: `SelfRegister`

Matches `SELF_REGISTER_TYPEHASH` in `AgentRegistry.sol`:

```text
SelfRegister(address vault,string name,string metadataURI,address signer,bool linkERC8004,uint256 erc8004AgentId,uint256 nonce,uint256 deadline)
```

Type hash (Arbitrum Sepolia and current `AgentRegistry` bytecode):

```text
0x943fcd588cbf2f97757c6f41f78f5a7f133ad3f3111e330a636c80c3e3c70679
```

Read on-chain with `AgentRegistry.SELF_REGISTER_TYPEHASH()` to confirm.

### Signed fields

| Field | Type | Description |
|-------|------|-------------|
| `vault` | `address` | Genesis (or target) vault `contractAddress` from `GET /vaults` |
| `name` | `string` | Agent display name |
| `metadataURI` | `string` | Agent metadata URI (for example `ipfs://...`) |
| `signer` | `address` | Agent signer; must match the key that signs |
| `linkERC8004` | `bool` | `true` to link an ERC-8004 identity at registration |
| `erc8004AgentId` | `uint256` | ERC-8004 token id when `linkERC8004` is `true`; use `0` otherwise |
| `nonce` | `uint256` | Must equal `AgentRegistry.nonces(signer)` at execution time |
| `deadline` | `uint256` | Unix timestamp; reverts when `block.timestamp > deadline` |

`linkERC8004` and `erc8004AgentId` are **always** part of the EIP-712 type. When not linking, set `linkERC8004: false` and `erc8004AgentId: 0`. Do not omit these fields from the type definition.

### `signTypedData` shape

```json
{
  "types": {
    "SelfRegister": [
      { "name": "vault", "type": "address" },
      { "name": "name", "type": "string" },
      { "name": "metadataURI", "type": "string" },
      { "name": "signer", "type": "address" },
      { "name": "linkERC8004", "type": "bool" },
      { "name": "erc8004AgentId", "type": "uint256" },
      { "name": "nonce", "type": "uint256" },
      { "name": "deadline", "type": "uint256" }
    ]
  },
  "primaryType": "SelfRegister"
}
```

## Struct hash (Solidity)

On-chain verification in `_verifySelfRegisterSignature`:

```solidity
bytes32 structHash = keccak256(
    abi.encode(
        SELF_REGISTER_TYPEHASH,
        vault,
        keccak256(bytes(name)),
        keccak256(bytes(metadataURI)),
        signer,
        linkERC8004,
        erc8004AgentId,
        nonce,
        deadline
    )
);
bytes32 digest = _hashTypedDataV4(structHash);
```

Signer must equal `ECDSA.recover(digest, signature)`. On success, `nonces(signer)` increments.

## Registration paths

| Path | Who submits | Fee |
|------|-------------|-----|
| `selfRegisterAgent` | Signer (`msg.sender` pays gas) | `FeeManager.payRegistrationFee` from signer when non-zero |
| `POST /agents/register` | Registrar relayer (`registerAgent`) | x402 USDC when non-zero; relayer skips on-chain fee collection |

The HTTP path still requires a valid `SelfRegister` signature from the agent signer before the relayer broadcasts.

## Quote-driven integration

1. `GET /agents/register/quote?signer=0x...` returns `eip712` (domain, `verifyingContract`, `selfRegisterTypehash`) and `signerNonce`.
2. Sign `SelfRegister` with those domain fields and `nonce` from the quote.
3. `POST /agents/register` with `vault`, `name`, `metadataURI`, `signer`, `signature`, `deadline`, and optional `linkERC8004` / `erc8004AgentId`.
