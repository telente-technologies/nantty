import type { LiveComment, LiveDetail } from "@/types";

export interface RealtimeEventLike {
  readonly type: string;
  readonly [field: string]: unknown;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const readText = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);
const maximumComments = 200;

export function readControlRoomComment(event: RealtimeEventLike, liveId: string): LiveComment | null {
  if (event.type !== "live.comment" || event.liveId !== liveId || typeof event.text !== "string") return null;
  const id = readText(event.id);
  const author = isRecord(event.author) ? event.author : null;
  const authorName = readText(author?.name) ?? readText(author?.username);
  if (!id || !authorName) return null;
  return { id, authorName, text: event.text, createdAt: readText(event.createdAt) ?? new Date().toISOString() };
}

export function prependComment(comments: readonly LiveComment[] | undefined, comment: LiveComment): readonly LiveComment[] | undefined {
  if (!comments || comments.some((existing) => existing.id === comment.id)) return comments;
  return [comment, ...comments].slice(0, maximumComments);
}

export function removeComment(comments: readonly LiveComment[] | undefined, commentId: string): readonly LiveComment[] | undefined {
  if (!comments || !comments.some((existing) => existing.id === commentId)) return comments;
  return comments.filter((existing) => existing.id !== commentId);
}

export function applyViewerCount(live: LiveDetail | undefined, event: RealtimeEventLike, liveId: string): LiveDetail | undefined {
  if (!live || event.type !== "live.viewerCount" || event.liveId !== liveId || typeof event.viewers !== "number" || !Number.isFinite(event.viewers) || event.viewers < 0) return live;
  const viewers = Math.floor(event.viewers);
  return viewers === live.viewers ? live : { ...live, viewers, peakViewers: Math.max(live.peakViewers, viewers) };
}

export type ControlRoomRefresh = "live" | "comments" | "guests" | "safety";

const refreshByEventType: Record<string, readonly ControlRoomRefresh[]> = {
  "live.started": ["live"],
  "live.ended": ["live", "guests"],
  "live.topSupporter": ["live"],
  "gift.sent": ["live"],
  "gift.goal.progress": ["live"],
  "gift.goal.completed": ["live"],
  "leaderboard.updated": ["live"],
  "live.comment.pinned": ["comments"],
  "live.comment.unpinned": ["comments"],
  "guest.joined": ["guests"],
  "guest.left": ["guests"],
  "guest.removed": ["guests"],
  "guest.muted": ["guests"],
  "guest.reconnecting": ["guests"],
  "stage.updated": ["guests"],
  "live.safety.paused": ["safety", "live"],
  "live.safety.resumed": ["safety", "live"],
  "live.safety.hostNotice": ["safety"],
};

export function readControlRoomRefreshes(event: RealtimeEventLike, liveId: string): readonly ControlRoomRefresh[] {
  if (event.liveId !== liveId) return [];
  return refreshByEventType[event.type] ?? [];
}

export function isCommentNotification(event: RealtimeEventLike): boolean {
  if (event.type !== "notification.created" || !isRecord(event.notification)) return false;
  const notification = event.notification;
  return notification.category === "social" && (notification.kind === undefined || notification.kind === "mention" || notification.kind === "videoReply");
}
