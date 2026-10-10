import type { Comment, Post, SavedItemType } from "@/types";

import { isoDateHoursAgo } from "./fixtures.mock";

export interface SavedEntry {
  readonly type: SavedItemType;
  readonly targetId: string;
  readonly savedAt: string;
}

export const savedEntriesNewestFirst: SavedEntry[] = [
  { type: "clip", targetId: "clip_amaka_haul", savedAt: isoDateHoursAgo(2) },
  { type: "post", targetId: "post_3", savedAt: isoDateHoursAgo(5) },
  { type: "product", targetId: "pr_s2", savedAt: isoDateHoursAgo(9) },
  { type: "post", targetId: "post_7", savedAt: isoDateHoursAgo(20) },
  { type: "clip", targetId: "clip_bisola_jollof", savedAt: isoDateHoursAgo(30) },
  { type: "product", targetId: "pr_g3", savedAt: isoDateHoursAgo(48) },
  { type: "post", targetId: "post_12", savedAt: isoDateHoursAgo(72) },
];

export const isSavedBySignedInViewer = (type: SavedItemType, targetId: string) =>
  savedEntriesNewestFirst.some((entry) => entry.type === type && entry.targetId === targetId);

export const withViewerSavedState = <Item extends Post>(item: Item, type: SavedItemType = item.kind === "clip" ? "clip" : "post"): Item => {
  const savedUnderEitherPostType = type === "clip" ? isSavedBySignedInViewer("clip", item.id) : isSavedBySignedInViewer("post", item.id) || isSavedBySignedInViewer("video", item.id);
  return savedUnderEitherPostType === item.bookmarked ? item : { ...item, bookmarked: savedUnderEitherPostType };
};

export const withCommentViewerSavedState = (comment: Comment): Comment => {
  const saved = isSavedBySignedInViewer("comment", comment.id);
  return saved === comment.bookmarked ? comment : { ...comment, bookmarked: saved };
};

export const saveTargetForSignedInViewer = (type: SavedItemType, targetId: string) => {
  if (isSavedBySignedInViewer(type, targetId)) return;
  savedEntriesNewestFirst.unshift({ type, targetId, savedAt: new Date().toISOString() });
};

export const unsaveTargetForSignedInViewer = (type: SavedItemType, targetId: string) => {
  const index = savedEntriesNewestFirst.findIndex((entry) => entry.type === type && entry.targetId === targetId);
  if (index >= 0) savedEntriesNewestFirst.splice(index, 1);
};
