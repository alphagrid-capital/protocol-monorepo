import {
  FacilitatorResponseError,
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
import { HonoAdapter, paymentMiddlewareFromHTTPServer } from '@x402/hono'
import type { Context, MiddlewareHandler, Next } from 'hono'
import { FetchRequestAdapter } from '../http/fetch-request-adapter.js'

export interface X402PaymentConfig {
  method: string
  path: string
  description: string
  mimeType?: string
  price: {
    asset: `0x${string}`
    amount: string
    extra?: Record<string, unknown>
  }
  payTo: `0x${string}`
  network: Network
  facilitatorUrl: string
}

interface X402HttpContext {
  adapter: HTTPAdapter
  path: string
  method: string
  paymentHeader?: string
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
          price: payment.price,
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

function buildHttpContext(
  adapter: HTTPAdapter,
  path: string,
  method: string
): X402HttpContext {
  return {
    adapter,
    path,
    method,
    paymentHeader:
      adapter.getHeader('payment-signature') ?? adapter.getHeader('x-payment'),
  }
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

function applyPaymentErrorToHono(
  c: Context,
  result: Extract<HTTPProcessResult, { type: 'payment-error' }>
): void {
  const { response } = result
  const body = response.isHtml
    ? String(response.body?.toString() ?? '')
    : JSON.stringify(response.body ?? {})
  c.res = new Response(body, {
    status: response.status,
    headers: response.headers,
  })
}

async function settleAfterHandler(
  httpServer: x402HTTPResourceServer,
  context: X402HttpContext,
  result: Extract<HTTPProcessResult, { type: 'payment-verified' }>,
  response: Response
): Promise<Response> {
  const { paymentPayload, paymentRequirements, declaredExtensions } = result
  const responseBody = new Uint8Array(await response.clone().arrayBuffer())
  const responseHeaders: Record<string, string> = {}
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value
  })

  const settleResult = await httpServer.processSettlement(
    paymentPayload,
    paymentRequirements,
    declaredExtensions,
    { request: context, responseBody, responseHeaders }
  )

  if (!settleResult.success) {
    const { response: settleResponse } = settleResult
    const body = settleResponse.isHtml
      ? String(settleResponse.body?.toString() ?? '')
      : JSON.stringify(settleResponse.body ?? {})
    return new Response(body, {
      status: settleResponse.status,
      headers: settleResponse.headers,
    })
  }

  Object.entries(settleResult.headers).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

export async function createX402Middleware(
  payment: X402PaymentConfig
): Promise<MiddlewareHandler> {
  const httpServer = await buildHttpServer(payment)
  return paymentMiddlewareFromHTTPServer(httpServer)
}

/** Verify payment, run handler, then settle via facilitator (charges the payer). */
export async function runX402HonoPayment(
  c: Context,
  payment: X402PaymentConfig,
  next: Next
): Promise<void> {
  const httpServer = await buildHttpServer(payment)
  await httpServer.initialize()

  const context = buildHttpContext(new HonoAdapter(c), c.req.path, c.req.method)

  if (!httpServer.requiresPayment(context)) {
    await next()
    return
  }

  let result: HTTPProcessResult
  try {
    result = await httpServer.processHTTPRequest(context)
  } catch (error) {
    if (error instanceof FacilitatorResponseError) {
      c.res = c.json({ error: error.message }, 502)
      return
    }
    throw error
  }

  switch (result.type) {
    case 'no-payment-required':
      await next()
      return
    case 'payment-error':
      applyPaymentErrorToHono(c, result)
      return
    case 'payment-verified': {
      const { cancellationDispatcher } = result
      try {
        await next()
      } catch (error) {
        await cancellationDispatcher.cancel({
          reason: 'handler_threw',
          error,
        })
        throw error
      }

      let res = c.res
      if (res.status >= 400) {
        await cancellationDispatcher.cancel({
          reason: 'handler_failed',
          responseStatus: res.status,
        })
        return
      }

      c.res = undefined
      try {
        res = await settleAfterHandler(httpServer, context, result, res)
      } catch (error) {
        if (error instanceof FacilitatorResponseError) {
          c.res = c.json({ error: error.message }, 502)
          return
        }
        console.error(error)
        c.res = c.json({}, 402)
        return
      }
      c.res = res
      return
    }
  }
}

/** Verify payment, run handler, then settle (for non-Hono callers such as MCP). */
export async function runX402ProtectedRequest<T>(options: {
  payment: X402PaymentConfig
  request: Request
  parsedBody?: unknown
  handler: () => Promise<T>
  toResponseBody: (value: T) => string
}): Promise<{ ok: true; value: T } | { ok: false; response: Response }> {
  const { payment, request, parsedBody, handler, toResponseBody } = options
  const adapter = new FetchRequestAdapter(request, payment.path, parsedBody)
  const context = buildHttpContext(adapter, payment.path, payment.method)
  const httpServer = await buildHttpServer(payment)
  await httpServer.initialize()

  if (!httpServer.requiresPayment(context)) {
    return { ok: true, value: await handler() }
  }

  let result: HTTPProcessResult
  try {
    result = await httpServer.processHTTPRequest(context)
  } catch (error) {
    if (error instanceof FacilitatorResponseError) {
      return {
        ok: false,
        response: Response.json({ error: error.message }, { status: 502 }),
      }
    }
    throw error
  }

  if (result.type === 'payment-error') {
    return { ok: false, response: paymentErrorToResponse(result) }
  }
  if (result.type === 'no-payment-required') {
    return { ok: true, value: await handler() }
  }

  const { cancellationDispatcher } = result
  try {
    const value = await handler()
    const responseBody = new TextEncoder().encode(toResponseBody(value))
    const settleResult = await httpServer.processSettlement(
      result.paymentPayload,
      result.paymentRequirements,
      result.declaredExtensions,
      {
        request: context,
        responseBody,
        responseHeaders: { 'Content-Type': 'application/json' },
      }
    )
    if (!settleResult.success) {
      const { response: settleResponse } = settleResult
      const body = settleResponse.isHtml
        ? String(settleResponse.body?.toString() ?? '')
        : JSON.stringify(settleResponse.body ?? {})
      return {
        ok: false,
        response: new Response(body, {
          status: settleResponse.status,
          headers: settleResponse.headers,
        }),
      }
    }
    return { ok: true, value }
  } catch (error) {
    await cancellationDispatcher.cancel({
      reason: 'handler_threw',
      error,
    })
    throw error
  }
}
