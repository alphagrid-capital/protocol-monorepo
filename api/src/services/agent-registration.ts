import {
  type Address,
  type Hex,
  encodeFunctionData,
  createPublicClient,
  http,
} from "viem";
import { loadAgentRegistrationConfig } from "../config/agent-registration.js";
import {
  verifySelfRegisterSignature,
  type SelfRegisterTypedData,
} from "../lib/eip712-agent-registration.js";
import type {
  AgentRegistrationQuote,
  AgentRegistrationRequest,
  AgentRegistrationResponse,
} from "../schemas/agent.js";

const agentRegistryAbi = [
  {
    type: "function",
    name: "selfRegisterAgent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "vault", type: "address" },
      { name: "name", type: "string" },
      { name: "metadataURI", type: "string" },
      { name: "signer", type: "address" },
      { name: "linkERC8004", type: "bool" },
      { name: "erc8004AgentId", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [{ name: "agentId", type: "uint256" }],
  },
  {
    type: "function",
    name: "nonces",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;

export class AgentRegistrationError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "AgentRegistrationError";
  }
}

function parseRequest(body: AgentRegistrationRequest): SelfRegisterTypedData & { signature: Hex } {
  const deadline = BigInt(body.deadline);
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (deadline < now) {
    throw new AgentRegistrationError("Registration deadline has expired", 400);
  }

  return {
    vault: body.vault as Address,
    name: body.name,
    metadataURI: body.metadataURI,
    signer: body.signer as Address,
    linkERC8004: body.linkERC8004,
    erc8004AgentId: BigInt(body.erc8004AgentId),
    nonce: 0n,
    deadline,
    signature: body.signature as Hex,
  };
}

async function readSignerNonce(
  registry: Address,
  rpcUrl: string,
  chainId: number,
  signer: Address,
): Promise<bigint> {
  const client = createPublicClient({
    chain: { id: chainId, name: "alphagrid", nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" }, rpcUrls: { default: { http: [rpcUrl] } } },
    transport: http(rpcUrl),
  });

  return client.readContract({
    address: registry,
    abi: agentRegistryAbi,
    functionName: "nonces",
    args: [signer],
  });
}

export async function getAgentRegistrationQuote(
  signer?: Address,
): Promise<AgentRegistrationQuote> {
  const config = loadAgentRegistrationConfig();
  let signerNonce: string | null = null;

  if (
    signer &&
    config.mode === "live" &&
    config.agentRegistry &&
    config.rpcUrl
  ) {
    const nonce = await readSignerNonce(
      config.agentRegistry,
      config.rpcUrl,
      config.chainId,
      signer,
    );
    signerNonce = nonce.toString();
  } else if (signer && config.mode === "mock") {
    signerNonce = "0";
  }

  return {
    mode: config.mode,
    registrationFee: {
      amount: config.registrationFeeAtomic.toString(),
      assetSymbol: "USDC",
      decimals: 6,
      displayUsd: config.registrationFeeUsd,
    },
    x402: {
      enabled: config.x402.enabled && config.x402.payTo !== null,
      network: config.x402.enabled ? config.x402.network : null,
      payTo: config.x402.payTo,
      facilitatorUrl: config.x402.enabled ? config.x402.facilitatorUrl : null,
      httpRoute: "POST /agents/register",
    },
    eip712: {
      domainName: "AlphaGrid AgentRegistry",
      domainVersion: "1",
      chainId: config.chainId,
      verifyingContract: config.agentRegistry,
      primaryType: "SelfRegister",
      selfRegisterTypehash:
        "0x943fcd588cbf2f97757c6f41f78f5a7f133ad3f3111e330a636c80c3e3c70679",
    },
    agentRegistry: config.agentRegistry,
    signerNonce,
  };
}

export async function registerAgent(
  body: AgentRegistrationRequest,
): Promise<AgentRegistrationResponse> {
  const config = loadAgentRegistrationConfig();
  const parsed = parseRequest(body);

  if (config.mode === "live" && config.agentRegistry && config.rpcUrl) {
    parsed.nonce = await readSignerNonce(
      config.agentRegistry,
      config.rpcUrl,
      config.chainId,
      parsed.signer,
    );
  }

  if (config.mode === "live" && config.agentRegistry) {
    const valid = await verifySelfRegisterSignature({
      chainId: config.chainId,
      verifyingContract: config.agentRegistry,
      data: parsed,
      signature: parsed.signature,
    });
    if (!valid) {
      throw new AgentRegistrationError("Invalid SelfRegister EIP-712 signature", 400);
    }
  }

  if (config.mode === "mock") {
    return {
      mode: "mock",
      agentId: "1",
      transaction: null,
      message:
        "Mock registration accepted (signature check skipped). Configure AGENT_REGISTRY_ADDRESS and RPC_URL for live calldata.",
    };
  }

  if (!config.agentRegistry) {
    throw new AgentRegistrationError("AGENT_REGISTRY_ADDRESS is not configured", 503);
  }

  const data = encodeFunctionData({
    abi: agentRegistryAbi,
    functionName: "selfRegisterAgent",
    args: [
      parsed.vault,
      parsed.name,
      parsed.metadataURI,
      parsed.signer,
      parsed.linkERC8004,
      parsed.erc8004AgentId,
      parsed.deadline,
      parsed.signature,
    ],
  });

  return {
    mode: "live",
    agentId: null,
    transaction: {
      to: config.agentRegistry,
      data,
      chainId: config.chainId,
      description:
        "Submit via relayer or agent wallet. When using x402, set FeeManager.registrationFeeRelayer to the relayer and fund treasury via x402 first.",
    },
    message:
      "Registration calldata ready. Submit on-chain (relayer recommended after x402 fee settlement).",
  };
}
