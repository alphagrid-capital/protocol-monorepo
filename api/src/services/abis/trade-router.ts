// Generated from contracts/out/TradeRouter.sol/TradeRouter.json. Do not edit.
// Regenerate: make build  (or: node scripts/sync-contract-abis.mjs)
export const tradeRouterAbi = [
  {
    type: 'constructor',
    inputs: [
      {
        name: 'admin',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'agentRegistry_',
        type: 'address',
        internalType: 'contract IAgentRegistry',
      },
      {
        name: 'allocationManager_',
        type: 'address',
        internalType: 'contract IAllocationManager',
      },
      {
        name: 'positionManager_',
        type: 'address',
        internalType: 'contract IPositionManager',
      },
      {
        name: 'swapAdapter_',
        type: 'address',
        internalType: 'contract ISwapAdapter',
      },
      {
        name: 'vaultTrackRegistry_',
        type: 'address',
        internalType: 'contract IVaultTrackRegistry',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'ADD_TO_POSITION_TYPEHASH',
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
    name: 'EXECUTOR_ROLE',
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
    name: 'MAX_EXIT_RULES',
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
    name: 'OPEN_POSITION_TYPEHASH',
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
    name: 'OPERATOR_ROLE',
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
    name: 'REDUCE_POSITION_TYPEHASH',
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
    name: 'UPDATE_EXIT_LADDER_TYPEHASH',
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
    name: 'addToPosition',
    inputs: [
      {
        name: 'intent',
        type: 'tuple',
        internalType: 'struct IPositionTypes.AddToPositionIntent',
        components: [
          {
            name: 'agentId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'positionId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'usdcAmount',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'minTokenOut',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'maxSlippageBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'deadline',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'nonce',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
      {
        name: 'signature',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: 'tokensAdded',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'agentRegistry',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IAgentRegistry',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'allocationManager',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IAllocationManager',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'dailyRealizedPnlUsdc',
    inputs: [
      {
        name: 'agentId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'day',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'int256',
        internalType: 'int256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'dailyTurnoverUsdc',
    inputs: [
      {
        name: 'agentId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'day',
        type: 'uint256',
        internalType: 'uint256',
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
    name: 'eip712Domain',
    inputs: [],
    outputs: [
      {
        name: 'fields',
        type: 'bytes1',
        internalType: 'bytes1',
      },
      {
        name: 'name',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'version',
        type: 'string',
        internalType: 'string',
      },
      {
        name: 'chainId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'verifyingContract',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'salt',
        type: 'bytes32',
        internalType: 'bytes32',
      },
      {
        name: 'extensions',
        type: 'uint256[]',
        internalType: 'uint256[]',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'executeExit',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'usdcOut',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'forceClose',
    inputs: [
      {
        name: 'positionId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: 'usdcOut',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
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
    name: 'isTriggerMet',
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
        type: 'bool',
        internalType: 'bool',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'keeperBountyBps',
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
    name: 'lifetimeRealizedPnlUsdc',
    inputs: [
      {
        name: 'agentId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'int256',
        internalType: 'int256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'lifetimeTurnoverUsdc',
    inputs: [
      {
        name: 'agentId',
        type: 'uint256',
        internalType: 'uint256',
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
    name: 'maxKeeperBounty',
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
    name: 'nonces',
    inputs: [
      {
        name: 'agentId',
        type: 'uint256',
        internalType: 'uint256',
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
    name: 'openPosition',
    inputs: [
      {
        name: 'intent',
        type: 'tuple',
        internalType: 'struct IPositionTypes.PositionIntent',
        components: [
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
            name: 'usdcAmount',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'minTokenOut',
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
          {
            name: 'deadline',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'nonce',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
      {
        name: 'signature',
        type: 'bytes',
        internalType: 'bytes',
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
    name: 'positionManager',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IPositionManager',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'positionPnlBps',
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
        type: 'int256',
        internalType: 'int256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'positionUnrealizedPnlUsdc',
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
        type: 'int256',
        internalType: 'int256',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'positionsClosed',
    inputs: [
      {
        name: 'agentId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint32',
        internalType: 'uint32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'positionsOpened',
    inputs: [
      {
        name: 'agentId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint32',
        internalType: 'uint32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'reducePosition',
    inputs: [
      {
        name: 'intent',
        type: 'tuple',
        internalType: 'struct IPositionTypes.ReducePositionIntent',
        components: [
          {
            name: 'agentId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'positionId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'exitBps',
            type: 'uint16',
            internalType: 'uint16',
          },
          {
            name: 'deadline',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'nonce',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
      {
        name: 'signature',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [
      {
        name: 'usdcOut',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
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
    name: 'setKeeperBounty',
    inputs: [
      {
        name: 'keeperBountyBps_',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maxKeeperBounty_',
        type: 'uint256',
        internalType: 'uint256',
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
    name: 'swapAdapter',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract ISwapAdapter',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'tradeCount',
    inputs: [
      {
        name: 'agentId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
    outputs: [
      {
        name: '',
        type: 'uint32',
        internalType: 'uint32',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'updateExitLadder',
    inputs: [
      {
        name: 'intent',
        type: 'tuple',
        internalType: 'struct IPositionTypes.UpdateExitLadderIntent',
        components: [
          {
            name: 'agentId',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'positionId',
            type: 'uint256',
            internalType: 'uint256',
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
          {
            name: 'deadline',
            type: 'uint256',
            internalType: 'uint256',
          },
          {
            name: 'nonce',
            type: 'uint256',
            internalType: 'uint256',
          },
        ],
      },
      {
        name: 'signature',
        type: 'bytes',
        internalType: 'bytes',
      },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'vaultTrackRegistry',
    inputs: [],
    outputs: [
      {
        name: '',
        type: 'address',
        internalType: 'contract IVaultTrackRegistry',
      },
    ],
    stateMutability: 'view',
  },
  {
    type: 'event',
    name: 'EIP712DomainChanged',
    inputs: [],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'ExitExecuted',
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
        name: 'keeper',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'usdcOut',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'keeperBounty',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'KeeperBountyUpdated',
    inputs: [
      {
        name: 'keeperBountyBps',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'maxKeeperBounty',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PositionExitLadderUpdatedFromIntent',
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
        name: 'nextRuleIndex',
        type: 'uint8',
        indexed: false,
        internalType: 'uint8',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PositionForceClosed',
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
        name: 'operator',
        type: 'address',
        indexed: true,
        internalType: 'address',
      },
      {
        name: 'usdcOut',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PositionIncreasedFromIntent',
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
        name: 'usdcIn',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
      {
        name: 'tokensAdded',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PositionOpenedFromIntent',
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
        name: 'usdcIn',
        type: 'uint256',
        indexed: false,
        internalType: 'uint256',
      },
    ],
    anonymous: false,
  },
  {
    type: 'event',
    name: 'PositionReducedFromIntent',
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
        name: 'exitBps',
        type: 'uint16',
        indexed: false,
        internalType: 'uint16',
      },
      {
        name: 'usdcOut',
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
    name: 'AgentNotSuspended',
    inputs: [
      {
        name: 'agentId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'AgentNotTradable',
    inputs: [
      {
        name: 'agentId',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'AllocationNotActive',
    inputs: [
      {
        name: 'agentId',
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
    name: 'ECDSAInvalidSignature',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ECDSAInvalidSignatureLength',
    inputs: [
      {
        name: 'length',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ECDSAInvalidSignatureS',
    inputs: [
      {
        name: 's',
        type: 'bytes32',
        internalType: 'bytes32',
      },
    ],
  },
  {
    type: 'error',
    name: 'ExceedsAllocationCap',
    inputs: [
      {
        name: 'agentId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'used',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'cap',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ExceedsDailyLoss',
    inputs: [
      {
        name: 'agentId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'lossUsdc',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maxLossUsdc',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ExceedsDailyTurnover',
    inputs: [
      {
        name: 'agentId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'turnover',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maxTurnover',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ExceedsMaxTradeSize',
    inputs: [
      {
        name: 'tradeSize',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maxTradeSize',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'ExitRulesOutOfBounds',
    inputs: [],
  },
  {
    type: 'error',
    name: 'ExpiredDeadline',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidExitRules',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidNonce',
    inputs: [
      {
        name: 'expected',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'provided',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'InvalidPrice',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidReduceAmount',
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
    name: 'InvalidShortString',
    inputs: [],
  },
  {
    type: 'error',
    name: 'InvalidSignature',
    inputs: [],
  },
  {
    type: 'error',
    name: 'LedgerExceedsVaultBalance',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'ledgerTotal',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'vaultBalance',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'PendingRuleAlreadyTriggered',
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
    name: 'PositionAgentMismatch',
    inputs: [
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
    name: 'ReentrancyGuardReentrantCall',
    inputs: [],
  },
  {
    type: 'error',
    name: 'RegistryPaused',
    inputs: [],
  },
  {
    type: 'error',
    name: 'SafeCastOverflowedIntToUint',
    inputs: [
      {
        name: 'value',
        type: 'int256',
        internalType: 'int256',
      },
    ],
  },
  {
    type: 'error',
    name: 'SafeCastOverflowedUintToInt',
    inputs: [
      {
        name: 'value',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'StalePrice',
    inputs: [
      {
        name: 'updatedAt',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'maxAge',
        type: 'uint256',
        internalType: 'uint256',
      },
    ],
  },
  {
    type: 'error',
    name: 'StringTooLong',
    inputs: [
      {
        name: 'str',
        type: 'string',
        internalType: 'string',
      },
    ],
  },
  {
    type: 'error',
    name: 'TokenNotAllowed',
    inputs: [
      {
        name: 'token',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'TooManyExitRules',
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
    name: 'TriggerNotMet',
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
    name: 'VaultMismatch',
    inputs: [
      {
        name: 'agentId',
        type: 'uint256',
        internalType: 'uint256',
      },
      {
        name: 'expected',
        type: 'address',
        internalType: 'address',
      },
      {
        name: 'actual',
        type: 'address',
        internalType: 'address',
      },
    ],
  },
  {
    type: 'error',
    name: 'VaultTrackNotActive',
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
  },
  {
    type: 'error',
    name: 'ZeroAddress',
    inputs: [],
  },
] as const
