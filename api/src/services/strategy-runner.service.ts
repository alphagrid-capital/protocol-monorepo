import type { AgentProfileRow } from '../db/agent-profiles.repository.js'
import { AgentProfilesRepository } from '../db/agent-profiles.repository.js'
import { AgentSignersRepository } from '../db/agent-signers.repository.js'
import { StrategyRunsRepository } from '../db/strategy-runs.repository.js'
import { AppError } from '../errors.js'
import { decideStrategy } from '../lib/strategy/decision.js'
import type { StrategyContext, StrategyDecision } from '../lib/strategy/decision.js'
import { executeStrategyDecision } from '../lib/strategy/executor.js'
import type { ExecutionActionResult } from '../lib/strategy/executor.js'
import { assertStrategyDecisionGuardrails } from '../lib/strategy/guardrails.js'
import { computeNextRunAt } from '../lib/strategy/schedule.js'
import { loadTradingConfig } from '../lib/trading/config.js'
import {
  decryptSignerPrivateKey,
  requireSignerEncryptionKey,
} from '../lib/crypto/signer-key-crypto.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import { BotFrequencySchema } from '../schemas/agent-draft.js'
import { TokensService } from './tokens.service.js'
import { TradingService } from './trading.service.js'
import type { WorkerEnv } from '../types/worker-env.js'

const DUE_LIMIT = 10

function isStrategyRunnerExecuteEnabled(env: WorkerEnv): boolean {
  const raw = String(env.STRATEGY_RUNNER_EXECUTE ?? 'true').toLowerCase()
  return raw !== 'false' && raw !== '0' && raw !== 'no' && raw !== 'off'
}

function newRunId(): string {
  return `run_${crypto.randomUUID()}`
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

function summarizeExecutionFailures(
  execution: ExecutionActionResult[]
): string | undefined {
  const errors = execution
    .filter((item) => item.status === 'failed')
    .map((item) => item.error)
    .filter((message): message is string => Boolean(message))

  return errors.length > 0 ? errors.join('; ') : undefined
}

export interface StrategyRunnerTickResult {
  due: number
  processed: number
  completed: number
  failed: number
}

export class StrategyRunnerService {
  constructor(
    private readonly profilesRepository: AgentProfilesRepository,
    private readonly signersRepository: AgentSignersRepository,
    private readonly runsRepository: StrategyRunsRepository,
    private readonly env: WorkerEnv
  ) {}

  static fromEnv(env: WorkerEnv = getWorkerEnv()): StrategyRunnerService {
    return new StrategyRunnerService(
      new AgentProfilesRepository(env),
      new AgentSignersRepository(env),
      new StrategyRunsRepository(env),
      env
    )
  }

  async tick(): Promise<StrategyRunnerTickResult> {
    const nowIso = new Date().toISOString()
    const dueProfiles = await this.profilesRepository.listDue(nowIso, DUE_LIMIT)

    if (dueProfiles.length === 0) {
      return { due: 0, processed: 0, completed: 0, failed: 0 }
    }

    let prices: StrategyContext['prices'] = {}
    try {
      prices = (await TokensService.fromEnv(this.env).getOraclePrices()).prices
    } catch {
      prices = {}
    }

    let completed = 0
    let failed = 0

    for (const profile of dueProfiles) {
      if (await this.runAgent(profile, prices)) {
        completed += 1
      } else {
        failed += 1
      }
    }

    return {
      due: dueProfiles.length,
      processed: dueProfiles.length,
      completed,
      failed,
    }
  }

  private async runAgent(
    profile: AgentProfileRow,
    prices: StrategyContext['prices']
  ): Promise<boolean> {
    const runId = newRunId()
    const startedAt = new Date().toISOString()
    const botFrequency = BotFrequencySchema.parse(profile.bot_frequency)

    let decision: StrategyDecision | null = null
    let execution: ExecutionActionResult[] = []
    let runCreated = false

    try {
      const trading = TradingService.fromEnv(this.env)
      const [positionsResponse, risk, quote] = await Promise.all([
        trading.listOpenPositions(profile.agent_id),
        trading.getRiskState(profile.agent_id),
        trading.getQuote(profile.agent_id),
      ])
      const tradingConfig = loadTradingConfig(this.env)
      const context: StrategyContext = {
        agentId: profile.agent_id,
        strategy: profile.strategy,
        botFrequency,
        prices,
        positions: positionsResponse.positions,
        risk,
        guardrails: {
          allowedSymbols: quote.allowedSymbols,
          allocation: quote.allocation,
          exitBounds: quote.exitBounds,
          accountRiskBounds: quote.accountRiskBounds,
          dailyRealizedPnlUsdc: quote.dailyRealizedPnlUsdc,
          breaches: risk.breaches,
          defaultExit: quote.defaultExit,
          usdcDecimals: tradingConfig.usdcDecimals,
        },
      }

      await this.runsRepository.create({
        id: runId,
        agentId: profile.agent_id,
        status: 'running',
        startedAt,
        contextJson: JSON.stringify(context),
      })
      runCreated = true

      decision = await decideStrategy(context, this.env)
      assertStrategyDecisionGuardrails(decision, context)

      if (isStrategyRunnerExecuteEnabled(this.env) && decision.actions.length > 0) {
        const signerRow = await this.signersRepository.findByAgentId(
          profile.agent_id
        )
        if (!signerRow) {
          throw new AppError('Agent signer not found', 503, 'SERVICE_UNAVAILABLE')
        }
        const privateKey = await decryptSignerPrivateKey(
          signerRow.encrypted_signer_key,
          requireSignerEncryptionKey(this.env)
        )
        execution = await executeStrategyDecision(
          trading,
          profile.agent_id,
          privateKey,
          decision
        )
      }

      const executionError = summarizeExecutionFailures(execution)
      const status = executionError ? 'failed' : 'completed'

      await this.runsRepository.complete(runId, {
        status,
        decisionJson: JSON.stringify(decision),
        executionJson: JSON.stringify(execution),
        error: executionError ?? null,
        completedAt: new Date().toISOString(),
      })

      return status === 'completed'
    } catch (error) {
      if (runCreated) {
        await this.runsRepository.complete(runId, {
          status: 'failed',
          decisionJson: decision ? JSON.stringify(decision) : null,
          executionJson: JSON.stringify(execution),
          error: errorMessage(error, 'Strategy run failed'),
          completedAt: new Date().toISOString(),
        })
      }

      return false
    } finally {
      await this.profilesRepository.bumpNextRunAt(
        profile.agent_id,
        computeNextRunAt(botFrequency)
      )
    }
  }
}
