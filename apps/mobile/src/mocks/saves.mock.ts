import { ApiError } from "@/errors/api.error";
import type { Page, SavedItem, SavedItemType } from "@/types";

import { findMockClipsByIds } from "./clips.mock";
import { findCommentAnywhere } from "./comments.mock";
import { findPostIncludingSponsored } from "./posts.mock";
import { buildCatalogProductSummary, findCatalogSeedByProductId } from "./productCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { savedEntriesNewestFirst, saveTargetForSignedInViewer, unsaveTargetForSignedInViewer, type SavedEntry } from "./savedEntries.mock";

const SAVED_ITEMS_PAGE_SIZE = 12;
const SAVED_ITEM_TYPES: readonly SavedItemType[] = ["post", "video", "clip", "product", "comment"];

const entryKey = (type: SavedItemType, targetId: string) => `${type}:${targetId}`;

const resolveSavedEntry = (entry: SavedEntry): SavedItem | null => {
  const base = { id: entryKey(entry.type, entry.targetId), targetId: entry.targetId, savedAt: entry.savedAt };
  if (entry.type === "clip") {
    const clip = findMockClipsByIds([entry.targetId])[0];
    return clip ? { ...base, type: "clip", clip: { ...clip, bookmarked: true } } : null;
  }
  if (entry.type === "product") {
    const seed = findCatalogSeedByProductId(entry.targetId);
    return seed ? { ...base, type: "product", product: buildCatalogProductSummary(seed) } : null;
  }
  if (entry.type === "comment") {
    const comment = findCommentAnywhere(entry.targetId);
    return comment ? { ...base, type: "comment", comment: { ...comment, bookmarked: true }, postId: comment.postId } : null;
  }
  const post = findPostIncludingSponsored(entry.targetId);
  return post ? { ...base, type: entry.type, post: { ...post, bookmarked: true } } : null;
};

const pageOfSavedItems = (type: SavedItemType | null, cursor: string | null): Page<SavedItem> => {
  const resolved = savedEntriesNewestFirst
    .filter((entry) => !type || entry.type === type)
    .map(resolveSavedEntry)
    .filter((item): item is SavedItem => item !== null);
  const start = Number(cursor ?? 0) || 0;
  const end = start + SAVED_ITEMS_PAGE_SIZE;
  return { data: resolved.slice(start, end), nextCursor: end < resolved.length ? String(end) : null };
};

const readSaveTarget = (source: { type?: unknown; targetId?: unknown } | null): SavedEntry => {
  const type = source?.type as SavedItemType;
  const targetId = typeof source?.targetId === "string" ? source.targetId : "";
  if (!SAVED_ITEM_TYPES.includes(type) || !targetId) throw new ApiError(422, "Choose something to save.", "INVALID_SAVE_TARGET");
  return { type, targetId, savedAt: new Date().toISOString() };
};

export const savesMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/saves", ({ query }) => {
    const type = query.get("type") as SavedItemType | null;
    if (type && !SAVED_ITEM_TYPES.includes(type)) throw new ApiError(422, "Unknown saved item type.", "INVALID_SAVE_TYPE");
    return pageOfSavedItems(type, query.get("cursor"));
  }),
  createMockRoute("POST", "/api/v1/saves", ({ body }) => {
    const entry = readSaveTarget(body as { type?: unknown; targetId?: unknown } | null);
    saveTargetForSignedInViewer(entry.type, entry.targetId);
  }),
  createMockRoute("DELETE", "/api/v1/saves", ({ query }) => {
    const entry = readSaveTarget({ type: query.get("type"), targetId: query.get("targetId") });
    unsaveTargetForSignedInViewer(entry.type, entry.targetId);
  }),
];
