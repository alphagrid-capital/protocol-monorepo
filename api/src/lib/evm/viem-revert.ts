import { BaseError, ContractFunctionRevertedError } from 'viem'

/** Returns the nested contract revert, if present in a viem error chain. */
export function findContractFunctionRevert(
  error: unknown
): ContractFunctionRevertedError | null {
  if (error instanceof ContractFunctionRevertedError) {
    return error
  }
  if (error instanceof BaseError) {
    const revert = error.walk(
      (err) => err instanceof ContractFunctionRevertedError
    )
    if (revert instanceof ContractFunctionRevertedError) {
      return revert
    }
  }
  return null
}

/** True when `error` is a decoded (or message-matched) custom revert with `errorName`. */
export function isContractRevert(error: unknown, errorName: string): boolean {
  const revert = findContractFunctionRevert(error)
  if (revert?.data?.errorName === errorName) {
    return true
  }
  return error instanceof Error && error.message.includes(errorName)
}
