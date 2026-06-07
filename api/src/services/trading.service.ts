export const TRADING_NOT_IMPLEMENTED_MESSAGE =
  'Trading API is not yet available. Intent gateway and executor are planned for a future release.'

export const tradingNotImplementedBody = () =>
  ({
    error: 'Not implemented' as const,
    code: 'NOT_IMPLEMENTED' as const,
    message: TRADING_NOT_IMPLEMENTED_MESSAGE,
  })

export class TradingService {
  static notImplemented() {
    return tradingNotImplementedBody()
  }
}
