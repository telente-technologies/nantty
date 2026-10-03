import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { filterAuthorsVisibleToViewer } from "../../follows/services/profileAccess.service.js";
import type { PostView } from "../../posts/models/post.model.js";
import { postRepository } from "../../posts/repositories/post.repository.js";
import { buildPostViews } from "../../posts/services/postView.service.js";
import type { SavedItemView } from "../models/saved.model.js";

interface SavedRow {
  readonly id: string;
  readonly type: "post" | "video" | "clip" | "product";
  readonly targetId: string;
  readonly createdAt: Date;
  readonly collectionId: string | null;
}

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function previewForPost(view: PostView): SavedItemView["preview"] {
  const firstMedia = view.media[0];
  return {
    title: view.text === "" ? null : view.text.slice(0, 80),
    thumbnailUrl: firstMedia?.posterUrl ?? firstMedia?.url ?? null,
    href: view.kind === "clip" ? `/clips/${view.id}` : `/post/${view.id}`,
    author: view.author.username === "" ? null : view.author.username,
    price: null,
    durationSeconds: firstMedia?.durationSeconds ?? null,
  };
}

export async function buildSavedItemViews(context: HandlerContext, viewerId: string, rows: readonly SavedRow[]): Promise<SavedItemView[]> {
  const postRows = rows.filter((row) => row.type !== "product" && uuidPattern.test(row.targetId));
  const posts = await postRepository.findManyByIds(context.database.client, postRows.map((row) => row.targetId));
  const visibleAuthors = await filterAuthorsVisibleToViewer(context, viewerId, posts.map((post) => post.authorId));
  const visiblePosts = posts.filter((post) => visibleAuthors.has(post.authorId));
  const views = new Map((await buildPostViews(context, viewerId, visiblePosts)).map((view) => [view.id, view]));
  return rows.flatMap((row): SavedItemView[] => {
    const base = { id: row.id, type: row.type, targetId: row.targetId, savedAt: row.createdAt.toISOString(), collectionId: row.collectionId };
    if (row.type === "product") return [{ ...base, preview: { title: null, thumbnailUrl: null, href: `/products/${row.targetId}`, author: null, price: null, durationSeconds: null } }];
    const view = views.get(row.targetId);
    if (view === undefined) return [];
    return [{ ...base, preview: previewForPost(view), ...(row.type === "clip" ? { clip: view } : { post: view }) }];
  });
}
