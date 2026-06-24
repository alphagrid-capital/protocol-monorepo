import { z } from '@hono/zod-openapi'

export const PRIVY_ID_TOKEN_HEADER = 'privy-id-token'

export const PrivyAuthHeadersSchema = z
  .object({
    Authorization: z.string().openapi({
      param: { name: 'Authorization', in: 'header' },
      example: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    }),
    [PRIVY_ID_TOKEN_HEADER]: z.string().openapi({
      param: { name: PRIVY_ID_TOKEN_HEADER, in: 'header' },
      example: 'eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...',
      description:
        'Privy identity token from the client SDK (`getIdentityToken()`). Required to resolve the linked Ethereum wallet address.',
    }),
  })
  .openapi('PrivyAuthHeaders')
