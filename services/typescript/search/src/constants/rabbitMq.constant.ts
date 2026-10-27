export const domainEventsExchange = "nantty.events";
export const jobsExchange = "nantty.jobs";
export const retryExchange = "nantty.retry";
export const maximumDeliveryAttempts = 5;
export const attemptHeader = "x-nantty-attempt";
export const lastErrorHeader = "x-nantty-last-error";

export interface RetryTier {
  readonly name: string;
  readonly delaySeconds: number;
}

export const retryTiers: readonly RetryTier[] = [
  { name: "30s", delaySeconds: 30 },
  { name: "2m", delaySeconds: 120 },
  { name: "10m", delaySeconds: 600 },
  { name: "30m", delaySeconds: 1800 },
];
