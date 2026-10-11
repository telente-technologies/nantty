import { forbidden, notFound } from "../../../../errors/social.error.js";
import { socialEventTypes } from "../../../../events/eventTypes.event.js";
import { appendDomainEventsToOutbox } from "../../../../events/outbox.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { PostRow } from "../../repositories/post.repository.js";
import { postRepository } from "../../repositories/post.repository.js";
import type { DeletePostCommand } from "./deletePost.command.js";

const savedTypesForPost = ["post", "video", "clip"] as const;

async function actorOwnsPost(context: HandlerContext, actorId: string, post: PostRow): Promise<boolean> {
  if (post.authorId === actorId) return true;
  if (post.authorProfileId === null) return false;
  return (await context.directory.findOwnedPostableProfile(actorId, post.authorProfileId)) !== null;
}

async function cleanUpMedia(context: HandlerContext, post: PostRow): Promise<void> {
  const mediaIds = post.media.map((media) => media.mediaId);
  if (mediaIds.length === 0 || context.postMedia === undefined) return;
  await context.postMedia.deleteMedia(mediaIds, `post deleted by author (${post.kind})`).catch(() => undefined);
}

export function createDeletePostHandler(context: HandlerContext): Handler<DeletePostCommand, void> {
  return async ({ actorId, postId }) => {
    const post = await postRepository.findByIdIncludingHidden(context.database.client, postId);
    if (post === null) throw notFound("POST_NOT_FOUND", "Post not found.");
    if (!(await actorOwnsPost(context, actorId, post))) throw forbidden("NOT_POST_OWNER", "Only the author can delete this post.");
    if (post.deletedAt !== null) {
      await cleanUpMedia(context, post);
      return;
    }
    const now = context.clock.now();
    const wasPinned = post.isPinned;
    const deleted = await context.database.transaction(async (transaction) => {
      const claimed = await transaction.post.updateMany({ where: { id: postId, deletedAt: null }, data: { deletedAt: now, isPinned: false, pinnedAt: null } });
      if (claimed.count === 0) return false;
      if (post.resharedFromId !== null) {
        await postRepository.decrementCounterIfPositive(transaction, post.resharedFromId, "repostCount");
        if (post.isQuote) await postRepository.decrementCounterIfPositive(transaction, post.resharedFromId, "quoteCount");
      }
      await transaction.savedItem.deleteMany({ where: { targetId: postId, type: { in: [...savedTypesForPost] } } });
      await transaction.saveCounter.deleteMany({ where: { targetId: postId, type: { in: [...savedTypesForPost] } } });
      await appendDomainEventsToOutbox(transaction, [{
        eventType: socialEventTypes.postDeleted, subject: postId, occurredAt: now,
        data: {
          postId, authorId: post.authorId, deletedBy: actorId, authorProfileId: post.authorProfileId, kind: post.kind, reason: "author",
          wasPinned, quotedPostId: post.isQuote ? post.resharedFromId : null, mediaIds: post.media.map((media) => media.mediaId),
        },
      }]);
      return true;
    });
    if (deleted) await cleanUpMedia(context, post);
  };
}
