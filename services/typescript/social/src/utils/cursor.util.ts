import { defaultPageSize, maximumPageSize } from "../constants/social.constant.js";
import type { Page } from "../types/pagination.type.js";

export function clampPageSize(requested: number | undefined, fallback = defaultPageSize): number {
  if (requested === undefined || !Number.isFinite(requested)) return fallback;
  return Math.min(Math.max(Math.trunc(requested), 1), maximumPageSize);
}

export function buildPageFromOverfetchedRows<T extends { readonly id: string }>(rows: readonly T[], limit: number): Page<T> {
  const data = rows.slice(0, limit);
  const last = data.at(-1);
  return { data, nextCursor: rows.length > limit && last !== undefined ? last.id : null };
}

export function encodeOffsetCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString("base64url");
}

export function decodeOffsetCursor(cursor: string | undefined): number {
  if (cursor === undefined) return 0;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as { o?: unknown };
    return typeof parsed.o === "number" && parsed.o >= 0 ? Math.trunc(parsed.o) : 0;
  } catch {
    return 0;
  }
}
