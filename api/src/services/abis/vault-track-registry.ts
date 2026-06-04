// Generated from contracts/out/VaultTrackRegistry.sol/VaultTrackRegistry.json. Do not edit.
// Regenerate: make build  (or: node scripts/sync-contract-abis.mjs)
export const vaultTrackRegistryAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'admin',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'CONFIG_ADMIN_ROLE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'DEFAULT_ADMIN_ROLE',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_BPS',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'MAX_TRACK_ID',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'capitalModeOf',
    inputs: [
      {
        name: 'vault',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'trackId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint8',
        internalType: 'enum IVaultTrackRegistry.CapitalMode',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getRoleAdmin',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getTrackType',
    inputs: [
      {
        name: 'trackId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct IVaultTrackRegistry.TrackType',
        components: [
          {
            name: 'trackId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'name',
            type: 'bytes32',
            internalType: 'bytes32',
          },
          {
            name: 'capitalMode',
            type: 'uint8',
            internalType: 'enum IVaultTrackRegistry.CapitalMode',
          },
          {
            name: 'active',
            type: 'bool',
            internalType: 'bool',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getVaultTrackConfig',
    inputs: [
      {
        name: 'vault',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'trackId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct IVaultTrackRegistry.VaultTrackConfig',
        components: [
          {
            name: 'vault',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'trackId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'initialAllocation',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxAllocation',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxDrawdownBps',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxTradeSizeBps',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxDailyTurnoverBps',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'evaluationPeriod',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'minTrades',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'promotionScore',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'active',
            type: 'bool',
            internalType: 'bool',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'grantRole',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'hasRole',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isRegisteredVault',
    inputs: [
      {
        name: 'vault',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isVaultTrackActive',
    inputs: [
      {
        name: 'vault',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'trackId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'renounceRole',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'callerConfirmation',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokeRole',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'setVaultTrackConfig',
    inputs: [
      {
        name: 'vault',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'trackId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'config',
        type: 'tuple',
        internalType: 'struct IVaultTrackRegistry.VaultTrackConfig',
        components: [
          {
            name: 'vault',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'trackId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'initialAllocation',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxAllocation',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxDrawdownBps',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxTradeSizeBps',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxDailyTurnoverBps',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'evaluationPeriod',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'minTrades',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'promotionScore',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'active',
            type: 'bool',
            internalType: 'bool',
          },
        ],
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'supportsInterface',
    inputs: [
      {
        name: 'interfaceId',
        type: 'bytes4',
        internalType: 'bytes4',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'vaultAt',
    inputs: [
      {
        name: 'index',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'address',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'vaultCount',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'RoleAdminChanged',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'previousAdminRole',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'newAdminRole',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RoleGranted',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'account',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'sender',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'RoleRevoked',
    inputs: [
      {
        name: 'role',
        type: 'bytes32',
        indexed: true,
        internalType: 'bytes32',
      },
      {
        name: 'account',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'sender',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'TrackTypeUpdated',
    inputs: [
      {
        name: 'trackId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'name',
        type: 'bytes32',
        indexed: false,
        internalType: 'bytes32',
      },
      {
        name: 'capitalMode',
        type: 'uint8',
        indexed: false,
        internalType: 'enum IVaultTrackRegistry.CapitalMode',
      },
      {
        name: 'active',
        type: 'bool',
        indexed: false,
        internalType: 'bool',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'VaultRegistered',
    inputs: [
      {
        name: 'vault',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'VaultTrackConfigUpdated',
    inputs: [
      {
        name: 'vault',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'trackId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'config',
        type: 'tuple',
        indexed: false,
        internalType: 'struct IVaultTrackRegistry.VaultTrackConfig',
        components: [
          {
            name: 'vault',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'trackId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'initialAllocation',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxAllocation',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxDrawdownBps',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxTradeSizeBps',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxDailyTurnoverBps',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'evaluationPeriod',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'minTrades',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'promotionScore',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'active',
            type: 'bool',
            internalType: 'bool',
          },
        ],
      },
    ],
    anonymous: false,
  },
  {
    type: 'error',
    name: 'AccessControlBadConfirmation',
    inputs: [],
  },
  {
    type: 'error',
    name: 'AccessControlUnauthorizedAccount',
    inputs: [
      {
        name: 'account',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'neededRole',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'AllocationOutOfRange',
    inputs: [
      {
        name: 'initialAllocation',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maxAllocation',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'BpsOutOfRange',
    inputs: [
      {
        name: 'bps',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidTrackId',
    inputs: [
      {
        name: 'trackId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ZeroAddress',
    inputs: [],
  },
] as const
