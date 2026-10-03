import { attemptHeader, lastErrorHeader, maximumDeliveryAttempts, retryTiers, type RetryTier } from "../constants/rabbitMq.constant.js";

export function retryQueueName(queue: string, tier: RetryTier): string {
  return `${queue}.retry.${tier.name}`;
}

export function retryTierAfterFailedAttempt(failedAttempt: number): RetryTier | null {
  if (failedAttempt < 1 || failedAttempt >= maximumDeliveryAttempts) return null;
  return retryTiers[Math.min(failedAttempt - 1, retryTiers.length - 1)] ?? null;
}

export function delayTierAtMost(delaySeconds: number): RetryTier | null {
  return retryTiers.filter((tier) => tier.delaySeconds <= delaySeconds).at(-1) ?? null;
}

export function deliveryAttemptFromHeaders(headers: Record<string, unknown> | undefined): number {
  const value = Number(headers?.[attemptHeader] ?? 0);
  return Number.isInteger(value) && value > 0 ? value : 0;
}

export function headersForRetry(headers: Record<string, unknown> | undefined, failedAttempt: number, error: unknown): Record<string, unknown> {
  const kept = Object.fromEntries(Object.entries(headers ?? {}).filter(([key]) => !/^x-(death|first-death|last-death)/.test(key)));
  const message = error instanceof Error ? error.message : String(error);
  return { ...kept, [attemptHeader]: failedAttempt, [lastErrorHeader]: message.slice(0, 256) };
}
