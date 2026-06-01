import { createPublicClient, http } from "viem";
import type { AgentRegistrationConfig } from "../config/agent-registration.js";
import { atomicUsdcToUsdString } from "../config/agent-registration.js";

const feeManagerAbi = [
  {
    type: "function",
    name: "getRegistrationFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "amount", type: "uint256" }],
  },
] as const;

export async function fetchRegistrationFeeAtomic(
  config: AgentRegistrationConfig,
): Promise<bigint> {
  if (config.mode !== "live" || !config.feeManager || !config.rpcUrl) {
    return config.registrationFeeAtomic;
  }

  const client = createPublicClient({
    chain: {
      id: config.chainId,
      name: "alphagrid",
      nativeCurrency: { decimals: 18, name: "ETH", symbol: "ETH" },
      rpcUrls: { default: { http: [config.rpcUrl] } },
    },
    transport: http(config.rpcUrl),
  });

  return client.readContract({
    address: config.feeManager,
    abi: feeManagerAbi,
    functionName: "getRegistrationFee",
  });
}

export async function fetchRegistrationFeeUsd(
  config: AgentRegistrationConfig,
): Promise<string> {
  const atomic = await fetchRegistrationFeeAtomic(config);
  return atomicUsdcToUsdString(atomic);
}
