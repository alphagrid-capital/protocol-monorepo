#!/usr/bin/env node
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const name = process.argv[2]?.trim()

if (!name || !/^[a-z][a-z0-9_]*$/.test(name)) {
  console.error('Usage: yarn db:generate <snake_case_name>')
  console.error('Example: yarn db:generate add_agent_runs')
  process.exit(1)
}

const result = spawnSync(
  'drizzle-kit',
  ['generate', '--name', name],
  { cwd: apiRoot, stdio: 'inherit' }
)

process.exit(result.status ?? 1)
