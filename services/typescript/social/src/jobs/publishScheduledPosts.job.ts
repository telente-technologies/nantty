import type { Logger } from "@nantty/fastify-platform";

import { socialEventTypes } from "../events/eventTypes.event.js";
import { buildExcerpt, resolveEventActor } from "../events/actor.event.js";
import { appendDomainEventsToOutbox, type DomainEventInput } from "../events/outbox.event.js";
import type { MentionEntity } from "../modules/mentions/models/mention.model.js";
import { prepareMentionsForWrite } from "../modules/mentions/services/mentionWrite.service.js";
import { postRepository, type PostRow } from "../modules/posts/repositories/post.repository.js";
import { recordReshareInTransaction } from "../modules/posts/services/quoteTarget.service.js";
import { syncPostTags } from "../modules/posts/services/postTagWrite.service.js";
import { selectTaggableUserIds } from "../modules/posts/services/postTagEligibility.service.js";
import type { HandlerContext } from "../types/handlerContext.type.js";

const batchSize = 25;
const maximumMediaProcessingDelayMs = 24 * 60 * 60_000;

export interface ScheduledPostBatchResult {
  readonly published: number;
  readonly failed: number;
  readonly waitingForMedia: number;
}

type CandidateOutcome = "published" | "failed" | "waitingForMedia" | "skipped";

function scheduledTags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

function scheduledMentions(value: unknown): MentionEntity[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entity): entity is MentionEntity => typeof entity === "object" && entity !== null && "start" in entity && "length" in entity &&
    ("userId" in entity || ("type" in entity && entity.type === "all")));
}

async function publishScheduledPostInTransaction(context: HandlerContext, post: PostRow, now: Date): Promise<CandidateOutcome> {
  return context.database.transaction(async (transaction) => {
    const dueWhere = { id: post.id, publicationState: "scheduled" as const, scheduledAt: { lte: now }, deletedAt: null };
    if (post.moderationVisibility === "hidden" || post.moderationVisibility === "removed") {
      const cancelled = await transaction.post.updateMany({ where: dueWhere, data: { publicationState: "cancelled", scheduledAt: null, scheduledTaggedUserIds: [] } });
      return cancelled.count === 1 ? "failed" : "skipped";
    }
    if (post.media.some((media) => media.status === "failed")) {
      const result = await transaction.post.updateMany({ where: dueWhere, data: { publicationState: "failed", publicationFailureReason: "media_failed" } });
      return result.count === 1 ? "failed" : "skipped";
    }
    if (post.media.some((media) => media.status !== "ready")) {
      const processingExpired = post.scheduledAt !== null && now.getTime() - post.scheduledAt.getTime() >= maximumMediaProcessingDelayMs;
      if (!processingExpired) return "waitingForMedia";
      const result = await transaction.post.updateMany({ where: dueWhere, data: { publicationState: "failed", publicationFailureReason: "media_processing_timeout" } });
      return result.count === 1 ? "failed" : "skipped";
    }

    const claimed = await transaction.post.updateMany({
      where: dueWhere,
      data: { publicationState: "published", scheduledAt: null, scheduledTaggedUserIds: [], publicationFailureReason: null, createdAt: now },
    });
    if (claimed.count !== 1) return "skipped";

    const authorStatus = (await context.directory.findMentionTargetStatuses([post.authorId])).get(post.authorId)?.status;
    const profileUnavailable = post.authorProfileId !== null && await context.directory.findOwnedPostableProfile(post.authorId, post.authorProfileId, "publish") === null;
    if (authorStatus !== "active" || profileUnavailable) {
      await transaction.post.updateMany({
        where: { id: post.id, publicationState: "published", createdAt: now },
        data: { publicationState: "failed", scheduledAt: post.scheduledAt, publicationFailureReason: profileUnavailable ? "profile_unavailable" : "author_unavailable" },
      });
      return "failed";
    }

    const actor = await resolveEventActor(context.directory, post.authorId);
    const mentionResult = await prepareMentionsForWrite(context, { surface: "post", authorId: post.authorId, text: post.text, entities: scheduledMentions(post.mentions) });
    const taggedUserIds = await selectTaggableUserIds(context, post.authorId, scheduledTags(post.scheduledTaggedUserIds));
    const events: DomainEventInput[] = [{
      eventType: socialEventTypes.postCreated,
      subject: post.id,
      occurredAt: now,
      data: {
        postId: post.id,
        authorId: post.authorId,
        authorProfileId: post.authorProfileId,
        authorProfileKind: post.authorProfileKind,
        kind: post.kind,
        audience: post.audience,
        visibility: post.visibility,
        replyPolicy: post.replyPolicy,
        sensitiveLabels: post.sensitiveLabels,
        isAiGenerated: post.isAiGenerated,
        text: post.text.slice(0, 2000),
        mediaIds: post.media.map((media) => media.mediaId),
        topics: post.topics,
        productIds: post.productIds,
        quotedPostId: post.isQuote ? post.resharedFromId : null,
        isVideoReply: false,
      },
    }];
    for (const userId of mentionResult.userIdsToNotify) {
      events.push({
        eventType: socialEventTypes.mentionCreated,
        subject: post.id,
        occurredAt: now,
        data: { recipientUserId: userId, mentionedUserId: userId, actor, authorId: post.authorId, surface: "post", postId: post.id, excerpt: buildExcerpt(post.text), url: `/post/${post.id}` },
      });
    }
    await appendDomainEventsToOutbox(transaction, events);

    if (post.isQuote && post.resharedFromId !== null) {
      const original = await postRepository.findById(transaction, post.resharedFromId);
      if (original !== null) {
        await recordReshareInTransaction(transaction, { postId: post.id, originalId: original.id, actorId: post.authorId, originalAuthorId: original.authorId, isQuote: true, now, actor });
      }
    }
    await syncPostTags(transaction, { postId: post.id, kind: post.kind, authorId: post.authorId, actor, desiredUserIds: taggedUserIds, now });
    return "published";
  });
}

export async function publishDueScheduledPosts(context: HandlerContext, now = context.clock.now(), logger?: Logger): Promise<ScheduledPostBatchResult> {
  const candidates = await context.database.client.post.findMany({
    where: { publicationState: "scheduled", scheduledAt: { lte: now }, deletedAt: null, kind: "post" },
    orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
    take: batchSize,
    include: { media: { orderBy: { position: "asc" } } },
  });
  let published = 0;
  let failed = 0;
  let waitingForMedia = 0;
  for (const post of candidates) {
    try {
      const outcome = await publishScheduledPostInTransaction(context, post, now);
      if (outcome === "published") published += 1;
      else if (outcome === "failed") failed += 1;
      else if (outcome === "waitingForMedia") waitingForMedia += 1;
    } catch (error: unknown) {
      logger?.warn("scheduled post publication attempt failed; will retry", { postId: post.id, error: error instanceof Error ? error.message : String(error) });
    }
  }
  return { published, failed, waitingForMedia };
}

export function startScheduledPostPublisher(context: HandlerContext, logger: Logger, intervalMs: number): () => void {
  const run = () => {
    void publishDueScheduledPosts(context, context.clock.now(), logger).then((result) => {
      if (result.published > 0 || result.failed > 0) logger.info("scheduled post batch processed", { ...result });
    }).catch((error: unknown) => logger.warn("scheduled post publishing failed", { error: error instanceof Error ? error.message : String(error) }));
  };
  const timer = setInterval(run, intervalMs);
  timer.unref();
  run();
  return () => clearInterval(timer);
}
