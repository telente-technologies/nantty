import type { Prisma } from "../generated/prisma/client.js";
import type { Db } from "../types/database.type.js";

type EventData = Readonly<Record<string, unknown>>;

interface MuteTarget {
  readonly recipientId: string;
  readonly postId: string;
}

const text = (value: unknown): string | null => (typeof value === "string" && value !== "" ? value : null);

const targetFrom = (recipient: unknown, post: unknown): MuteTarget | null => {
  const recipientId = text(recipient);
  const postId = text(post);
  return recipientId === null || postId === null ? null : { recipientId, postId };
};

export const postScopedNotificationTargets: Readonly<Record<string, (data: EventData) => MuteTarget | null>> = {
  "comment.created": (data) => targetFrom(data["recipientUserId"], data["postId"]),
  "mention.created": (data) => targetFrom(data["recipientUserId"], data["postId"]),
  "videoReply.created": (data) => targetFrom(data["recipientUserId"], data["originalClipId"]),
  "post.tagged": (data) => targetFrom(data["recipientUserId"], data["postId"]),
  "post.reshared": (data) => targetFrom(data["originalAuthorId"], data["originalPostId"]),
  "post.liked": (data) => targetFrom(data["postAuthorId"], data["postId"]),
  "comment.liked": (data) => targetFrom(data["commentAuthorId"], data["postId"]),
  "comment.pinned": (data) => targetFrom(data["commentAuthorId"], data["postId"]),
};

export function postNotificationTargetOf(eventType: string, data: unknown): MuteTarget | null {
  const read = postScopedNotificationTargets[eventType];
  return read === undefined || data === null || typeof data !== "object" || Array.isArray(data) ? null : read(data as EventData);
}

export async function markMutedPostNotifications<T extends { readonly eventType: string; readonly data: Prisma.InputJsonValue }>(db: Db, events: readonly T[]): Promise<T[]> {
  const targets = events.map((event) => postNotificationTargetOf(event.eventType, event.data));
  const pairs = targets.filter((target): target is MuteTarget => target !== null);
  if (pairs.length === 0) return [...events];
  const muted = await db.postNotificationMute.findMany({ where: { OR: pairs.map((pair) => ({ userId: pair.recipientId, postId: pair.postId })) }, select: { userId: true, postId: true } });
  if (muted.length === 0) return [...events];
  const mutedKeys = new Set(muted.map((row) => `${row.userId}:${row.postId}`));
  return events.map((event, index) => {
    const target = targets[index];
    return target !== null && target !== undefined && mutedKeys.has(`${target.recipientId}:${target.postId}`) ? { ...event, data: { ...(event.data as EventData), notificationsMuted: true } as Prisma.InputJsonValue } : event;
  });
}
