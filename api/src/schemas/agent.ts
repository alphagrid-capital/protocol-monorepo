import { z } from "@hono/zod-openapi";

const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Expected 0x-prefixed 20-byte address");

const hexSchema = z.string().regex(/^0x[a-fA-F0-9]*$/, "Expected 0x-prefixed hex");

export const AgentRegistrationRequestSchema = z
  .object({
    vault: addressSchema.openapi({ example: "0x0000000000000000000000000000000000000001" }),
    name: z.string().min(1).max(128).openapi({ example: "Alpha Bot" }),
    metadataURI: z.string().min(1).max(2048).openapi({ example: "ipfs://alpha-bot" }),
    signer: addressSchema,
    linkERC8004: z.boolean().default(false),
    erc8004AgentId: z
      .string()
      .regex(/^\d+$/)
      .default("0")
      .openapi({ description: "ERC-8004 identity token id when linking" }),
    deadline: z
      .string()
      .regex(/^\d+$/)
      .openapi({ description: "Unix timestamp; EIP-712 SelfRegister deadline" }),
    signature: hexSchema.openapi({ description: "EIP-712 signature from signer" }),
  })
  .strict();

export const AgentRegistrationQuoteSchema = z.object({
  mode: z.enum(["mock", "live"]),
  registrationFee: z.object({
    amount: z.string(),
    assetSymbol: z.string(),
    decimals: z.number(),
    displayUsd: z.string(),
  }),
  x402: z.object({
    enabled: z.boolean(),
    network: z.string().nullable(),
    payTo: addressSchema.nullable(),
    facilitatorUrl: z.string().nullable(),
    httpRoute: z.string(),
  }),
  eip712: z.object({
    domainName: z.string(),
    domainVersion: z.string(),
    chainId: z.number(),
    verifyingContract: addressSchema.nullable(),
    primaryType: z.literal("SelfRegister"),
    selfRegisterTypehash: z.string(),
  }),
  agentRegistry: addressSchema.nullable(),
  signerNonce: z.string().nullable(),
});

export const AgentRegistrationResponseSchema = z.object({
  mode: z.enum(["mock", "live"]),
  agentId: z.string().nullable(),
  transactionHash: hexSchema.nullable(),
  transaction: z
    .object({
      to: addressSchema,
      data: hexSchema,
      chainId: z.number(),
      description: z.string(),
    })
    .nullable(),
  message: z.string(),
});

export type AgentRegistrationRequest = z.infer<typeof AgentRegistrationRequestSchema>;
export type AgentRegistrationQuote = z.infer<typeof AgentRegistrationQuoteSchema>;
export type AgentRegistrationResponse = z.infer<typeof AgentRegistrationResponseSchema>;
