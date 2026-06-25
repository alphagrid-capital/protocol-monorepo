import type { WorkerEnv } from '../../types/worker-env.js'

const DEFAULT_MANUAL_COOLDOWN_MS = 5 * 60 * 1000

export function loadStrategyRunManualCooldownMs(env: WorkerEnv): number {
  const raw = env.STRATEGY_RUN_MANUAL_COOLDOWN_SECONDS
  if (raw === undefined || raw === '') {
    return DEFAULT_MANUAL_COOLDOWN_MS
  }

  const seconds = Number.parseInt(raw, 10)
  if (!Number.isFinite(seconds) || seconds < 0) {
    return DEFAULT_MANUAL_COOLDOWN_MS
  }

  return seconds * 1000
}

export function getStrategyRunCooldown(
  lastStartedAt: string | null,
  cooldownMs: number,
  nowMs = Date.now()
): { allowed: true } | { allowed: false; retryAfterSeconds: number } {
  if (!lastStartedAt || cooldownMs === 0) {
    return { allowed: true }
  }

  const lastMs = Date.parse(lastStartedAt)
  if (!Number.isFinite(lastMs)) {
    return { allowed: true }
  }

  const elapsed = nowMs - lastMs
  if (elapsed >= cooldownMs) {
    return { allowed: true }
  }

  return {
    allowed: false,
    retryAfterSeconds: Math.ceil((cooldownMs - elapsed) / 1000),
  }
}
