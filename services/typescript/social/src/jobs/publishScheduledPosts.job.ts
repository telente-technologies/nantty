import type { Logger } from "@nantty/fastify-platform";

import { socialEventTypes } from "../events/eventTypes.event.js";
import { buildExcerpt, resolveEventActor } from "../events/actor.event.js";
import { appendDomainEventsToOutbox, type DomainEventInput } from "../events/outbox.event.js";
import type { MentionEntity } from "../modules/mentions/models/mention.model.js";
import { prepareMentionsForWrite } from "../modules/mentions/services/mentionWrite.service.js";
import { postRepository } from "../modules/posts/repositories/post.repository.js";
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

function scheduledTags(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((id): id is string => typeof id === "string") : [];
}

function scheduledMentions(value: unknown): MentionEntity[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entity): entity is MentionEntity => typeof entity === "object" && entity !== null && "start" in entity && "length" in entity &&
    ("userId" in entity || ("type" in entity && entity.type === "all")));
}

export async function publishDueScheduledPosts(context: HandlerContext, now = context.clock.now()): Promise<ScheduledPostBatchResult> {
  return context.database.transaction(async (transaction) => {
    const candidates = await transaction.post.findMany({
      where: { publicationState: "scheduled", scheduledAt: { lte: now }, deletedAt: null, kind: "post" },
      orderBy: [{ scheduledAt: "asc" }, { id: "asc" }],
      take: batchSize,
      include: { media: { orderBy: { position: "asc" } } },
    });
    let published = 0;
    let failed = 0;
    let waitingForMedia = 0;
    for (const post of candidates) {
      if (post.media.some((media) => media.status === "failed")) {
        const result = await transaction.post.updateMany({
          where: { id: post.id, publicationState: "scheduled", scheduledAt: { lte: now }, deletedAt: null },
          data: { publicationState: "failed", publicationFailureReason: "media_failed" },
        });
        failed += result.count;
        continue;
      }
      if (post.media.some((media) => media.status !== "ready")) {
        const processingExpired = post.scheduledAt !== null && now.getTime() - post.scheduledAt.getTime() >= maximumMediaProcessingDelayMs;
        if (processingExpired) {
          const result = await transaction.post.updateMany({
            where: { id: post.id, publicationState: "scheduled", scheduledAt: { lte: now }, deletedAt: null },
            data: { publicationState: "failed", publicationFailureReason: "media_processing_timeout" },
          });
          failed += result.count;
          continue;
        }
        waitingForMedia += 1;
        continue;
      }

      const claimed = await transaction.post.updateMany({
        where: { id: post.id, publicationState: "scheduled", scheduledAt: { lte: now }, deletedAt: null },
        data: { publicationState: "published", scheduledAt: null, scheduledTaggedUserIds: [], publicationFailureReason: null, createdAt: now },
      });
      if (claimed.count !== 1) continue;

      const authorStatus = (await context.directory.findMentionTargetStatuses([post.authorId])).get(post.authorId)?.status;
      const profileUnavailable = post.authorProfileId !== null && await context.directory.findOwnedPostableProfile(post.authorId, post.authorProfileId, "publish") === null;
      if (authorStatus !== "active" || profileUnavailable) {
        await transaction.post.updateMany({
          where: { id: post.id, publicationState: "published", createdAt: now },
          data: { publicationState: "failed", scheduledAt: post.scheduledAt, publicationFailureReason: profileUnavailable ? "profile_unavailable" : "author_unavailable" },
        });
        failed += 1;
        continue;
      }

      const actor = await resolveEventActor(context.directory, post.authorId);
      const mentionResult = await prepareMentionsForWrite(context, {
        surface: "post",
        authorId: post.authorId,
        text: post.text,
        entities: scheduledMentions(post.mentions),
      });
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
        const isClip = post.kind === "clip";
        events.push({
          eventType: socialEventTypes.mentionCreated,
          subject: post.id,
          occurredAt: now,
          data: { recipientUserId: userId, mentionedUserId: userId, actor, authorId: post.authorId, surface: isClip ? "clip" : "post", postId: post.id, excerpt: buildExcerpt(post.text), url: `/${isClip ? "clips" : "post"}/${post.id}` },
        });
      }
      await appendDomainEventsToOutbox(transaction, events);

      if (post.isQuote && post.resharedFromId !== null) {
        const original = await postRepository.findById(transaction, post.resharedFromId);
        if (original !== null) {
          await recordReshareInTransaction(transaction, {
            postId: post.id,
            originalId: original.id,
            actorId: post.authorId,
            originalAuthorId: original.authorId,
            isQuote: true,
            now,
            actor,
          });
        }
      }
      await syncPostTags(transaction, {
        postId: post.id,
        kind: post.kind,
        authorId: post.authorId,
        actor,
        desiredUserIds: taggedUserIds,
        now,
      });
      published += 1;
    }
    return { published, failed, waitingForMedia };
  });
}

export function startScheduledPostPublisher(context: HandlerContext, logger: Logger, intervalMs: number): () => void {
  const run = () => {
    void publishDueScheduledPosts(context).then((result) => {
      if (result.published > 0 || result.failed > 0) logger.info("scheduled post batch processed", { ...result });
    }).catch((error: unknown) => logger.warn("scheduled post publishing failed", { error: error instanceof Error ? error.message : String(error) }));
  };
  const timer = setInterval(run, intervalMs);
  timer.unref();
  run();
  return () => clearInterval(timer);
}
