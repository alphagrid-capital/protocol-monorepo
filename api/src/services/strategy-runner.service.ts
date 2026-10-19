import type { AgentProfileRow } from '../db/agent-profiles.repository.js'
import { AgentProfilesRepository } from '../db/agent-profiles.repository.js'
import { AgentSignersRepository } from '../db/agent-signers.repository.js'
import { StrategyRunsRepository } from '../db/strategy-runs.repository.js'
import { AppError } from '../errors.js'
import { normalizeAddress } from '../lib/evm/utils.js'
import { decideStrategy } from '../lib/strategy/decision.js'
import type {
  StrategyContext,
  StrategyDecision,
  StrategyAdapterOutcome,
} from '../lib/strategy/decision.js'
import { resolveStrategyDecisionMeta } from '../lib/strategy/adapters/decision-meta.js'
import { executeStrategyDecision } from '../lib/strategy/executor.js'
import type { ExecutionActionResult } from '../lib/strategy/executor.js'
import { assertStrategyDecisionGuardrails } from '../lib/strategy/guardrails.js'
import { computeNextRunAt } from '../lib/strategy/schedule.js'
import { loadTradingConfig } from '../lib/trading/config.js'
import {
  decryptSignerPrivateKey,
  requireSignerEncryptionKey,
} from '../lib/crypto/signer-key-crypto.js'
import type { SignalFeed } from '../lib/signals/types.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import { BotFrequencySchema } from '../schemas/agent-draft.js'
import { parseDataConnections } from '../schemas/data-connections.js'
import { createSignalsService } from './signals.service.js'
import { TokensService } from './tokens.service.js'
import { TradingService } from './trading.service.js'
import { AgentRegistrationService } from './agent-registration.service.js'
import type { WorkerEnvWithAi } from '../types/worker-env.js'

const DUE_LIMIT = 10

