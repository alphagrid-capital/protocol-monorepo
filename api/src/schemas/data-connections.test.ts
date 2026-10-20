import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DataConnectionsSchema,
  parseDataConnections,
  serializeDataConnections,
} from './data-connections.ts'

test('DataConnectionsSchema normalizes Truth Social username', () => {
  const parsed = DataConnectionsSchema.parse({
    truthsocial: { enabled: true, username: '@realDonaldTrump' },
  })
  assert.deepEqual(parsed, {
    truthsocial: { enabled: true, username: 'realDonaldTrump' },
  })
})

test('DataConnectionsSchema rejects unknown providers', () => {
  assert.throws(() =>
    DataConnectionsSchema.parse({
      twitter: { enabled: true, username: 'elonmusk' },
    })
  )
})

test('DataConnectionsSchema normalizes equity news symbols', () => {
  const parsed = DataConnectionsSchema.parse({
    equitynews: { enabled: true, symbols: ['nvda', 'AAPL'] },
  })
  assert.deepEqual(parsed, {
    equitynews: { enabled: true, symbols: ['NVDA', 'AAPL'] },
  })
})

test('DataConnectionsSchema allows equity news without symbols', () => {
  const parsed = DataConnectionsSchema.parse({
    equitynews: { enabled: true },
  })
  assert.deepEqual(parsed, {
    equitynews: { enabled: true },
  })
})

test('DataConnectionsSchema normalizes FRED series ids', () => {
  const parsed = DataConnectionsSchema.parse({
    fred: { enabled: true, seriesIds: ['unrate', 'DFF'] },
  })
  assert.deepEqual(parsed, {
    fred: { enabled: true, seriesIds: ['UNRATE', 'DFF'] },
  })
})

test('DataConnectionsSchema allows FRED without seriesIds', () => {
  const parsed = DataConnectionsSchema.parse({
    fred: { enabled: true },
  })
  assert.deepEqual(parsed, {
    fred: { enabled: true },
  })
})

test('parseDataConnections returns empty object for invalid JSON', () => {
  assert.deepEqual(parseDataConnections('not-json'), {})
  assert.deepEqual(parseDataConnections(null), {})
})

test('serializeDataConnections returns null for empty object', () => {
  assert.equal(serializeDataConnections({}), null)
  assert.equal(
    serializeDataConnections({
      truthsocial: { enabled: false, username: 'someone' },
    }),
    JSON.stringify({
      truthsocial: { enabled: false, username: 'someone' },
    })
  )
})
