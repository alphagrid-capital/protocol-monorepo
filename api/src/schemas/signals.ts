import { z } from '@hono/zod-openapi'
import {
  equityNewsSymbolSchema,
  FredConnectionSchema,
  TruthSocialConnectionSchema,
} from './data-connections.js'

export const SignalItemSchema = z
  .object({
    id: z.string(),
    createdAt: z.string(),
    text: z.string(),
  })
  .openapi('SignalItem')

export const SignalFeedSchema = z
  .object({
    source: z.string(),
    handle: z.string().optional(),
    fetchedAt: z.string(),
    items: z.array(SignalItemSchema),
  })
  .openapi('SignalFeed')

/** Preview Truth Social without saving an agent. */
export const PreviewTruthSocialBodySchema = TruthSocialConnectionSchema.omit({
  enabled: true,
})
  .strict()
  .openapi('PreviewTruthSocialBody')

/**
 * Preview equity news without saving an agent.
 * Symbols are required here (no vault allowlist fallback).
 */
export const PreviewEquityNewsBodySchema = z
  .object({
    symbols: z.array(equityNewsSymbolSchema).min(1).max(20),
  })
  .strict()
  .openapi('PreviewEquityNewsBody')

/** Preview FRED macro without saving an agent. Omitting seriesIds uses defaults. */
export const PreviewFredBodySchema = FredConnectionSchema.omit({
  enabled: true,
})
  .strict()
  .openapi('PreviewFredBody')

export const SignalPreviewResponseSchema = z
  .object({
    feed: SignalFeedSchema.nullable(),
  })
  .openapi('SignalPreviewResponse')

export const SignalPreviewErrorSchema = z
  .object({
    error: z.string(),
  })
  .openapi('SignalPreviewError')
