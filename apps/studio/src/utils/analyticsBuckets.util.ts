export type RangePreset = "7d" | "30d" | "90d" | "custom";

export interface DateRange {
  readonly start: Date;
  readonly end: Date;
}

export interface Bucket {
  readonly key: string;
  readonly label: string;
  readonly start: Date;
  readonly end: Date;
  readonly value: number;
}

const DAY_MS = 86_400_000;
export const MAXIMUM_RANGE_DAYS = 366;

export const startOfLocalDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

export function rangeForPreset(preset: Exclude<RangePreset, "custom">, now = new Date()): DateRange {
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  const end = addDays(startOfLocalDay(now), 1);
  return { start: addDays(end, -days), end };
}

export function parseCustomRange(from: string, to: string, now = new Date()): { readonly range: DateRange | null; readonly error: string | null } {
  const pattern = /^\d{4}-\d{2}-\d{2}$/;
  if (!pattern.test(from) || !pattern.test(to)) return { range: null, error: "Pick a start and an end date." };
  const [fy, fm, fd] = from.split("-").map(Number) as [number, number, number];
  const [ty, tm, td] = to.split("-").map(Number) as [number, number, number];
  const start = new Date(fy, fm - 1, fd);
  const end = addDays(new Date(ty, tm - 1, td), 1);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return { range: null, error: "Pick a start and an end date." };
  if (start >= end) return { range: null, error: "The start date must be on or before the end date." };
  if (start > now) return { range: null, error: "The start date can't be in the future." };
  if ((end.getTime() - start.getTime()) / DAY_MS > MAXIMUM_RANGE_DAYS) return { range: null, error: `Pick a range of up to ${MAXIMUM_RANGE_DAYS} days.` };
  return { range: { start, end }, error: null };
}

export const toDateInputValue = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

export const isWithinRange = (iso: string | null, range: DateRange) => {
  if (!iso) return false;
  const time = new Date(iso).getTime();
  return time >= range.start.getTime() && time < range.end.getTime();
};

export function bucketByDate<T>(items: readonly T[], range: DateRange, dateOf: (item: T) => string | null, valueOf: (item: T) => number): Bucket[] {
  const spanDays = Math.round((range.end.getTime() - range.start.getTime()) / DAY_MS);
  const stepDays = spanDays <= 31 ? 1 : 7;
  const buckets: { key: string; label: string; start: Date; end: Date; value: number }[] = [];
  for (let cursor = range.start; cursor < range.end; cursor = addDays(cursor, stepDays)) {
    const next = addDays(cursor, stepDays);
    const end = next > range.end ? range.end : next;
    const label = cursor.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    buckets.push({ key: toDateInputValue(cursor), label: stepDays === 1 ? label : `w/c ${label}`, start: cursor, end, value: 0 });
  }
  for (const item of items) {
    const iso = dateOf(item);
    if (!isWithinRange(iso, range)) continue;
    const time = new Date(iso!).getTime();
    const bucket = buckets.find((candidate) => time >= candidate.start.getTime() && time < candidate.end.getTime());
    if (bucket) bucket.value += valueOf(item);
  }
  return buckets;
}

export const sumBuckets = (buckets: readonly Bucket[]) => buckets.reduce((total, bucket) => total + bucket.value, 0);
