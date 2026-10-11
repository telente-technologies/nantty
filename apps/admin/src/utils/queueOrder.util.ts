export const withdrawalQueueStatuses: readonly string[] = ["pending_review", "on_hold", "queued"];
export const openDisputeStatuses: readonly string[] = ["awaiting_seller", "under_review"];

export function isOldestFirstQueue(statuses: readonly string[] | null, queueStatuses: readonly string[]): boolean {
  return statuses !== null && statuses.length > 0 && statuses.every((status) => queueStatuses.includes(status));
}

export function compareForQueue(first: string, second: string, oldestFirst: boolean): number {
  return oldestFirst ? first.localeCompare(second) : second.localeCompare(first);
}

export function formatWaitingAge(ageHours: number): string {
  if (ageHours < 1) return "under 1 h";
  if (ageHours < 48) return `${ageHours} h`;
  return `${Math.floor(ageHours / 24)} d`;
}

export function hoursSince(isoTime: string, now: number = Date.now()): number {
  const started = Date.parse(isoTime);
  return Number.isNaN(started) ? 0 : Math.max(Math.floor((now - started) / 3_600_000), 0);
}
