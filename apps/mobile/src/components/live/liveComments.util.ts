import type { LiveComment } from "@/types";

/** The API returns newest-first for live refreshes; present the latest rows oldest-to-newest. */
export function selectLatestLiveComments(comments: readonly LiveComment[], visibleCount = 12): LiveComment[] {
  return comments.filter((comment) => comment.kind !== "gift").slice(0, Math.max(0, visibleCount)).reverse();
}

/** Merge newest-first polling/history pages, retaining the freshest version of each row. */
export function mergeLiveCommentPages(
  latest: readonly LiveComment[],
  history: readonly (readonly LiveComment[])[],
): LiveComment[] {
  const byId = new Map<string, LiveComment>();
  for (const comment of latest) {
    if (comment.kind !== "gift") byId.set(comment.id, comment);
  }
  for (const page of history) {
    for (const comment of page) {
      if (comment.kind !== "gift" && !byId.has(comment.id)) byId.set(comment.id, comment);
    }
  }
  return [...byId.values()];
}
