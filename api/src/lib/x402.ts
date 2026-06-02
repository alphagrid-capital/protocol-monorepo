import {
  HTTPFacilitatorClient,
  x402HTTPResourceServer,
  x402ResourceServer,
} from '@x402/core/server'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import type {
  HTTPAdapter,
  HTTPProcessResult,
  RoutesConfig,
} from '@x402/core/server'
import type { Network } from '@x402/core/types'
import { paymentMiddlewareFromHTTPServer } from '@x402/hono'
import type { MiddlewareHandler } from 'hono'
import { FetchRequestAdapter } from './fetch-request-adapter.js'

export interface X402PaymentConfig {
  method: string
  path: string
  description: string
  mimeType?: string
  priceUsd: string
  payTo: `0x${string}`
  network: Network
  facilitatorUrl: string
}

interface X402RequestVerificationOptions {
  payment: X402PaymentConfig
  request: Request
  parsedBody?: unknown
  adapter?: HTTPAdapter
}

function buildRouteKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path}`
}

function buildRoutes(payment: X402PaymentConfig): RoutesConfig {
  return {
    [buildRouteKey(payment.method, payment.path)]: {
      accepts: [
        {
          scheme: 'exact',
          price: payment.priceUsd,
          network: payment.network,
          payTo: payment.payTo,
        },
      ],
      description: payment.description,
      mimeType: payment.mimeType ?? 'application/json',
    },
  }
}

async function buildHttpServer(
  payment: X402PaymentConfig
): Promise<x402HTTPResourceServer> {
  const facilitator = new HTTPFacilitatorClient({
    url: payment.facilitatorUrl,
  })
  const resourceServer = new x402ResourceServer(facilitator).register(
    payment.network,
    new ExactEvmScheme()
  )
  return new x402HTTPResourceServer(resourceServer, buildRoutes(payment))
}

function paymentErrorToResponse(
  result: Extract<HTTPProcessResult, { type: 'payment-error' }>
): Response {
  return new Response(JSON.stringify(result.response?.body ?? result), {
    status: result.response?.status ?? 402,
    headers: {
      'Content-Type': 'application/json',
      ...result.response?.headers,
    },
  })
}

export async function createX402Middleware(
  payment: X402PaymentConfig
): Promise<MiddlewareHandler> {
  const httpServer = await buildHttpServer(payment)
  return paymentMiddlewareFromHTTPServer(httpServer)
}

export async function verifyX402Payment(
  options: X402RequestVerificationOptions
): Promise<{ ok: true } | { ok: false; response: Response }> {
  const { payment, request, parsedBody, adapter } = options
  const requestAdapter =
    adapter ?? new FetchRequestAdapter(request, payment.path, parsedBody)
  const httpServer = await buildHttpServer(payment)
  const result: HTTPProcessResult = await httpServer.processHTTPRequest({
    adapter: requestAdapter,
    path: payment.path,
    method: payment.method.toUpperCase(),
  })

  if (result.type === 'payment-error') {
    return { ok: false, response: paymentErrorToResponse(result) }
  }
  return { ok: true }
}
