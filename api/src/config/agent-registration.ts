/** On-chain AgentRegistry `SELF_REGISTER_TYPEHASH`. */
export const SELF_REGISTER_TYPEHASH =
  "0x943fcd588cbf2f97757c6f41f78f5a7f133ad3f3111e330a636c80c3e3c70679" as const;

export type AgentRegistrationConfig = {
  mode: "mock" | "live";
  agentRegistry: `0x${string}` | null;
  feeManager: `0x${string}` | null;
  chainId: number;
  rpcUrl: string | null;
  treasury: `0x${string}` | null;
  registrationFeeAtomic: bigint;
  registrationFeeUsd: string;
  registrationFeeRelayer: `0x${string}` | null;
  relayerPrivateKey: `0x${string}` | null;
  x402: {
    enabled: boolean;
    payTo: `0x${string}` | null;
    network: string;
    facilitatorUrl: string;
  };
};

function parseAddress(value: string | undefined): `0x${string}` | null {
  if (!value || !/^0x[a-fA-F0-9]{40}$/.test(value)) return null;
  return value as `0x${string}`;
}

function parsePrivateKey(value: string | undefined): `0x${string}` | null {
  if (!value) return null;
  const normalized = value.startsWith("0x") ? value : `0x${value}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(normalized)) return null;
  return normalized as `0x${string}`;
}

export function atomicUsdcToUsdString(amount: bigint, decimals = 6): string {
  const whole = amount / 10n ** BigInt(decimals);
  const frac = amount % 10n ** BigInt(decimals);
  if (frac === 0n) return `$${whole}`;
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `$${whole}.${fracStr}`;
}

export function loadAgentRegistrationConfig(
  env: Record<string, string | undefined> = {},
): AgentRegistrationConfig {
  const agentRegistry = parseAddress(env.AGENT_REGISTRY_ADDRESS);
  const treasury = parseAddress(env.TREASURY_ADDRESS ?? env.X402_PAY_TO);
  const payTo = parseAddress(env.X402_PAY_TO ?? env.TREASURY_ADDRESS);
  const feeAtomic = env.REGISTRATION_FEE_ATOMIC
    ? BigInt(env.REGISTRATION_FEE_ATOMIC)
    : 50_000_000n;
  const chainId = env.CHAIN_ID ? Number(env.CHAIN_ID) : 84532;
  const live = Boolean(agentRegistry && treasury);

  return {
    mode: live ? "live" : "mock",
    agentRegistry,
    feeManager: parseAddress(env.FEE_MANAGER_ADDRESS),
    chainId,
    rpcUrl: env.RPC_URL ?? null,
    treasury,
    registrationFeeAtomic: feeAtomic,
    registrationFeeUsd: env.REGISTRATION_FEE_USD ?? atomicUsdcToUsdString(feeAtomic),
    registrationFeeRelayer: parseAddress(env.REGISTRATION_FEE_RELAYER_ADDRESS),
    relayerPrivateKey: parsePrivateKey(env.RELAYER_PRIVATE_KEY),
    x402: {
      enabled: Boolean(payTo && env.X402_ENABLED !== "false"),
      payTo,
      network: env.X402_NETWORK ?? "eip155:84532",
      facilitatorUrl: env.X402_FACILITATOR_URL ?? "https://x402.org/facilitator",
    },
  };
}
