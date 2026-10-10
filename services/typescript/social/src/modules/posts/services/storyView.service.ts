import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { StoryView } from "../models/post.model.js";
import type { PostClipEdit } from "../models/post.model.js";
import { postRepository, type PostRow } from "../repositories/post.repository.js";
import { buildPostViews, toMediaView } from "./postView.service.js";

export async function buildStoryViews(context: HandlerContext, viewerId: string | undefined, rows: readonly PostRow[]): Promise<StoryView[]> {
  if (rows.length === 0) return [];
  const [views, seen] = await Promise.all([
    buildPostViews(context, viewerId, rows),
    viewerId === undefined ? new Set<string>() : postRepository.viewedStoryIds(context.database.client, viewerId, rows.map((row) => row.id)),
  ]);
  const viewsById = new Map(views.map((view) => [view.id, view]));
  return rows.flatMap((row) => {
    const media = row.media[0];
    const view = viewsById.get(row.id);
    if (media === undefined || view === undefined) return [];
    const clipEdit = row.clipEdit as PostClipEdit | null;
    return [{ id: row.id, author: view.author, media: toMediaView(media, clipEdit), createdAt: row.createdAt.toISOString(), seen: seen.has(row.id) || viewerId === row.authorId, sound: view.sound ?? null, look: clipEdit?.look ?? null }];
  });
}
