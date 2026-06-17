import {
  assert,
  describe,
  test,
  clearStore,
  beforeEach,
  createMockedFunction,
  newTypedMockEventWithParams,
} from 'matchstick-as/assembly/index'
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { handleAllocationCreated } from '../src/allocation-manager'
import { AllocationCreated } from '../generated/AllocationManager/AllocationManager'
import { AgentEquitySnapshot } from '../generated/schema'
import {
  tradeRouterAddress,
  tradeRouterLensAddress,
} from '../src/lib/network-contracts'

const AGENT_ID = BigInt.fromI32(1)
const CAP = BigInt.fromString('1000000000')

function mockEquityLensCalls(): void {
  const agentArg = [ethereum.Value.fromUnsignedBigInt(AGENT_ID)]

  createMockedFunction(
    tradeRouterLensAddress(),
    'currentEquityUsdc',
    'currentEquityUsdc(uint256):(uint256)'
  )
    .withArgs(agentArg)
    .returns([ethereum.Value.fromUnsignedBigInt(CAP)])

  createMockedFunction(
    tradeRouterLensAddress(),
    'peakEquityUsdc',
    'peakEquityUsdc(uint256):(uint256)'
  )
    .withArgs(agentArg)
    .returns([ethereum.Value.fromUnsignedBigInt(CAP)])

  createMockedFunction(
    tradeRouterLensAddress(),
    'currentDrawdownBps',
    'currentDrawdownBps(uint256):(uint256)'
  )
    .withArgs(agentArg)
    .returns([ethereum.Value.fromUnsignedBigInt(BigInt.zero())])

  createMockedFunction(
    tradeRouterAddress(),
    'lifetimeRealizedPnlUsdc',
    'lifetimeRealizedPnlUsdc(uint256):(int256)'
  )
    .withArgs(agentArg)
    .returns([ethereum.Value.fromSignedBigInt(BigInt.zero())])
}

describe('Equity snapshots', () => {
  beforeEach(() => {
    clearStore()
  })

  test('AllocationCreated stores equity snapshot', () => {
    mockEquityLensCalls()

    const event = newTypedMockEventWithParams<AllocationCreated>([
      new ethereum.EventParam(
        'agentId',
        ethereum.Value.fromUnsignedBigInt(AGENT_ID)
      ),
      new ethereum.EventParam(
        'vault',
        ethereum.Value.fromAddress(
          Address.fromString('0xa1291D77Eec59c1BE7dd30D0D7e50D659f1C5a84')
        )
      ),
      new ethereum.EventParam(
        'trackId',
        ethereum.Value.fromUnsignedBigInt(BigInt.zero())
      ),
      new ethereum.EventParam('cap', ethereum.Value.fromUnsignedBigInt(CAP)),
    ])
    event.address = Address.fromString(
      '0x71C3E2237B4f5b19145ddf793B9DaAADFA13E165'
    )
    event.logIndex = BigInt.fromI32(0)

    handleAllocationCreated(event)

    assert.entityCount('AgentEquitySnapshot', 1)
    const snapshot = AgentEquitySnapshot.load('1-1-0')
    assert.assertNotNull(snapshot)
    assert.bigIntEquals(snapshot!.equityUsdc, CAP)
    assert.bigIntEquals(snapshot!.allocationCap, CAP)
    assert.stringEquals(snapshot!.trigger, 'AllocationCreated')
  })
})
