export type ChainContracts = {
  agentRegistry: `0x${string}` | null;
  feeManager: `0x${string}` | null;
};

export const contracts: Record<number, ChainContracts> = {
  84532: {
    agentRegistry: null,
    feeManager: null,
  },
};
