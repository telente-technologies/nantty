export const paymentPollIntervalMs = 3_000;
export const paymentPollTimeoutMs = 120_000;

const pendingCodes = new Set(["PAYMENT_PENDING", "PAYMENT_NOT_CONFIRMED", "PAYMENT_PROCESSING"]);

export function isPaymentStillPending(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { status, code } = error as { status?: unknown; code?: unknown };
  if (status === 0 || status === 202 || status === 425 || status === 503) return true;
  return typeof code === "string" && pendingCodes.has(code);
}
