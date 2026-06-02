import {
  type Address,
  type Hex,
  encodeAbiParameters,
  keccak256,
  parseAbiParameters,
  toBytes,
  verifyTypedData,
} from "viem";
import { SELF_REGISTER_TYPEHASH } from "../config/agent-registration.js";

export const AGENT_REGISTRY_EIP712_DOMAIN = {
  name: "AlphaGrid AgentRegistry",
  version: "1",
} as const;

export type SelfRegisterTypedData = {
  vault: Address;
  name: string;
  metadataURI: string;
  signer: Address;
  linkERC8004: boolean;
  erc8004AgentId: bigint;
  nonce: bigint;
  deadline: bigint;
};

export function hashSelfRegisterStruct(data: SelfRegisterTypedData): Hex {
  return keccak256(
    encodeAbiParameters(
      parseAbiParameters(
        "bytes32, address, bytes32, bytes32, address, bool, uint256, uint256, uint256",
      ),
      [
        SELF_REGISTER_TYPEHASH,
        data.vault,
        keccak256(toBytes(data.name)),
        keccak256(toBytes(data.metadataURI)),
        data.signer,
        data.linkERC8004,
        data.erc8004AgentId,
        data.nonce,
        data.deadline,
      ],
    ),
  );
}

export async function verifySelfRegisterSignature(params: {
  domainName: string;
  domainVersion: string;
  chainId: number;
  verifyingContract: Address;
  data: SelfRegisterTypedData;
  signature: Hex;
}): Promise<boolean> {
  const { domainName, domainVersion, chainId, verifyingContract, data, signature } = params;
  return verifyTypedData({
    address: data.signer,
    domain: {
      name: domainName,
      version: domainVersion,
      chainId,
      verifyingContract,
    },
    types: {
      SelfRegister: [
        { name: "vault", type: "address" },
        { name: "name", type: "string" },
        { name: "metadataURI", type: "string" },
        { name: "signer", type: "address" },
        { name: "linkERC8004", type: "bool" },
        { name: "erc8004AgentId", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    },
    primaryType: "SelfRegister",
    message: {
      vault: data.vault,
      name: data.name,
      metadataURI: data.metadataURI,
      signer: data.signer,
      linkERC8004: data.linkERC8004,
      erc8004AgentId: data.erc8004AgentId,
      nonce: data.nonce,
      deadline: data.deadline,
    },
    signature,
  });
}
