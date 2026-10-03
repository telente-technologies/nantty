const formatterCache = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  const cached = formatterCache.get(timeZone);
  if (cached !== undefined) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

function localFields(instant: Date, timeZone: string) {
  const parts = Object.fromEntries(formatterFor(timeZone).formatToParts(instant).map((part) => [part.type, part.value]));
  return { year: Number(parts["year"]), month: Number(parts["month"]), day: Number(parts["day"]), hour: Number(parts["hour"]), minute: Number(parts["minute"]), second: Number(parts["second"]) };
}

export function offsetMillisecondsAt(instant: Date, timeZone: string): number {
  const fields = localFields(instant, timeZone);
  const asUtc = Date.UTC(fields.year, fields.month - 1, fields.day, fields.hour, fields.minute, fields.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

const pad = (value: number) => String(value).padStart(2, "0");

export function localDayLabel(instant: Date, timeZone: string): string {
  const fields = localFields(instant, timeZone);
  return `${fields.year}-${pad(fields.month)}-${pad(fields.day)}`;
}

export function addDaysToLabel(label: string, days: number): string {
  const [year, month, day] = label.split("-").map(Number) as [number, number, number];
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export function daysBetweenLabels(earlier: string, later: string): number {
  const toUtc = (label: string) => {
    const [year, month, day] = label.split("-").map(Number) as [number, number, number];
    return Date.UTC(year, month - 1, day);
  };
  return Math.round((toUtc(later) - toUtc(earlier)) / 86_400_000);
}

export function startOfLocalDay(label: string, timeZone: string): Date {
  const [year, month, day] = label.split("-").map(Number) as [number, number, number];
  const guess = Date.UTC(year, month - 1, day);
  const firstPass = guess - offsetMillisecondsAt(new Date(guess), timeZone);
  return new Date(guess - offsetMillisecondsAt(new Date(firstPass), timeZone));
}

export function endOfLocalDay(label: string, timeZone: string): Date {
  return startOfLocalDay(addDaysToLabel(label, 1), timeZone);
}

export function secondsUntilLocalDayEnds(instant: Date, timeZone: string): number {
  return Math.max(0, Math.ceil((endOfLocalDay(localDayLabel(instant, timeZone), timeZone).getTime() - instant.getTime()) / 1000));
}

export function localMonthKey(instant: Date, timeZone: string): string {
  return localDayLabel(instant, timeZone).slice(0, 7);
}
