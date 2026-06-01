import type { Hex } from "viem";

let activePaymentId: Hex | null = null;

export function setRegistrationPaymentId(id: Hex): void {
  activePaymentId = id;
}

export function getRegistrationPaymentId(): Hex | null {
  return activePaymentId;
}

export function clearRegistrationPaymentId(): void {
  activePaymentId = null;
}

export async function runWithRegistrationPayment<T>(
  paymentId: Hex | null,
  fn: () => Promise<T>,
): Promise<T> {
  const previous = activePaymentId;
  activePaymentId = paymentId;
  try {
    return await fn();
  } finally {
    activePaymentId = previous;
  }
}
