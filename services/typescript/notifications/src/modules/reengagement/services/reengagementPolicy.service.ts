export const reengagementInactiveDays = 14;
export const reengagementCapDays = 7;
export const reengagementQueueLeaseMs = 5 * 60_000;
export const reengagementCampaignId = "inactive-user-v1";
const reengagementContentVersion = "generic-return-v1";
export const reengagementJobType = "notifications.reengagement.v1";

/** Stable content deduplication key for a seven-day UTC window. */
export function reengagementContentKeyAt(at: Date): string {
  const window = Math.floor(at.getTime() / (reengagementCapDays * 24 * 60 * 60_000));
  return `${reengagementContentVersion}:${window}`;
}

export interface QuietHours {
  readonly start: string;
  readonly end: string;
}

export function isValidIanaTimeZone(timeZone: string): boolean {
  if (timeZone.length === 0 || timeZone.length > 64 || timeZone.trim() !== timeZone) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone }).format(0);
    return true;
  } catch {
    return false;
  }
}

export function isInLocalQuietHours(timeZone: string, at: Date, quietHours: QuietHours): boolean {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(at);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  const localMinute = hour * 60 + minute;
  const startMinute = parseClockTime(quietHours.start);
  const endMinute = parseClockTime(quietHours.end);
  return startMinute > endMinute ? localMinute >= startMinute || localMinute < endMinute : localMinute >= startMinute && localMinute < endMinute;
}

function parseClockTime(value: string): number {
  const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(value);
  if (match === null) throw new RangeError("Quiet-hour time must use 24-hour HH:mm format.");
  return Number(match[1]) * 60 + Number(match[2]);
}

export function buildReengagementPush() {
  return {
    title: "Come back to Nantty",
    body: "There’s more to explore on Nantty whenever you’re ready.",
    data: { screen: "Home", source: "reengagement" },
  } as const;
}
