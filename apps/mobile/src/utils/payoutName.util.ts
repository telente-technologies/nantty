const normalizeName = (name: string) => name.toUpperCase().replace(/[^A-Z ]/g, "").split(/\s+/).filter(Boolean).sort().join(" ");

export const payoutNamesMatch = (first: string, second: string) => !!first.trim() && normalizeName(first) === normalizeName(second);

export function formatCountdownUntil(isoDate: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.floor((Date.parse(isoDate) - now) / 60_000));
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
}
