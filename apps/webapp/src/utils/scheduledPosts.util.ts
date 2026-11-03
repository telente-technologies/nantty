const MAX_SCHEDULE_AHEAD_MS = 90 * 24 * 60 * 60 * 1000;

export function validateScheduleDate(value: string, now = Date.now()): { readonly scheduledAt: string | null; readonly message: string } {
  const date = new Date(value);
  if (!value || !Number.isFinite(date.getTime())) return { scheduledAt: null, message: "Choose a valid date and time." };
  if (date.getTime() < now + 60_000) return { scheduledAt: null, message: "Choose a time at least one minute from now." };
  if (date.getTime() > now + MAX_SCHEDULE_AHEAD_MS) return { scheduledAt: null, message: "Posts can be scheduled up to 90 days ahead." };
  return { scheduledAt: date.toISOString(), message: "" };
}
