import { Address, Bytes } from '@graphprotocol/graph-ts'
import { dataSource } from '@graphprotocol/graph-ts'

function lookupSymbol(network: string, token: Bytes): string {
  const tokenHex = token.toHexString().toLowerCase()

  if (network == 'arbitrum-sepolia') {
    if (tokenHex == '0xf3a7e86ec487efbb1dfe6ccb380b245fec779462') return 'NVDA'
    if (tokenHex == '0x07ac9137418d6c2c4c15e5a342adf06418821e29') return 'META'
    if (tokenHex == '0x883ef9be7b3b1bef49fa0bd8b32ceb60fbf95b8c') return 'TSLA'
    if (tokenHex == '0x33c2fc51ddd8879c0c3985a89f6ddaf5d3993d20') return 'AAPL'
    if (tokenHex == '0x60a8463c9055839c1d7c91944f274298d51b570d') return 'MSFT'
    if (tokenHex == '0x371d91fdaee315937f43e280ab2b0683bd7f38c9') return 'COIN'
    if (tokenHex == '0xf8a5e376d301579e4a0cd9c47273321e03ce5bab') return 'HOOD'
    if (tokenHex == '0x0641f3e1859733ea9044799c446e9ddbfa8810fc') return 'SPY'
  }

  if (network == 'arbitrum-one') {
    if (tokenHex == '0xf9630dc1f281eaa3307aa1265256191b7c61f254') return 'NVDA'
    if (tokenHex == '0x8817b18210ecf4ace90d328d266ddf593542986b') return 'META'
    if (tokenHex == '0x50417978a6368276f8f389c2d59412fbb0dadb71') return 'TSLA'
    if (tokenHex == '0x614c2d073f6093dca1d324c011a59b07cf38cde8') return 'AAPL'
    if (tokenHex == '0x71fdcb5d39652be80da54dc0ecb6fda532a3699d') return 'MSFT'
    if (tokenHex == '0x4ae9d619d5c2b009419ef10b6a07eb6a4aaea4db') return 'COIN'
    if (tokenHex == '0x22ec9a44e54339d1dce184a02161e42df857648d') return 'HOOD'
    if (tokenHex == '0xa938fa961d29d533c9057f2b0e72854a7753f26e') return 'SPY'
  }

  return tokenHex
}

export function symbolForToken(token: Address): string {
  return lookupSymbol(dataSource.network(), Bytes.fromHexString(token.toHexString()))
}
