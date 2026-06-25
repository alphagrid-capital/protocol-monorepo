#!/usr/bin/env node
/**
 * Local strategy runner shadow test (AI decision, no on-chain execution).
 *
 * Prerequisites:
 *   1. `yarn dev:arbitrum-sepolia` (or matching --env) running on --port
 *   2. api/.dev.vars includes at least:
 *        STRATEGY_DECISION_PROVIDER=workers-ai
 *        STRATEGY_RUNNER_EXECUTE=false
 *   3. Managed agent profile exists in local D1
 *
 * Usage:
 *   yarn strategy:shadow-run -- --agent-id 42
 *   yarn strategy:shadow-run -- --list
 *   yarn strategy:shadow-run -- --agent-id 42 --env arbitrum-sepolia --port 8787 --wait-ms 12000
 */
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const ENV_CONFIG = {
  'arbitrum-sepolia': {
    database: 'alphagrid-db-421614',
    wranglerEnv: 'arbitrum-sepolia',
  },
  'robinhood-testnet': {
    database: 'alphagrid-db-46630',
    wranglerEnv: 'robinhood-testnet',
  },
  'arbitrum-one': {
    database: 'alphagrid-db-42161',
    wranglerEnv: 'arbitrum-one',
  },
  local: {
    database: 'alphagrid-users-local',
    wranglerEnv: null,
  },
}

function parseArgs(argv) {
  const options = {
    agentId: null,
    envName: 'arbitrum-sepolia',
    port: 8787,
    waitMs: 10_000,
    list: false,
    skipDue: false,
    help: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    switch (arg) {
      case '--help':
      case '-h':
        options.help = true
        break
      case '--list':
        options.list = true
        break
      case '--skip-due':
        options.skipDue = true
        break
      case '--agent-id':
        options.agentId = argv[++i]
        break
      case '--env':
        options.envName = argv[++i]
        break
      case '--port':
        options.port = Number.parseInt(argv[++i], 10)
        break
      case '--wait-ms':
        options.waitMs = Number.parseInt(argv[++i], 10)
        break
      default:
        console.error(`Unknown argument: ${arg}`)
        process.exit(1)
    }
  }

  return options
}

function printHelp() {
  console.log(`Local strategy runner shadow test

Usage:
  yarn strategy:shadow-run -- --agent-id <id> [options]
  yarn strategy:shadow-run -- --list [options]

Options:
  --agent-id <id>   Managed agent id (required unless --list)
  --env <name>      Wrangler env (default: arbitrum-sepolia)
  --port <n>        Local wrangler dev port (default: 8787)
  --wait-ms <n>     Wait after cron trigger before reading D1 (default: 10000)
  --skip-due        Do not force next_run_at into the past
  --list            List active managed agent profiles
  -h, --help        Show this help

Wrangler env → D1 database:
  arbitrum-sepolia  → alphagrid-db-421614
  robinhood-testnet → alphagrid-db-46630
  arbitrum-one      → alphagrid-db-42161
  local             → alphagrid-users-local (plain \`yarn dev\`)

Before running, start the API with matching env, e.g.:
  yarn dev:arbitrum-sepolia

Recommended api/.dev.vars for shadow mode:
  STRATEGY_DECISION_PROVIDER=workers-ai
  STRATEGY_RUNNER_EXECUTE=false
`)
}

function assertAgentId(agentId) {
  if (!agentId || !/^[1-9]\d*$/.test(agentId)) {
    console.error('Expected --agent-id as a positive integer (e.g. 42).')
    process.exit(1)
  }
}

function runWrangler(args) {
  const result = spawnSync('wrangler', args, {
    cwd: apiRoot,
    encoding: 'utf8',
  })

  if (result.status !== 0) {
    const stderr = result.stderr?.trim()
    const stdout = result.stdout?.trim()
    console.error('wrangler command failed:', args.join(' '))
    if (stdout) console.error(stdout)
    if (stderr) console.error(stderr)
    process.exit(result.status ?? 1)
  }

  return result.stdout ?? ''
}

function d1Query(config, sql) {
  const args = ['d1', 'execute', config.database, '--local', '--json', '--command', sql]
  if (config.wranglerEnv) {
    args.splice(3, 0, '--env', config.wranglerEnv)
  }

  const stdout = runWrangler(args)
  try {
    return JSON.parse(stdout)
  } catch {
    console.error('Failed to parse wrangler d1 JSON output.')
    console.error(stdout)
    process.exit(1)
  }
}

