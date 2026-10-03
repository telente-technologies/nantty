import { defaultPageSize, maximumPageSize } from "../constants/search.constant.js";
import type { SearchCursor } from "../types/searchResult.type.js";

export function clampPageSize(requested: number | undefined): number {
  if (requested === undefined || !Number.isFinite(requested)) return defaultPageSize;
  return Math.min(Math.max(Math.trunc(requested), 1), maximumPageSize);
}

export function encodeSearchCursor(cursor: SearchCursor): string {
  return Buffer.from(JSON.stringify({ s: cursor.score, k: cursor.key })).toString("base64url");
}

export function decodeSearchCursor(raw: string | undefined): SearchCursor | undefined {
  if (raw === undefined || raw === "") return undefined;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as { s?: unknown; k?: unknown };
    if (typeof parsed.s === "number" && Number.isFinite(parsed.s) && typeof parsed.k === "string" && parsed.k.length <= 300) return { score: parsed.s, key: parsed.k };
    return undefined;
  } catch {
    return undefined;
  }
}
