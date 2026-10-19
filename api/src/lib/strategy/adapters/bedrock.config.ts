import type { WorkerEnv } from '../../../types/worker-env.js'

export const DEFAULT_BEDROCK_REGION = 'eu-central-1'
export const DEFAULT_BEDROCK_MODEL_ID = 'eu.amazon.nova-lite-v1:0'
export const DEFAULT_BEDROCK_MAX_TOKENS = 512

export interface BedrockConfig {
  region: string
  modelId: string
  maxTokens: number
  accessKeyId: string
  secretAccessKey: string
  sessionToken?: string
}

function parseMaxTokens(env: WorkerEnv): number {
  const raw = env.STRATEGY_AI_MAX_TOKENS ?? env.BEDROCK_MAX_TOKENS
  if (!raw) {
    return DEFAULT_BEDROCK_MAX_TOKENS
  }
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid STRATEGY_AI_MAX_TOKENS/BEDROCK_MAX_TOKENS: ${raw}`)
  }
  return parsed
}

export function loadBedrockConfig(env: WorkerEnv = {}): BedrockConfig {
  const accessKeyId = env.AWS_ACCESS_KEY_ID?.trim()
  const secretAccessKey = env.AWS_SECRET_ACCESS_KEY?.trim()
  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      'Bedrock adapter requires AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY'
    )
  }

  const sessionToken = env.AWS_SESSION_TOKEN?.trim() || undefined
  const region =
    env.AWS_REGION?.trim() ||
    env.AWS_DEFAULT_REGION?.trim() ||
    DEFAULT_BEDROCK_REGION
  const modelId =
    env.BEDROCK_MODEL_ID?.trim() || DEFAULT_BEDROCK_MODEL_ID

  return {
    region,
    modelId,
    maxTokens: parseMaxTokens(env),
    accessKeyId,
    secretAccessKey,
    sessionToken,
  }
}
