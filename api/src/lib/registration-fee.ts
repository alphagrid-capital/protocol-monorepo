import { createPublicClient, http } from "viem";
import type { AgentRegistrationConfig } from "../config/agent-registration.js";
import { atomicUsdcToUsdString } from "../config/agent-registration.js";

const feeManagerAbi = [
  {
    type: "function",
    name: "treasury",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "getRegistrationFee",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "amount", type: "uint256" }],
  },
] as const;

export async function fetchRegistrationFeeState(
  config: AgentRegistrationConfig,
): Promise<{ amount: bigint; treasury: `0x${string}` | null }> {
  if (config.mode !== "live" || !config.feeManager || !config.rpcUrl) {
    return { amount: 0n, treasury: null };
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

  const [amount, treasury] = await Promise.all([
    client.readContract({
      address: config.feeManager,
      abi: feeManagerAbi,
      functionName: "getRegistrationFee",
    }),
    client.readContract({
      address: config.feeManager,
      abi: feeManagerAbi,
      functionName: "treasury",
    }),
  ]);

  return { amount, treasury };
}

export async function fetchRegistrationFeeDetails(
  config: AgentRegistrationConfig,
): Promise<{ amount: bigint; treasury: `0x${string}` | null; displayUsd: string }> {
  const state = await fetchRegistrationFeeState(config);
  return {
    ...state,
    displayUsd: atomicUsdcToUsdString(state.amount),
  };
}

export async function fetchRegistrationFeeAtomic(
  config: AgentRegistrationConfig,
): Promise<bigint> {
  const state = await fetchRegistrationFeeState(config);
  return state.amount;
}

export async function fetchRegistrationFeeUsd(
  config: AgentRegistrationConfig,
): Promise<string> {
  const state = await fetchRegistrationFeeState(config);
  return atomicUsdcToUsdString(state.amount);
}
