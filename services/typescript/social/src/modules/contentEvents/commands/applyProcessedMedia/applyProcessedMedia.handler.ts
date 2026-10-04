import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import { choosePrimaryVariant, publicMediaUrl } from "../../services/mediaUrls.service.js";
import type { ApplyProcessedMediaCommand } from "./applyProcessedMedia.command.js";

export interface AppliedMediaCounts {
  readonly postMedia: number;
  readonly messages: number;
}

export function createApplyProcessedMediaHandler(context: HandlerContext, mediaPublicBaseUrl: string): Handler<ApplyProcessedMediaCommand, AppliedMediaCounts> {
  return async (command) => {
    const db = context.database.client;
    if (command.outcome === "failed") {
      const postMedia = await db.postMedia.updateMany({ where: { mediaId: command.mediaId }, data: { status: "failed" } });
      const messages = await db.message.updateMany({ where: { mediaId: command.mediaId }, data: { mediaStatus: "failed" } });
      return { postMedia: postMedia.count, messages: messages.count };
    }
    const primary = choosePrimaryVariant(command.kind, command.variants);
    const url = publicMediaUrl(mediaPublicBaseUrl, primary?.key);
    const posterUrl = publicMediaUrl(mediaPublicBaseUrl, command.posterKey);
    const hlsUrl = publicMediaUrl(mediaPublicBaseUrl, command.hlsKey);
    return db.$transaction(async (transaction) => {
      const postMedia = await transaction.postMedia.updateMany({
        where: { mediaId: command.mediaId },
        data: {
          status: "ready",
          ...(url === null ? {} : { url }),
          ...(posterUrl === null ? {} : { posterUrl }),
          ...(hlsUrl === null ? {} : { hlsUrl }),
          ...(command.width === undefined ? {} : { width: command.width }),
          ...(command.height === undefined ? {} : { height: command.height }),
          ...(command.durationSeconds === undefined ? {} : { durationSeconds: Math.round(command.durationSeconds) }),
        },
      });
      const messages = await transaction.message.updateMany({
        where: { mediaId: command.mediaId, mediaPurgedAt: null },
        data: { mediaStatus: "ready", ...(url === null ? {} : { mediaUrl: url }), ...(command.durationSeconds === undefined ? {} : { mediaDurationSeconds: Math.round(command.durationSeconds) }) },
      });
      if (postMedia.count > 0) {
        const posts = await transaction.postMedia.findMany({ where: { mediaId: command.mediaId }, select: { postId: true } });
        await appendDomainEventsToOutbox(transaction, [...new Set(posts.map((row) => row.postId))].map((postId) => ({
          eventType: socialEventTypes.postUpdated, subject: postId, occurredAt: command.occurredAt, data: { postId, mediaId: command.mediaId, mediaStatus: "ready" },
        })));
      }
      return { postMedia: postMedia.count, messages: messages.count };
    });
  };
}
