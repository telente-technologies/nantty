export interface BatchPlan {
  readonly batchesTotal: number;
  readonly estimatedSeconds: number;
}

export function planBatches(audienceSize: number, batchSize: number, ratePerSecond: number): BatchPlan {
  const batchesTotal = audienceSize <= 0 ? 0 : Math.ceil(audienceSize / batchSize);
  return { batchesTotal, estimatedSeconds: Math.ceil(audienceSize / ratePerSecond) };
}

export function estimateCompletionAt(queuedAt: Date, audienceSize: number, ratePerSecond: number): Date {
  return new Date(queuedAt.getTime() + Math.ceil(audienceSize / ratePerSecond) * 1000);
}