function isStrategyRunnerExecuteEnabled(env: WorkerEnvWithAi): boolean {
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

export interface StrategyAgentRunResult {
  runId: string | null
  status: 'completed' | 'failed'
  startedAt: string
  completedAt: string | null
  summary: string | null
  reasoning: string | null
  provider: string | null
  modelId: string | null
  actions: StrategyDecision['actions']
  execution: ExecutionActionResult[]
  error: string | null
}

export interface RunAgentOptions {
  executeOverride?: boolean
}

export class StrategyRunnerService {
  constructor(
    private readonly profilesRepository: AgentProfilesRepository,
    private readonly signersRepository: AgentSignersRepository,
    private readonly runsRepository: StrategyRunsRepository,
    private readonly env: WorkerEnvWithAi
  ) {}

  static fromEnv(env: WorkerEnvWithAi = getWorkerEnv()): StrategyRunnerService {
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

    const truthUsernames: string[] = []
    const equitySymbolSets: string[][] = []
    for (const profile of dueProfiles) {
      const connections = parseDataConnections(profile.data_connections)
      const truth = connections.truthsocial
      if (truth?.enabled && truth.username) {
        truthUsernames.push(truth.username)
      }
      const equity = connections.equitynews
      if (equity?.enabled && equity.symbols && equity.symbols.length > 0) {
        equitySymbolSets.push(equity.symbols)
      }
    }

    const signalsService = createSignalsService(this.env)
    let truthFeeds = new Map<string, SignalFeed>()
    let equityFeeds = new Map<string, SignalFeed>()
    try {
      truthFeeds = await signalsService.prefetchTruthSocial(truthUsernames)
    } catch {
      truthFeeds = new Map()
    }
    try {
      equityFeeds = await signalsService.prefetchEquityNews(equitySymbolSets)
    } catch {
      equityFeeds = new Map()
    }

    let completed = 0
    let failed = 0

    for (const profile of dueProfiles) {
      const result = await this.runAgent(
        profile,
        prices,
        {},
        truthFeeds,
        equityFeeds
      )
      if (result.status === 'completed') {
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

  async runAgentById(
    agentId: string,
    options: RunAgentOptions = {}
  ): Promise<StrategyAgentRunResult> {
    const profile = await this.profilesRepository.findByAgentId(agentId)
    if (!profile) {
      throw new AppError(
        'Managed agent profile not found',
        404,
        'INVALID_REQUEST'
      )
    }
    if (profile.archived_at !== null) {
      throw new AppError(
        'Archived agents cannot run strategy',
        400,
        'INVALID_REQUEST'
      )
    }

    let prices: StrategyContext['prices'] = {}
    try {
      prices = (await TokensService.fromEnv(this.env).getOraclePrices()).prices
    } catch {
      prices = {}
    }

    return this.runAgent(profile, prices, options)
  }

  private async runAgent(
    profile: AgentProfileRow,
    prices: StrategyContext['prices'],
    options: RunAgentOptions = {},
    prefetchedTruthFeeds?: Map<string, SignalFeed>,
    prefetchedEquityFeeds?: Map<string, SignalFeed>
  ): Promise<StrategyAgentRunResult> {
    const runId = newRunId()
    const startedAt = new Date().toISOString()
    const botFrequency = BotFrequencySchema.parse(profile.bot_frequency)

    let decision: StrategyDecision | null = null
    let outcome: StrategyAdapterOutcome | null = null
    let execution: ExecutionActionResult[] = []
    let runCreated = false
    let completedAt: string | null = null
    const decisionMeta = resolveStrategyDecisionMeta(this.env)

    try {
      const onChain = await AgentRegistrationService.fromEnv(this.env).getAgent(
        profile.agent_id
      )
      if (
        normalizeAddress(onChain.agent.owner) !==
        normalizeAddress(profile.owner_address)
      ) {
        await this.profilesRepository.syncOwnerAddress(
          profile.agent_id,
          onChain.agent.owner
        )
        await this.signersRepository.syncOwnerAddress(
          profile.agent_id,
          onChain.agent.owner
        )
      }

      const trading = TradingService.fromEnv(this.env)
      const [positionsResponse, risk, quote] = await Promise.all([
        trading.listOpenPositions(profile.agent_id),
        trading.getRiskState(profile.agent_id),
        trading.getQuote(profile.agent_id),
      ])
      const tradingConfig = loadTradingConfig(this.env)
      const signals = await this.resolveSignals(
        profile,
        quote.allowedSymbols,
        prefetchedTruthFeeds,
        prefetchedEquityFeeds
      )
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
        ...(signals.length > 0 ? { signals } : {}),
      }

      await this.runsRepository.create({
        id: runId,
        agentId: profile.agent_id,
        status: 'running',
        startedAt,
        contextJson: JSON.stringify(context),
        provider: decisionMeta.provider,
        modelId: decisionMeta.modelId,
      })
      runCreated = true

      outcome = await decideStrategy(context, this.env)
      if (outcome.status === 'error') {
        throw new Error(outcome.message)
      }

      decision = {
        summary: outcome.summary,
        reasoning: outcome.reasoning,
        actions: outcome.actions,
      }
      assertStrategyDecisionGuardrails(decision, context)

      const shouldExecute =
        options.executeOverride !== false &&
        isStrategyRunnerExecuteEnabled(this.env) &&
        decision.actions.length > 0

      if (shouldExecute) {
        const signerRow = await this.signersRepository.findByAgentId(
          profile.agent_id
        )
        if (!signerRow) {
          throw new AppError(
            'Agent signer not found',
            503,
            'SERVICE_UNAVAILABLE'
          )
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
      completedAt = new Date().toISOString()

      await this.runsRepository.complete(runId, {
        status,
        decisionJson: JSON.stringify(outcome ?? decision),
        executionJson: JSON.stringify(execution),
        error: executionError ?? null,
        completedAt,
      })

      return {
        runId,
        status,
        startedAt,
        completedAt,
        summary: decision.summary,
        reasoning: decision.reasoning,
        provider: decisionMeta.provider,
        modelId: decisionMeta.modelId,
        actions: decision.actions,
        execution,
        error: executionError ?? null,
      }
    } catch (error) {
      const message = errorMessage(error, 'Strategy run failed')
      if (runCreated) {
        completedAt = new Date().toISOString()
        await this.runsRepository.complete(runId, {
          status: 'failed',
          decisionJson: outcome
            ? JSON.stringify(outcome)
            : decision
              ? JSON.stringify(decision)
              : null,
          executionJson: JSON.stringify(execution),
          error: message,
          completedAt,
        })
      }

      return {
        runId: runCreated ? runId : null,
        status: 'failed',
        startedAt,
        completedAt,
        summary: decision?.summary ?? null,
        reasoning: decision?.reasoning ?? null,
        provider: decisionMeta.provider,
        modelId: decisionMeta.modelId,
        actions: decision?.actions ?? [],
        execution,
        error: message,
      }
    } finally {
      await this.profilesRepository.bumpNextRunAt(
        profile.agent_id,
        computeNextRunAt(botFrequency)
      )
    }
  }

  private async resolveSignals(
    profile: AgentProfileRow,
    allowedSymbols: readonly string[],
    prefetchedTruthFeeds?: Map<string, SignalFeed>,
    prefetchedEquityFeeds?: Map<string, SignalFeed>
  ): Promise<SignalFeed[]> {
    const connections = parseDataConnections(profile.data_connections)
    const truthEnabled = Boolean(
      connections.truthsocial?.enabled && connections.truthsocial.username
    )
    const equityEnabled = Boolean(connections.equitynews?.enabled)
    if (!truthEnabled && !equityEnabled) {
      return []
    }

    try {
      return await createSignalsService(this.env).loadSignals(connections, {
        fallbackSymbols: allowedSymbols,
        prefetchedTruthSocial: prefetchedTruthFeeds,
        prefetchedEquityNews: prefetchedEquityFeeds,
      })
    } catch {
      return []
    }
  }
}
