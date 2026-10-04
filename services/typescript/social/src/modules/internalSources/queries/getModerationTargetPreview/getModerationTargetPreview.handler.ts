import { notFound } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { ModerationTargetPreview } from "../../models/internalSources.model.js";
import type { GetModerationTargetPreviewQuery } from "./getModerationTargetPreview.query.js";

const missing = () => notFound("TARGET_NOT_FOUND", "Target not found.");

export function createGetModerationTargetPreviewHandler(context: HandlerContext): Handler<GetModerationTargetPreviewQuery, ModerationTargetPreview> {
  return async ({ targetType, targetId }) => {
    const db = context.database.client;
    if (targetType === "comment") {
      const comment = await db.comment.findUnique({ where: { id: targetId } });
      if (comment === null) throw missing();
      return { ownerId: comment.authorId, title: null, text: comment.text, mediaUrls: [], soundTitle: null, createdAt: comment.createdAt.toISOString() };
    }
    if (targetType === "sound") {
      const sound = await db.sound.findUnique({ where: { id: targetId } });
      if (sound === null) throw missing();
      return { ownerId: sound.ownerId, title: sound.title, text: null, mediaUrls: [sound.audioUrl, sound.coverUrl].flatMap((url) => (url === null ? [] : [url])), soundTitle: sound.title, createdAt: sound.createdAt.toISOString() };
    }
    const post = await db.post.findUnique({ where: { id: targetId }, include: { media: { orderBy: { position: "asc" } } } });
    if (post === null) throw missing();
    const sound = post.soundId === null ? null : await db.sound.findUnique({ where: { id: post.soundId }, select: { title: true } });
    return {
      ownerId: post.authorId,
      title: null,
      text: post.text,
      mediaUrls: post.media.flatMap((media) => [media.url, media.posterUrl].flatMap((url) => (url === null ? [] : [url]))),
      soundTitle: sound?.title ?? null,
      createdAt: post.createdAt.toISOString(),
    };
  };
}