function d1Rows(payload) {
  const results = payload?.[0]?.results
  return Array.isArray(results) ? results : []
}

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function assertDevServer(port) {
  const url = `http://127.0.0.1:${port}/health`
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
  } catch (error) {
    console.error(`Local API not reachable at ${url}`)
    console.error(
      error instanceof Error ? error.message : 'Start wrangler dev first.'
    )
    process.exit(1)
  }
}

async function triggerScheduled(port) {
  const url = `http://127.0.0.1:${port}/cdn-cgi/handler/scheduled`
  const response = await fetch(url)
  if (!response.ok) {
    console.error(`Scheduled handler returned HTTP ${response.status}`)
    process.exit(1)
  }
  console.log(`Triggered scheduled handler (${url})`)
}

function printAgentProfiles(rows) {
  if (rows.length === 0) {
    console.log('No active managed agent profiles found.')
    return
  }

  console.log('Active managed agents:')
  for (const row of rows) {
    console.log(
      `  agent_id=${row.agent_id} handle=${row.handle} next_run_at=${row.next_run_at}`
    )
  }
}

function printLatestRun(row) {
  if (!row) {
    console.log('No strategy run recorded yet for this agent.')
    return
  }

  console.log('\nLatest strategy run:')
  console.log(`  run_id:      ${row.id}`)
  console.log(`  status:      ${row.status}`)
  console.log(`  started_at:  ${row.started_at}`)
  console.log(`  completed_at:${row.completed_at ?? '(null)'}`)
  if (row.error) {
    console.log(`  error:       ${row.error}`)
  }

  if (row.decision_json) {
    try {
      const decision = JSON.parse(row.decision_json)
      console.log('\n  decision_json:')
      console.log(JSON.stringify(decision, null, 2).replace(/^/gm, '    '))
    } catch {
      console.log(`\n  decision_json: ${row.decision_json}`)
    }
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const config = ENV_CONFIG[options.envName]
  if (!config) {
    console.error(`Unknown --env ${options.envName}`)
    console.error(`Known values: ${Object.keys(ENV_CONFIG).join(', ')}`)
    process.exit(1)
  }

  if (options.list) {
    const payload = d1Query(
      config,
      `SELECT agent_id, handle, next_run_at
       FROM agent_profiles
       WHERE archived_at IS NULL
       ORDER BY agent_id ASC`
    )
    printAgentProfiles(d1Rows(payload))
    return
  }

  assertAgentId(options.agentId)

  const profilePayload = d1Query(
    config,
    `SELECT agent_id, handle, strategy, next_run_at, archived_at
     FROM agent_profiles
     WHERE agent_id = '${options.agentId}'`
  )
  const profile = d1Rows(profilePayload)[0]

  if (!profile) {
    console.error(`No agent_profiles row for agent_id=${options.agentId}`)
    console.error('Launch a managed agent locally first, or run with --list.')
    process.exit(1)
  }

  if (profile.archived_at) {
    console.error(`Agent ${options.agentId} is archived.`)
    process.exit(1)
  }

  console.log(`Agent ${options.agentId} (${profile.handle})`)
  console.log(`Strategy preview: ${String(profile.strategy).slice(0, 120)}…`)
  console.log(`Current next_run_at: ${profile.next_run_at}`)

  await assertDevServer(options.port)

  if (!options.skipDue) {
    d1Query(
      config,
      `UPDATE agent_profiles
       SET next_run_at = datetime('now', '-1 hour')
       WHERE agent_id = '${options.agentId}'`
    )
    console.log('Forced next_run_at into the past.')
  }

  await triggerScheduled(options.port)
  console.log(`Waiting ${options.waitMs}ms for strategy runner + AI…`)
  await sleep(options.waitMs)

  const runPayload = d1Query(
    config,
    `SELECT id, agent_id, status, started_at, completed_at, decision_json, error
     FROM strategy_runs
     WHERE agent_id = '${options.agentId}'
     ORDER BY started_at DESC
     LIMIT 1`
  )
  printLatestRun(d1Rows(runPayload)[0])
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
