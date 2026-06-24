import type { Hex } from 'viem'

const NONCE_BYTES = 12
const KEY_BYTES = 32

function decodeEncryptionKeyMaterial(secret: string): Uint8Array {
  const trimmed = secret.trim()
  if (/^[0-9a-fA-F]{64}$/.test(trimmed)) {
    const bytes = new Uint8Array(KEY_BYTES)
    for (let i = 0; i < KEY_BYTES; i++) {
      bytes[i] = Number.parseInt(trimmed.slice(i * 2, i * 2 + 2), 16)
    }
    return bytes
  }

  const binary = atob(trimmed)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  if (bytes.length !== KEY_BYTES) {
    throw new Error(`AGENT_SIGNER_ENCRYPTION_KEY must be ${KEY_BYTES} bytes`)
  }
  return bytes
}

async function importAesKey(secret: string): Promise<CryptoKey> {
  const keyBytes = decodeEncryptionKeyMaterial(secret)
  return crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, [
    'encrypt',
    'decrypt',
  ])
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function base64ToBytes(encoded: string): Uint8Array {
  const binary = atob(encoded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

export function requireSignerEncryptionKey(
  env: Record<string, string | undefined>
): string {
  const key = env.AGENT_SIGNER_ENCRYPTION_KEY
  if (!key) {
    throw new Error('AGENT_SIGNER_ENCRYPTION_KEY is not configured')
  }
  return key
}

export async function encryptSignerPrivateKey(
  privateKey: Hex,
  encryptionKeySecret: string
): Promise<string> {
  const key = await importAesKey(encryptionKeySecret)
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES))
  const plaintext = new TextEncoder().encode(privateKey)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    plaintext
  )
  const combined = new Uint8Array(nonce.length + ciphertext.byteLength)
  combined.set(nonce, 0)
  combined.set(new Uint8Array(ciphertext), nonce.length)
  return bytesToBase64(combined)
}

export async function decryptSignerPrivateKey(
  encrypted: string,
  encryptionKeySecret: string
): Promise<Hex> {
  const key = await importAesKey(encryptionKeySecret)
  const combined = base64ToBytes(encrypted)
  if (combined.length <= NONCE_BYTES) {
    throw new Error('Invalid encrypted signer key blob')
  }
  const nonce = combined.slice(0, NONCE_BYTES)
  const ciphertext = combined.slice(NONCE_BYTES)
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce },
    key,
    ciphertext
  )
  return new TextDecoder().decode(plaintext) as Hex
}
