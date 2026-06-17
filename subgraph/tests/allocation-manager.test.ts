import {
  assert,
  describe,
  test,
  clearStore,
  beforeEach,
  newTypedMockEventWithParams,
} from 'matchstick-as/assembly/index'
import { Address, BigInt, ethereum } from '@graphprotocol/graph-ts'
import { handleAllocationCreated } from '../src/allocation-manager'
import { AllocationCreated } from '../generated/AllocationManager/AllocationManager'
import { Allocation } from '../generated/schema'

describe('Allocation indexing', () => {
  beforeEach(() => {
    clearStore()
  })

  test('AllocationCreated stores allocation row', () => {
    const event = newTypedMockEventWithParams<AllocationCreated>([
      new ethereum.EventParam(
        'agentId',
        ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))
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
      new ethereum.EventParam(
        'cap',
        ethereum.Value.fromUnsignedBigInt(BigInt.fromString('1000000000'))
      ),
    ])
    event.address = Address.fromString(
      '0x71C3E2237B4f5b19145ddf793B9DaAADFA13E165'
    )

    handleAllocationCreated(event)

    assert.entityCount('Allocation', 1)
    const allocation = Allocation.load('1')
    assert.assertNotNull(allocation)
    assert.bigIntEquals(allocation!.cap, BigInt.fromString('1000000000'))
  })
})
