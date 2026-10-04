import type { ISODate } from "@/types";

export function formatTimeSincePosted(date: ISODate, now = Date.now()): string {
  const seconds = Math.max(0, Math.floor((now - new Date(date).getTime()) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

export function formatJoinedDate(date: ISODate): string {
  return `Joined ${new Date(date).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`;
}

export function formatCompactCount(n: number): string {
  if (n < 1000) return String(n);
  const [divisor, suffix] = n < 1_000_000 ? [1000, "K"] : [1_000_000, "M"];
  const scaled = n / divisor;
  const rounded = scaled < 10 ? Math.floor(scaled * 10) / 10 : Math.floor(scaled);
  return `${rounded}${suffix}`;
}

export function formatCountWithThousandsSuffix(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${Math.round(n / 100) / 10}k`.replace(".0k", "k");
  return `${Math.round(n / 100_000) / 10}m`.replace(".0m", "m");
}
