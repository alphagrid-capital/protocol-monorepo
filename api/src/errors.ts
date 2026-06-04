export type AppErrorCode =
  | 'INVALID_REQUEST'
  | 'PAYMENT_REQUIRED'
  | 'UPSTREAM_FAILURE'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_SERVER_ERROR'

export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number = 500,
    readonly code: AppErrorCode = 'INTERNAL_SERVER_ERROR'
  ) {
    super(message)
    this.name = 'AppError'
  }
}
