import {
  handleSignAddPosition,
  SIGN_ADD_POSITION_TOOL,
} from './sign-add-position.js'
import {
  handleSignOpenPosition,
  SIGN_OPEN_POSITION_TOOL,
} from './sign-open-position.js'
import {
  handleSignReducePosition,
  SIGN_REDUCE_POSITION_TOOL,
} from './sign-reduce-position.js'
import {
  handleSignSelfRegister,
  SIGN_SELF_REGISTER_TOOL,
} from './sign-self-register.js'
import {
  handleSignUpdateExitLadder,
  SIGN_UPDATE_EXIT_LADDER_TOOL,
} from './sign-update-exit-ladder.js'

export const ALPHAGRID_SIGN_TOOLS = [
  SIGN_SELF_REGISTER_TOOL,
  SIGN_OPEN_POSITION_TOOL,
  SIGN_ADD_POSITION_TOOL,
  SIGN_REDUCE_POSITION_TOOL,
  SIGN_UPDATE_EXIT_LADDER_TOOL,
] as const

const HANDLERS: Record<
  string,
  (
    args: Record<string, unknown>
  ) => Promise<{ content: Array<{ type: 'text'; text: string }> }>
> = {
  [SIGN_SELF_REGISTER_TOOL.name]: handleSignSelfRegister,
  [SIGN_OPEN_POSITION_TOOL.name]: handleSignOpenPosition,
  [SIGN_ADD_POSITION_TOOL.name]: handleSignAddPosition,
  [SIGN_REDUCE_POSITION_TOOL.name]: handleSignReducePosition,
  [SIGN_UPDATE_EXIT_LADDER_TOOL.name]: handleSignUpdateExitLadder,
}

export async function handleAlphagridSignTool(
  name: string,
  args: Record<string, unknown>
): Promise<{ content: Array<{ type: 'text'; text: string }> }> {
  const handler = HANDLERS[name]
  if (!handler) {
    throw new Error(`Unknown Alphagrid sign tool: ${name}`)
  }
  return handler(args)
}
