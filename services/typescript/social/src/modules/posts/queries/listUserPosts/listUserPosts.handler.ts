import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { buildPageFromOverfetchedRows } from "../../../../utils/cursor.util.js";
import { followRepository } from "../../../follows/repositories/follow.repository.js";
import { assertViewerMaySeeConnections } from "../../../follows/services/profileAccess.service.js";
import type { PostView } from "../../models/post.model.js";
import { postRepository } from "../../repositories/post.repository.js";
import { buildPostViews } from "../../services/postView.service.js";
import type { ListUserPostsQuery } from "./listUserPosts.query.js";

export function createListUserPostsHandler(context: HandlerContext): Handler<ListUserPostsQuery, Page<PostView>> {
  return async ({ viewerId, ownerId, cursor, limit, kind }) => {
    await assertViewerMaySeeConnections(context, viewerId, ownerId);
    const db = context.database.client;
    const isFollower = viewerId !== undefined && (viewerId === ownerId || (await followRepository.find(db, viewerId, ownerId))?.state === "accepted");
    const rows = await postRepository.pageByAuthorOrProfile(db, ownerId, kind === undefined ? ["post", "clip"] : [kind], limit, cursor, isFollower ? ["everyone", "followers"] : ["everyone"], context.clock.now());
    const page = buildPageFromOverfetchedRows(rows, limit);
    return { data: await buildPostViews(context, viewerId, page.data), nextCursor: page.nextCursor };
  };
}
