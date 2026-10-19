import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEFAULT_BEDROCK_MODEL_ID,
  DEFAULT_BEDROCK_REGION,
  loadBedrockConfig,
} from './bedrock.config.ts'

test('loadBedrockConfig defaults region and model', () => {
  const config = loadBedrockConfig({
    AWS_ACCESS_KEY_ID: 'AKIATEST',
    AWS_SECRET_ACCESS_KEY: 'secret',
  })
  assert.equal(config.region, DEFAULT_BEDROCK_REGION)
  assert.equal(config.modelId, DEFAULT_BEDROCK_MODEL_ID)
  assert.equal(config.maxTokens, 512)
  assert.equal(config.sessionToken, undefined)
})

test('loadBedrockConfig reads env overrides', () => {
  const config = loadBedrockConfig({
    AWS_ACCESS_KEY_ID: 'AKIATEST',
    AWS_SECRET_ACCESS_KEY: 'secret',
    AWS_SESSION_TOKEN: 'token',
    AWS_REGION: 'eu-west-1',
    BEDROCK_MODEL_ID: 'eu.amazon.nova-micro-v1:0',
    STRATEGY_AI_MAX_TOKENS: '256',
  })
  assert.equal(config.region, 'eu-west-1')
  assert.equal(config.modelId, 'eu.amazon.nova-micro-v1:0')
  assert.equal(config.maxTokens, 256)
  assert.equal(config.sessionToken, 'token')
})

test('loadBedrockConfig requires AWS keys', () => {
  assert.throws(() => loadBedrockConfig({}), /AWS_ACCESS_KEY_ID/)
})
