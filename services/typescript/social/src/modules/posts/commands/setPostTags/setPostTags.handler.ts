import { forbidden, notFound } from "../../../../errors/social.error.js";
import { resolveEventActor } from "../../../../events/actor.event.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { PostView } from "../../models/post.model.js";
import { postRepository } from "../../repositories/post.repository.js";
import { postTagRepository } from "../../repositories/postTag.repository.js";
import { dedupeTaggedUserIds, selectTaggableUserIds } from "../../services/postTagEligibility.service.js";
import { syncPostTags } from "../../services/postTagWrite.service.js";
import { buildPostViews } from "../../services/postView.service.js";
import type { SetPostTagsCommand } from "./setPostTags.command.js";

export function createSetPostTagsHandler(context: HandlerContext): Handler<SetPostTagsCommand, PostView> {
  return async ({ actorId, postId, taggedUserIds }) => {
    const db = context.database.client;
    const post = await postRepository.findById(db, postId);
    if (post === null || post.kind === "story") throw notFound("POST_NOT_FOUND", "Post not found.");
    if (post.authorId !== actorId) throw forbidden("NOT_POST_AUTHOR", "Only the author can edit tags.");
    const requested = dedupeTaggedUserIds(taggedUserIds);
    const existing = new Set(await postTagRepository.userIdsFor(db, postId));
    const kept = requested.filter((id) => existing.has(id));
    const added = await selectTaggableUserIds(context, actorId, requested.filter((id) => !existing.has(id)));
    const actor = await resolveEventActor(context.directory, actorId);
    await context.database.transaction((transaction) =>
      syncPostTags(transaction, { postId, kind: post.kind, authorId: actorId, actor, desiredUserIds: [...kept, ...added], now: context.clock.now() }));
    const [view] = await buildPostViews(context, actorId, [post]);
    return view as PostView;
  };
}
