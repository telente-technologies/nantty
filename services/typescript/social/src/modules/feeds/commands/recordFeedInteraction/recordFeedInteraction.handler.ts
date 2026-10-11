import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox, type DomainEventInput } from "../../../../events/outbox.event.js";
import type { Prisma } from "../../../../generated/prisma/client.js";
import type { Db } from "../../../../types/database.type.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { extractHashtags } from "../../../internalSources/services/hashtags.service.js";
import { followRepository } from "../../../follows/repositories/follow.repository.js";
import type { PostRow } from "../../../posts/repositories/post.repository.js";
import { postRepository } from "../../../posts/repositories/post.repository.js";
import { loadPostVisibleToViewer } from "../../../posts/services/postAccess.service.js";
import { claimFollowAttribution, claimViewerCooldown, plausibleWatchMs } from "../../../posts/services/postViewerCounters.service.js";
import type { RecordFeedInteractionCommand } from "./recordFeedInteraction.command.js";

const maximumMilliseconds = 3_600_000;
const completedWatchFraction = 0.9;
const dwellAttributionWindowMs = 2 * 3_600_000;
const eventSlugPattern = /^[a-z0-9_-]{1,64}$/;
const clamp = (value: number | undefined, maximum: number) => Math.min(maximum, Math.max(0, Math.round(value ?? 0)));

type DailyStatField = "impressions" | "videoViews" | "watchTimeSeconds" | "completedViews" | "linkClicks" | "newFollows";
type DailyIncrements = Partial<Record<DailyStatField, number>>;

export function isCompletedWatch(command: RecordFeedInteractionCommand): boolean {
  return (command.watchFraction ?? 0) >= completedWatchFraction || (command.loopCount ?? 0) >= 1;
}

export function watchIncrementsFor(command: RecordFeedInteractionCommand): DailyIncrements {
  const watchedMs = plausibleWatchMs(command.watchMs, command.durationMs, command.loopCount, maximumMilliseconds);
  return { videoViews: 1, watchTimeSeconds: Math.round(watchedMs / 1000), completedViews: isCompletedWatch(command) ? 1 : 0 };
}

export function interactionEventFor(command: RecordFeedInteractionCommand, post: PostRow, occurredAt: Date): DomainEventInput | null {
  if (command.viewerId === undefined || command.viewerId === post.authorId) return null;
  const base = { actorId: command.viewerId, postId: post.id, postAuthorId: post.authorId, authorId: post.authorId, kind: post.kind, topics: post.topics, hashtags: extractHashtags(post.text).filter((tag) => eventSlugPattern.test(tag)).slice(0, 20), surface: command.surface ?? null, rankingRequestId: command.rankingRequestId ?? null };
  if (command.kind === "view" || command.kind === "dwell") {
    return { eventType: socialEventTypes.postViewed, subject: post.id, occurredAt, data: { ...base, dwellMs: clamp(command.dwellMs, maximumMilliseconds), position: command.position ?? null, isProductPost: post.productIds.length > 0 } };
  }
  if (command.kind === "watch") {
    const watchMs = plausibleWatchMs(command.watchMs, command.durationMs, command.loopCount, maximumMilliseconds);
    return { eventType: socialEventTypes.clipWatched, subject: post.id, occurredAt, data: { ...base, watchFraction: Math.min(1, Math.max(0, command.watchFraction ?? 0)), loopCount: clamp(command.loopCount, 100), durationMs: clamp(command.durationMs, maximumMilliseconds), watchMs } };
  }
  if (command.kind === "link_click") return { eventType: socialEventTypes.postLinkClicked, subject: post.id, occurredAt, data: base };
  return null;
}

async function bumpDailyStats(db: Db, postId: string, day: string, increments: DailyIncrements): Promise<void> {
  const entries = Object.entries(increments).filter(([, value]) => value !== undefined && value > 0) as [DailyStatField, number][];
  if (entries.length === 0) return;
  const update: Prisma.PostDailyStatUpdateInput = Object.fromEntries(entries.map(([field, value]) => [field, { increment: value }]));
  await db.postDailyStat.upsert({ where: { postId_day: { postId, day } }, create: { postId, day, ...Object.fromEntries(entries) }, update });
}

async function hasRecentView(db: Db, postId: string, viewerKey: string, now: Date): Promise<boolean> {
  const row = await db.postViewer.findUnique({ where: { postId_viewerKey: { postId, viewerKey } }, select: { lastViewedAt: true } });
  return row?.lastViewedAt !== null && row?.lastViewedAt !== undefined && row.lastViewedAt.getTime() >= now.getTime() - dwellAttributionWindowMs;
}

async function applyInteraction(db: Db, command: RecordFeedInteractionCommand, post: PostRow, viewerId: string, now: Date): Promise<DomainEventInput | null> {
  const day = now.toISOString().slice(0, 10);
  switch (command.kind) {
    case "view": {
      if (!(await claimViewerCooldown(db, post.id, viewerId, "lastViewedAt", now))) return null;
      await bumpDailyStats(db, post.id, day, { impressions: 1 });
      await postRepository.incrementCounter(db, post.id, "viewCount", 1);
      return null;
    }
    case "dwell":
      if ((command.dwellMs ?? 0) <= 0 || !(await hasRecentView(db, post.id, viewerId, now))) return null;
      return (await claimViewerCooldown(db, post.id, viewerId, "lastDwellAt", now)) ? interactionEventFor(command, post, now) : null;
    case "watch": {
      if (!post.media.some((media) => media.type === "video")) return null;
      if (!(await claimViewerCooldown(db, post.id, viewerId, "lastWatchedAt", now))) return null;
      await bumpDailyStats(db, post.id, day, watchIncrementsFor(command));
      return interactionEventFor(command, post, now);
    }
    case "link_click": {
      if (!(await claimViewerCooldown(db, post.id, viewerId, "lastLinkClickAt", now))) return null;
      await bumpDailyStats(db, post.id, day, { linkClicks: 1 });
      return interactionEventFor(command, post, now);
    }
    case "profile_click": {
      if (await claimViewerCooldown(db, post.id, viewerId, "lastProfileClickAt", now)) await db.post.update({ where: { id: post.id }, data: { profileVisitCount: { increment: 1 } } });
      return null;
    }
    case "follow": {
      const follow = await followRepository.find(db, viewerId, post.authorId);
      if (follow === null || follow.state === "rejected") return null;
      if (await claimFollowAttribution(db, post.id, viewerId, now)) await bumpDailyStats(db, post.id, day, { newFollows: 1 });
      return null;
    }
  }
}

export function createRecordFeedInteractionHandler(context: HandlerContext): Handler<RecordFeedInteractionCommand, void> {
  return async (command) => {
    const post = await loadPostVisibleToViewer(context, command.viewerId, command.postId);
    const viewerId = command.viewerId;
    if (viewerId === undefined || viewerId === post.authorId) return;
    const now = context.clock.now();
    await context.database.transaction(async (transaction) => {
      const event = await applyInteraction(transaction, command, post, viewerId, now);
      if (event !== null) await appendDomainEventsToOutbox(transaction, [event]);
    });
  };
}
