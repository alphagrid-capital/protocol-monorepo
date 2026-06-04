// Generated from contracts/out/PositionManager.sol/PositionManager.json. Do not edit.
// Regenerate: make build  (or: node scripts/sync-contract-abis.mjs)
export const positionManagerAbi = [
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
    name: 'TRADE_ROUTER_ADMIN_ROLE',
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
    name: 'agentTokenBalance',
    inputs: [
      {
        name: 'agentId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
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
    name: 'applyExit',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'tokenSold',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'usdcReleased',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'ruleIndex',
        type: 'uint8',
        internalType: 'uint8',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'getExitRules',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple[]',
        internalType: 'struct IPositionTypes.ExitRule[]',
        components: [
          {
            name: 'triggerType',
            type: 'uint8',
            internalType: 'enum IPositionTypes.TriggerType',
          },
          {
            name: 'triggerBps',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'exitBps',
            type: 'uint16',
            internalType: 'uint16',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getNextExitRule',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct IPositionTypes.ExitRule',
        components: [
          {
            name: 'triggerType',
            type: 'uint8',
            internalType: 'enum IPositionTypes.TriggerType',
          },
          {
            name: 'triggerBps',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'exitBps',
            type: 'uint16',
            internalType: 'uint16',
          },
        ],
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getPosition',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'tuple',
        internalType: 'struct IPositionTypes.Position',
        components: [
          {
            name: 'positionId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'agentId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'vault',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'token',
            type: 'address',
            internalType: 'address',
          },
          {
            name: 'tokenAmount',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'entryPriceUsdc',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'usdcCostBasis',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxSlippageBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'status',
            type: 'uint8',
            internalType: 'enum IPositionTypes.PositionStatus',
          },
          {
            name: 'nextRuleIndex',
            type: 'uint8',
            internalType: 'uint8',
          },
          {
            name: 'openedAt',
            type: 'uint64',
            internalType: 'uint64',
          },
        ],
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
    name: 'openPosition',
    inputs: [
      {
        name: 'agentId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'vault',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'tokenAmount',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'entryPriceUsdc',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'usdcCostBasis',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maxSlippageBps',
        type: 'uint16',
        internalType: 'uint16',
      },
      {
        name: 'exits',
        type: 'tuple[]',
        internalType: 'struct IPositionTypes.ExitRule[]',
        components: [
          {
            name: 'triggerType',
            type: 'uint8',
            internalType: 'enum IPositionTypes.TriggerType',
          },
          {
            name: 'triggerBps',
            type: 'int256',
            internalType: 'int256',
          },
          {
            name: 'exitBps',
            type: 'uint16',
            internalType: 'uint16',
          },
        ],
      },
    ],
    outputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'openPositionId',
    inputs: [
      {
        name: 'agentId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
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
    name: 'positionCount',
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
    name: 'setTradeRouter',
    inputs: [
      {
        name: 'tradeRouter_',
        type: 'address',
        internalType: 'address',
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
    name: 'totalTokenLedger',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
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
    name: 'tradeRouter',
    inputs: [],
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
    type: 'event',
    name: 'PositionClosed',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'agentId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PositionExitApplied',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'agentId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'ruleIndex',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
      {
        name: 'tokenSold',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'usdcReleased',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PositionOpened',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'agentId',
        type: 'uint256',
        indexed: true,
        internalType: 'uint256',
      },
      {
        name: 'vault',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'token',
        type: 'address',
        indexed: false,
        internalType: 'address',
      },
      {
        name: 'tokenAmount',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'entryPriceUsdc',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'usdcCostBasis',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
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
    name: 'InvalidExitState',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'NotTradeRouter',
    inputs: [
      {
        name: 'caller',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'PositionAlreadyOpen',
    inputs: [
      {
        name: 'agentId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'PositionNotFound',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'PositionNotOpen',
    inputs: [
      {
        name: 'positionId',
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
