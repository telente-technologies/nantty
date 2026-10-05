import { notFound, SocialError } from "../../../../errors/social.error.js";
import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import type { TaggedUserView } from "../../models/post.model.js";
import { postTagRepository } from "../../repositories/postTag.repository.js";
import { loadPostVisibleToViewer } from "../../services/postAccess.service.js";
import { loadTaggedUserViews } from "../../services/postTagView.service.js";
import type { ListPostTaggedUsersQuery } from "./listPostTaggedUsers.query.js";

export function createListPostTaggedUsersHandler(context: HandlerContext): Handler<ListPostTaggedUsersQuery, Page<TaggedUserView>> {
  return async ({ viewerId, postId, cursor, limit }) => {
    const post = await loadPostVisibleToViewer(context, viewerId, postId).catch((error: unknown) => {
      if (error instanceof SocialError && error.status === 403) throw notFound("POST_NOT_FOUND", "Post not found.");
      throw error;
    });
    if (post.visibility === "subscribers" && viewerId !== post.authorId && (viewerId === undefined || !(await context.premium.hasSubscribedToCreator(viewerId, post.authorId)))) {
      throw notFound("POST_NOT_FOUND", "Post not found.");
    }
    const rows = await postTagRepository.page(context.database.client, postId, limit, cursor);
    const pageRows = rows.slice(0, limit);
    const views = await loadTaggedUserViews(context, viewerId, pageRows.map((row) => row.taggedUserId));
    const last = pageRows.at(-1);
    return {
      data: pageRows.flatMap((row) => views.get(row.taggedUserId) ?? []),
      nextCursor: rows.length > limit && last !== undefined ? last.taggedUserId : null,
    };
  };
}
