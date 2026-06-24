export const AGENT_ACTIVITIES_QUERY = `
query AgentActivities($agentId: ID!, $first: Int!, $skip: Int!) {
  _meta {
    block {
      number
    }
  }
  agentActivities(
    where: { agent: $agentId }
    orderBy: blockNumber
    orderDirection: desc
    first: $first
    skip: $skip
  ) {
    type
    position {
      id
    }
    blockNumber
    blockTimestamp
    transactionHash
    logIndex
    source
    vault
    token
    symbol
    usdcIn
    usdcOut
    tokensAdded
    exitBps
    ruleIndex
    nextRuleIndex
    keeper
    keeperBounty
    operator
    realizedPnlUsdc
  }
}
`

export const CLOSED_POSITIONS_QUERY = `
query ClosedPositions($agentId: ID!, $first: Int!) {
  positions(
    where: { agent: $agentId, status: "Closed" }
    orderBy: closedAt
    orderDirection: desc
    first: $first
  ) {
    id
    agent {
      id
    }
    symbol
    token
    vault
    tokenAmount
    entryPriceUsdc
    usdcCostBasis
    maxSlippageBps
    status
    nextRuleIndex
    exitRules {
      index
      triggerType
      triggerBps
      exitBps
    }
    openedAt
    realizedPnlUsdc
  }
}
`

export const AGENT_EQUITY_SNAPSHOTS_QUERY = `
query AgentEquitySnapshots($agentId: ID!, $first: Int!) {
  _meta {
    block {
      number
    }
  }
  agent(id: $agentId) {
    equitySnapshots(
      orderBy: blockTimestamp
      orderDirection: asc
      first: $first
    ) {
      blockNumber
      blockTimestamp
      transactionHash
      logIndex
      trigger
      allocationCap
      lifetimeRealizedPnlUsdc
      unrealizedPnlUsdc
      equityUsdc
      peakEquityUsdc
      drawdownBps
      returnBps
    }
  }
}
`
