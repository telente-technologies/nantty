import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox, type DomainEventInput } from "../../../../events/outbox.event.js";
import type { Prisma } from "../../../../generated/prisma/client.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { extractHashtags } from "../../../internalSources/services/hashtags.service.js";
import type { PostRow } from "../../../posts/repositories/post.repository.js";
import { loadPostVisibleToViewer } from "../../../posts/services/postAccess.service.js";
import type { RecordFeedInteractionCommand } from "./recordFeedInteraction.command.js";

const maximumMilliseconds = 3_600_000;
const clamp = (value: number | undefined, maximum: number) => Math.min(maximum, Math.max(0, Math.round(value ?? 0)));

export function statIncrementsFor(command: RecordFeedInteractionCommand): Prisma.PostDailyStatUpdateInput {
  if (command.kind === "watch") return { videoViews: { increment: 1 }, watchTimeSeconds: { increment: Math.round(clamp(command.watchMs ?? command.durationMs, maximumMilliseconds) / 1000) } };
  if (command.kind === "link_click") return { linkClicks: { increment: 1 } };
  if (command.kind === "follow") return { newFollows: { increment: 1 } };
  return {};
}

export function interactionEventFor(command: RecordFeedInteractionCommand, post: PostRow, occurredAt: Date): DomainEventInput | null {
  if (command.viewerId === undefined || command.viewerId === post.authorId) return null;
  const base = { actorId: command.viewerId, postId: post.id, postAuthorId: post.authorId, authorId: post.authorId, kind: post.kind, topics: post.topics, hashtags: extractHashtags(post.text).slice(0, 20), surface: command.surface ?? null, rankingRequestId: command.rankingRequestId ?? null };
  if (command.kind === "view" || command.kind === "dwell") {
    return { eventType: socialEventTypes.postViewed, subject: post.id, occurredAt, data: { ...base, dwellMs: clamp(command.dwellMs, maximumMilliseconds), position: command.position ?? null, isProductPost: post.productIds.length > 0 } };
  }
  if (command.kind === "watch") {
    return { eventType: socialEventTypes.clipWatched, subject: post.id, occurredAt, data: { ...base, watchFraction: Math.min(1, Math.max(0, command.watchFraction ?? 0)), loopCount: clamp(command.loopCount, 100), durationMs: clamp(command.durationMs, maximumMilliseconds), watchMs: clamp(command.watchMs, maximumMilliseconds) } };
  }
  if (command.kind === "link_click") return { eventType: socialEventTypes.postLinkClicked, subject: post.id, occurredAt, data: base };
  return null;
}

export function createRecordFeedInteractionHandler(context: HandlerContext): Handler<RecordFeedInteractionCommand, void> {
  return async (command) => {
    const post = await loadPostVisibleToViewer(context, command.viewerId, command.postId);
    if (command.kind === "profile_click") return;
    const now = context.clock.now();
    const day = now.toISOString().slice(0, 10);
    const increments = command.viewerId === post.authorId ? {} : statIncrementsFor(command);
    const event = interactionEventFor(command, post, now);
    if (Object.keys(increments).length === 0 && event === null) return;
    await context.database.transaction(async (transaction) => {
      if (Object.keys(increments).length > 0) {
        await transaction.postDailyStat.upsert({ where: { postId_day: { postId: post.id, day } }, create: { postId: post.id, day }, update: {} });
        await transaction.postDailyStat.update({ where: { postId_day: { postId: post.id, day } }, data: increments });
      }
      if (event !== null) await appendDomainEventsToOutbox(transaction, [event]);
    });
  };
}
