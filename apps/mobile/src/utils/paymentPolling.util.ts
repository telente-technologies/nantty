export type PolledPaymentStatus = "pending" | "paid" | "failed";
export type PaymentPollOutcome = "paid" | "failed" | "timeout" | "cancelled";

export interface PaymentPollOptions {
  readonly check: () => Promise<PolledPaymentStatus>;
  readonly isOnline: () => boolean;
  readonly onOfflineChange?: (offline: boolean) => void;
  readonly isCancelled?: () => boolean;
  readonly intervalMs?: number;
  readonly timeoutMs?: number;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
}

export const PAYMENT_POLL_INTERVAL_MS = 3_000;
export const PAYMENT_POLL_TIMEOUT_MS = 120_000;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function pollPaymentUntilSettled(options: PaymentPollOptions): Promise<PaymentPollOutcome> {
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const interval = options.intervalMs ?? PAYMENT_POLL_INTERVAL_MS;
  let deadline = now() + (options.timeoutMs ?? PAYMENT_POLL_TIMEOUT_MS);
  let offline = false;
  while (now() < deadline) {
    if (options.isCancelled?.()) return "cancelled";
    if (!options.isOnline()) {
      if (!offline) options.onOfflineChange?.(true);
      offline = true;
      deadline += interval;
      await sleep(interval);
      continue;
    }
    if (offline) options.onOfflineChange?.(false);
    offline = false;
    try {
      const status = await options.check();
      if (status === "paid" || status === "failed") return status;
    } catch {
      if (!options.isOnline()) continue;
    }
    await sleep(interval);
  }
  return "timeout";
}
