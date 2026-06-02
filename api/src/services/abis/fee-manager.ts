export const feeManagerAbi = [
  {
    type: 'function',
    name: 'treasury',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'getRegistrationFee',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: 'amount', type: 'uint256' }],
  },
] as const
