export function isoMinutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

export function isoMinutesFromNow(minutes: number): string {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

export const reportSlaMinutesByPriority = { URGENT: 60, HIGH: 240, NORMAL: 1440, LOW: 4320 } as const;
