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
