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

export { formatCompactCount, formatCompactCount as formatCountWithThousandsSuffix } from "./formatCount.util";
