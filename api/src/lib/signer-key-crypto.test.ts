import assert from 'node:assert/strict'
import test from 'node:test'
import {
  decryptSignerPrivateKey,
  encryptSignerPrivateKey,
} from './signer-key-crypto.ts'

const TEST_KEY_HEX =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

test('encryptSignerPrivateKey round-trips private key', async () => {
  const privateKey =
    '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  const encrypted = await encryptSignerPrivateKey(privateKey, TEST_KEY_HEX)
  const decrypted = await decryptSignerPrivateKey(encrypted, TEST_KEY_HEX)
  assert.equal(decrypted, privateKey)
})

test('encryptSignerPrivateKey produces distinct ciphertexts', async () => {
  const privateKey =
    '0x0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
  const first = await encryptSignerPrivateKey(privateKey, TEST_KEY_HEX)
  const second = await encryptSignerPrivateKey(privateKey, TEST_KEY_HEX)
  assert.notEqual(first, second)
})
