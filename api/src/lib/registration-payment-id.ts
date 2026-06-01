import { type Hex, keccak256, toBytes } from "viem";

const PAYMENT_HEADER_NAMES = ["x-payment", "payment-signature"] as const;

/** Deterministic id for an x402 payment proof (bound on-chain via `x402PaymentId`). */
export function deriveX402PaymentId(request: Request): Hex {
  const parts: string[] = [];
  for (const name of PAYMENT_HEADER_NAMES) {
    const value = request.headers.get(name);
    if (value) parts.push(`${name}:${value}`);
  }
  if (parts.length === 0) {
    throw new Error("x402 payment headers missing after verification");
  }
  return keccak256(toBytes(parts.join("\n")));
}
