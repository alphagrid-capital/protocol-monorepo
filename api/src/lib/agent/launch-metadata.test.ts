import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAgentMetadataUri } from './launch-metadata.ts'

test('buildAgentMetadataUri encodes public profile fields only', () => {
  const uri = buildAgentMetadataUri({
    name: 'Quantum Hawk',
    handle: 'quantum-hawk',
    description: 'Test agent',
    links: { website: 'https://example.com' },
  })

  assert.match(uri, /^data:application\/json;base64,/)
  const base64 = uri.split(',')[1]
  const json = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'))
  assert.equal(json.handle, 'quantum-hawk')
  assert.equal(json.description, 'Test agent')
  assert.equal(json.links.website, 'https://example.com')
  assert.equal(json.strategy, undefined)
  assert.equal(json.pricingTier, undefined)
})
