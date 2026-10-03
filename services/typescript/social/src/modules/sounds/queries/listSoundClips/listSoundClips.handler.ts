import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { Page } from "../../../../types/pagination.type.js";
import { buildPageFromOverfetchedRows } from "../../../../utils/cursor.util.js";
import { filterAuthorsVisibleToViewer } from "../../../follows/services/profileAccess.service.js";
import type { PostView } from "../../../posts/models/post.model.js";
import { postWithMedia } from "../../../posts/repositories/post.repository.js";
import { buildPostViews } from "../../../posts/services/postView.service.js";
import type { ListSoundClipsQuery } from "./listSoundClips.query.js";

export function createListSoundClipsHandler(context: HandlerContext): Handler<ListSoundClipsQuery, Page<PostView>> {
  return async ({ viewerId, soundId, cursor, limit }) => {
    const rows = await context.database.client.post.findMany({
      where: { soundId, kind: "clip", deletedAt: null, audience: "everyone" }, orderBy: { id: "desc" }, take: limit + 1, include: postWithMedia,
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    });
    const page = buildPageFromOverfetchedRows(rows, limit);
    const visible = await filterAuthorsVisibleToViewer(context, viewerId, page.data.map((row) => row.authorId));
    return { data: await buildPostViews(context, viewerId, page.data.filter((row) => visible.has(row.authorId))), nextCursor: page.nextCursor };
  };
}
