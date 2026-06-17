import { BigInt } from '@graphprotocol/graph-ts'
import { dataSource } from '@graphprotocol/graph-ts'
import { Agent } from '../../generated/schema'

export function loadOrCreateAgent(agentId: string): Agent {
  let agent = Agent.load(agentId)
  if (agent == null) {
    agent = new Agent(agentId)
    agent.owner = dataSource.address()
    agent.signer = dataSource.address()
    agent.payoutRecipient = dataSource.address()
    agent.vault = dataSource.address()
    agent.track = 0
    agent.status = 1
    agent.name = ''
    agent.metadataURI = ''
    agent.createdAt = BigInt.zero()
    agent.hasERC8004Identity = false
    agent.erc8004AgentId = BigInt.zero()
    agent.positionsOpened = 0
    agent.positionsClosed = 0
    agent.openPositionCount = 0
  }
  return agent
}
