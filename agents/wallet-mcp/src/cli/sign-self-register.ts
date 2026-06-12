import { readFileSync } from 'node:fs'
import { handleSignSelfRegister } from '../tools/sign-self-register.js'

function loadWalletEnv(): void {
  if (process.env.PRIVATE_KEY) return
  const configPath = `${process.env.HOME}/.cursor/mcp.json`
  const text = readFileSync(configPath, 'utf8')
  const privateKey = text.match(/"PRIVATE_KEY":\s*"([^"]+)"/)?.[1]
  if (privateKey) process.env.PRIVATE_KEY = privateKey
}

async function main(): Promise<void> {
  loadWalletEnv()
  const args = JSON.parse(process.argv[2] ?? '{}') as Record<string, unknown>
  const result = await handleSignSelfRegister(args)
  process.stdout.write(result.content[0]?.text ?? '')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
