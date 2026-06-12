import type { Hex } from 'viem'
import { contracts } from '../constants/contracts.js'
import { AppError } from '../errors.js'
import { getWorkerEnv } from '../lib/worker-env.js'
import type { TransactionStatusResponse } from '../schemas/transaction.js'
import { ProviderService } from './provider.service.js'

export class TransactionError extends AppError {
  constructor(
    message: string,
    readonly status = 400
  ) {
    super(message, status)
    this.name = 'TransactionError'
  }
}

export class TransactionService {
  constructor(
    private readonly rpcUrl: string,
    private readonly chainId: number
  ) {}

  static fromEnv(
    env: Record<string, string | undefined> = getWorkerEnv()
  ): TransactionService {
    const chainIdRaw = env.CHAIN_ID
    const rpcUrl = env.RPC_URL
    if (!chainIdRaw || !rpcUrl) {
      throw new TransactionError('CHAIN_ID and RPC_URL are required', 503)
    }
    const chainId = Number(chainIdRaw)
    if (!contracts[chainId]) {
      throw new TransactionError(`Unsupported CHAIN_ID: ${chainId}`, 503)
    }
    return new TransactionService(rpcUrl, chainId)
  }

  async getStatus(transactionHash: Hex): Promise<TransactionStatusResponse> {
    const client = ProviderService.fromChain(
      this.rpcUrl,
      this.chainId
    ).createPublicClient()

    const [receipt, transaction] = await Promise.all([
      client.getTransactionReceipt({ hash: transactionHash }),
      client.getTransaction({ hash: transactionHash }),
    ])

    if (!transaction) {
      throw new TransactionError('Transaction not found', 404)
    }

    if (!receipt) {
      return {
        transactionHash,
        status: 'pending',
        from: transaction.from,
        to: transaction.to ?? undefined,
      }
    }

    const block = await client.getBlock({ blockNumber: receipt.blockNumber })

    return {
      transactionHash,
      status: receipt.status,
      blockNumber: receipt.blockNumber.toString(),
      blockTimestamp: block.timestamp.toString(),
      from: transaction.from,
      to: transaction.to ?? undefined,
    }
  }
}
