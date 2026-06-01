import type { Hex } from "viem";

let activePaymentId: Hex | null = null;
let stashedRegistrationBody: unknown | undefined;

export function setRegistrationPaymentId(id: Hex): void {
  activePaymentId = id;
}

export function getRegistrationPaymentId(): Hex | null {
  return activePaymentId;
}

export function clearRegistrationPaymentId(): void {
  activePaymentId = null;
}

export function stashRegistrationBody(body: unknown): void {
  stashedRegistrationBody = body;
}

export function takeRegistrationBody(): unknown | undefined {
  const body = stashedRegistrationBody;
  stashedRegistrationBody = undefined;
  return body;
}

export function clearRegistrationRequestState(): void {
  clearRegistrationPaymentId();
  stashedRegistrationBody = undefined;
}
