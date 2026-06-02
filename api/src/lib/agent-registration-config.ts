import type { Network } from "@x402/core/types";
import { contracts } from "../constants/contracts.js";
import { parsePrivateKey } from "./evm-uilts.js";

export type AgentRegistrationConfig = {
  mode: "mock" | "live";
  agentRegistry: `0x${string}` | null;
  feeManager: `0x${string}` | null;
  chainId: number;
  rpcUrl: string | null;
  relayerPrivateKey: `0x${string}` | null;
  x402: {
    network: Network;
    facilitatorUrl: string;
  };
};

function requireEnv(
  env: Record<string, string | undefined>,
  key: "CHAIN_ID" | "X402_NETWORK" | "X402_FACILITATOR_URL",
): string {
  const value = env[key];
  if (!value) {
    throw new Error(`${key} is not configured`);
  }
  return value;
}

export function loadAgentRegistrationConfig(
  env: Record<string, string | undefined> = {},
): AgentRegistrationConfig {
  const chainId = Number(requireEnv(env, "CHAIN_ID"));
  const chainContracts = contracts[chainId] ?? { agentRegistry: null, feeManager: null };
  const agentRegistry = chainContracts.agentRegistry;
  const live = Boolean(agentRegistry);

  return {
    mode: live ? "live" : "mock",
    agentRegistry,
    feeManager: chainContracts.feeManager,
    chainId,
    rpcUrl: env.RPC_URL ?? null,
    relayerPrivateKey: parsePrivateKey(env.RELAYER_PRIVATE_KEY),
    x402: {
      network: requireEnv(env, "X402_NETWORK") as Network,
      facilitatorUrl: requireEnv(env, "X402_FACILITATOR_URL"),
    },
  };
}
