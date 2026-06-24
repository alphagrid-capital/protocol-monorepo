import type { AgentIdentity } from '../../schemas/agent-draft.js'

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

export function buildAgentMetadataUri(identity: AgentIdentity): string {
  const payload = {
    handle: identity.handle,
    description: identity.description,
    links: identity.links,
  }
  const bytes = new TextEncoder().encode(JSON.stringify(payload))
  return `data:application/json;base64,${bytesToBase64(bytes)}`
}
