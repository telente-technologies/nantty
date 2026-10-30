import { notFound } from "../../../../errors/social.error.js";
import { publishedPostToViewers } from "../../../../constants/moderation.constant.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { PostSearchSource } from "../../models/internalSources.model.js";
import { extractHashtags } from "../../services/hashtags.service.js";
import type { GetPostSearchSourceQuery } from "./getPostSearchSource.query.js";

export function createGetPostSearchSourceHandler(context: HandlerContext): Handler<GetPostSearchSourceQuery, PostSearchSource> {
  return async ({ postId }) => {
    const db = context.database.client;
    const row = await db.post.findFirst({ where: { id: postId, ...publishedPostToViewers }, include: { media: { orderBy: { position: "asc" }, take: 1 } } });
    if (row === null) throw notFound("POST_NOT_FOUND", "Post not found.");
    const sound = row.soundId === null ? null : await db.sound.findUnique({ where: { id: row.soundId }, select: { title: true } });
    const firstMedia = row.media[0];
    return {
      postId: row.id,
      authorId: row.authorId,
      kind: row.kind,
      caption: row.text,
      hashtags: extractHashtags(row.text),
      audience: row.audience,
      visibility: row.visibility,
      thumbnailUrl: firstMedia === undefined ? null : (firstMedia.posterUrl ?? firstMedia.url),
      soundTitle: sound?.title ?? null,
      likeCount: row.likeCount,
      viewCount: row.viewCount,
      saveCount: row.saveCount,
      removed: row.deletedAt !== null || row.moderationVisibility === "hidden" || row.moderationVisibility === "removed",
      sensitiveLabels: row.sensitiveLabels,
      createdAt: row.createdAt.toISOString(),
    };
  };
}
