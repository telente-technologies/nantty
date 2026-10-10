import NetInfo from "@react-native-community/netinfo";

import { ApiError } from "@/errors/api.error";

export class DeviceOfflineError extends Error {
  constructor() {
    super("You're offline. The upload will continue when you're back online.");
  }
}

export interface RetryOptions {
  readonly maximumAttempts?: number;
  readonly baseDelayMs?: number;
  readonly maximumDelayMs?: number;
}

const waitForMilliseconds = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export const isRetryableUploadError = (error: unknown) => {
  if (error instanceof DeviceOfflineError) return false;
  if (error instanceof ApiError) return error.status >= 500 || error.status === 408 || error.status === 429 || error.status === 0;
  return true;
};

export async function isDeviceCurrentlyOffline() {
  const network = await NetInfo.fetch();
  return network.isConnected === false || network.isInternetReachable === false;
}

export const calculateBackoffDelayWithJitter = (attemptNumber: number, baseDelayMs: number, maximumDelayMs: number) => {
  const exponentialDelay = Math.min(maximumDelayMs, baseDelayMs * 2 ** attemptNumber);
  return Math.round(exponentialDelay / 2 + Math.random() * (exponentialDelay / 2));
};

export async function retryWithExponentialBackoffAndJitter<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { maximumAttempts = 6, baseDelayMs = 600, maximumDelayMs = 30_000 } = options;
  let lastError: unknown;
  for (let attemptNumber = 0; attemptNumber < maximumAttempts; attemptNumber++) {
    if (await isDeviceCurrentlyOffline()) throw new DeviceOfflineError();
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!isRetryableUploadError(error) || attemptNumber === maximumAttempts - 1) throw error;
      await waitForMilliseconds(calculateBackoffDelayWithJitter(attemptNumber, baseDelayMs, maximumDelayMs));
    }
  }
  throw lastError;
}

export async function runTasksWithBoundedConcurrency<T>(items: readonly T[], concurrencyLimit: number, runTask: (item: T) => Promise<void>) {
  const remainingItems = [...items];
  let firstFailure: { error: unknown } | null = null;
  const runWorkerUntilNoItemsRemain = async () => {
    while (remainingItems.length > 0 && firstFailure === null) {
      const nextItem = remainingItems.shift() as T;
      try {
        await runTask(nextItem);
      } catch (error) {
        firstFailure ??= { error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrencyLimit, items.length) }, runWorkerUntilNoItemsRemain));
  if (firstFailure !== null) throw (firstFailure as { error: unknown }).error;
}
