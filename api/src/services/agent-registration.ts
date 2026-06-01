import {
  type Address,
  type Hex,
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  http,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { loadAgentRegistrationConfig } from "../config/agent-registration.js";
import {
  verifySelfRegisterSignature,
  type SelfRegisterTypedData,
} from "../lib/eip712-agent-registration.js";
import { fetchRegistrationFeeAtomic, fetchRegistrationFeeUsd } from "../lib/registration-fee.js";
import { getRegistrationPaymentId } from "../lib/registration-request-context.js";
import { ZERO_X402_PAYMENT_ID } from "../lib/x402-agent-registration.js";
import { getWorkerEnv } from "../lib/worker-env.js";
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
      { name: "x402PaymentId", type: "bytes32" },
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
  {
    type: "event",
    name: "AgentRegistered",
    inputs: [
      { name: "agentId", type: "uint256", indexed: true },
      { name: "vault", type: "address", indexed: true },
      { name: "owner", type: "address", indexed: true },
      { name: "signer", type: "address", indexed: false },
      { name: "metadataURI", type: "string", indexed: false },
      { name: "track", type: "uint8", indexed: false },
    ],
  },
] as const;

const feeManagerRelayerAbi = [
  {
    type: "function",
    name: "registrationFeeRelayer",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
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

function chainConfig(config: ReturnType<typeof loadAgentRegistrationConfig>) {
  if (!config.rpcUrl) {
    throw new AgentRegistrationError("RPC_URL is not configured", 503);
  }
  return {
    id: config.chainId,
    name: "alphagrid",
    nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  } as const;
}

async function readSignerNonce(
  registry: Address,
  rpcUrl: string,
  chainId: number,
  signer: Address,
): Promise<bigint> {
  const client = createPublicClient({
    chain: {
      id: chainId,
      name: "alphagrid",
      nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" },
      rpcUrls: { default: { http: [rpcUrl] } },
    },
    transport: http(rpcUrl),
  });

  return client.readContract({
    address: registry,
    abi: agentRegistryAbi,
    functionName: "nonces",
    args: [signer],
  });
}

async function assertRelayerConfigured(
  config: ReturnType<typeof loadAgentRegistrationConfig>,
  relayerAddress: Address,
): Promise<void> {
  if (!config.feeManager || !config.rpcUrl) {
    throw new AgentRegistrationError("FEE_MANAGER_ADDRESS or RPC_URL is not configured", 503);
  }

  const client = createPublicClient({
    chain: chainConfig(config),
    transport: http(config.rpcUrl),
  });

  const onChainRelayer = await client.readContract({
    address: config.feeManager,
    abi: feeManagerRelayerAbi,
    functionName: "registrationFeeRelayer",
  });

  if (onChainRelayer.toLowerCase() !== relayerAddress.toLowerCase()) {
    throw new AgentRegistrationError(
      "Relayer wallet does not match FeeManager.registrationFeeRelayer",
      503,
    );
  }

  if (
    config.registrationFeeRelayer &&
    config.registrationFeeRelayer.toLowerCase() !== relayerAddress.toLowerCase()
  ) {
    throw new AgentRegistrationError(
      "RELAYER_PRIVATE_KEY does not match REGISTRATION_FEE_RELAYER_ADDRESS",
      503,
    );
  }
}

async function submitRelayerRegistration(params: {
  config: ReturnType<typeof loadAgentRegistrationConfig>;
  parsed: SelfRegisterTypedData & { signature: Hex };
  x402PaymentId: Hex;
}): Promise<{ agentId: string; transactionHash: Hex }> {
  const { config, parsed, x402PaymentId } = params;
  if (!config.agentRegistry || !config.relayerPrivateKey) {
    throw new AgentRegistrationError("Relayer is not configured", 503);
  }

  const account = privateKeyToAccount(config.relayerPrivateKey);
  await assertRelayerConfigured(config, account.address);

  const chain = chainConfig(config);
  const publicClient = createPublicClient({
    chain,
    transport: http(config.rpcUrl!),
  });
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(config.rpcUrl!),
  });

  const hash = await walletClient.writeContract({
    address: config.agentRegistry,
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
      x402PaymentId,
    ],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") {
    throw new AgentRegistrationError("On-chain registration transaction reverted", 502);
  }

  let agentId: bigint | null = null;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== config.agentRegistry!.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: agentRegistryAbi,
        data: log.data,
        topics: log.topics,
      });
      if (decoded.eventName === "AgentRegistered") {
        agentId = decoded.args.agentId;
        break;
      }
    } catch {
      // unrelated log
    }
  }

  if (agentId === null) {
    throw new AgentRegistrationError("AgentRegistered event not found in receipt", 502);
  }

  return { agentId: agentId.toString(), transactionHash: hash };
}

export async function getAgentRegistrationQuote(
  signer?: Address,
  env: Record<string, string | undefined> = getWorkerEnv(),
): Promise<AgentRegistrationQuote> {
  const config = loadAgentRegistrationConfig(env);
  const feeAtomic = await fetchRegistrationFeeAtomic(config);
  const feeUsd = await fetchRegistrationFeeUsd(config);

  let signerNonce: string | null = null;

  if (signer && config.mode === "live" && config.agentRegistry && config.rpcUrl) {
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
      amount: feeAtomic.toString(),
      assetSymbol: "USDC",
      decimals: 6,
      displayUsd: feeUsd,
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
  env: Record<string, string | undefined> = getWorkerEnv(),
): Promise<AgentRegistrationResponse> {
  const config = loadAgentRegistrationConfig(env);
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
      transactionHash: null,
      transaction: null,
      message:
        "Mock registration accepted (signature check skipped). Configure AGENT_REGISTRY_ADDRESS and RPC_URL for live registration.",
    };
  }

  if (!config.agentRegistry) {
    throw new AgentRegistrationError("AGENT_REGISTRY_ADDRESS is not configured", 503);
  }

  const feeAtomic = await fetchRegistrationFeeAtomic(config);
  const paymentIdFromRequest = getRegistrationPaymentId();
  const requiresPaidX402 =
    config.x402.enabled && config.x402.payTo !== null && feeAtomic > 0n;

  if (feeAtomic > 0n) {
    if (!config.x402.enabled || !config.x402.payTo) {
      throw new AgentRegistrationError(
        "x402 must be enabled when registration fee is non-zero",
        503,
      );
    }
    if (!paymentIdFromRequest) {
      throw new AgentRegistrationError(
        "x402 payment is required before registration (missing payment proof)",
        402,
      );
    }
  }

  const x402PaymentId: Hex =
    feeAtomic > 0n ? paymentIdFromRequest! : ZERO_X402_PAYMENT_ID;

  if (config.relayerPrivateKey) {
    const { agentId, transactionHash } = await submitRelayerRegistration({
      config,
      parsed,
      x402PaymentId,
    });

    return {
      mode: "live",
      agentId,
      transactionHash,
      transaction: null,
      message:
        feeAtomic > 0n
          ? "Agent registered on-chain by relayer after x402 fee settlement."
          : "Agent registered on-chain by relayer (zero registration fee).",
    };
  }

  if (requiresPaidX402) {
    throw new AgentRegistrationError(
      "RELAYER_PRIVATE_KEY is not configured; cannot submit registration after x402 payment",
      503,
    );
  }

  return {
    mode: "live",
    agentId: null,
    transactionHash: null,
    transaction: null,
    message:
      "Configure RELAYER_PRIVATE_KEY for on-chain registration, or call selfRegisterAgent directly when x402 is off.",
  };
}
