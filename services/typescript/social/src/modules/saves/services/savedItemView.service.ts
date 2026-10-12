import type { HandlerContext } from "../../../types/handlerContext.type.js";
import { filterAuthorsVisibleToViewer } from "../../follows/services/profileAccess.service.js";
import type { CommentView } from "../../comments/models/comment.model.js";
import type { PostView } from "../../posts/models/post.model.js";
import { commentRepository } from "../../comments/repositories/comment.repository.js";
import { buildCommentViews } from "../../comments/services/commentView.service.js";
import { postRepository } from "../../posts/repositories/post.repository.js";
import { buildPostViews } from "../../posts/services/postView.service.js";
import type { SavedItemView } from "../models/saved.model.js";

interface SavedRow {
  readonly id: string;
  readonly type: "post" | "video" | "clip" | "product" | "comment";
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

type SavedItemBase = Pick<SavedItemView, "id" | "type" | "targetId" | "savedAt" | "collectionId">;

export function buildSavedCommentItem(base: SavedItemBase, comment: CommentView): SavedItemView {
  const excerpt = comment.text.slice(0, 80);
  return {
    ...base,
    postId: comment.postId,
    preview: {
      title: excerpt === "" ? null : excerpt,
      thumbnailUrl: comment.author.avatarUrl,
      href: `/post/${comment.postId}/comment/${comment.id}`,
      author: comment.author.username === "" ? null : comment.author.username,
      price: null,
      durationSeconds: null,
    },
    comment,
  };
}

export async function buildSavedItemViews(context: HandlerContext, viewerId: string, rows: readonly SavedRow[]): Promise<SavedItemView[]> {
  const postRows = rows.filter((row) => row.type !== "product" && uuidPattern.test(row.targetId));
  const posts = await postRepository.findManyByIds(context.database.client, postRows.map((row) => row.targetId));
  const visibleAuthors = await filterAuthorsVisibleToViewer(context, viewerId, posts.map((post) => post.authorId));
  const visiblePosts = posts.filter((post) => visibleAuthors.has(post.authorId));
  const views = new Map((await buildPostViews(context, viewerId, visiblePosts)).map((view) => [view.id, view]));
  const commentIds = rows.filter((row) => row.type === "comment").map((row) => row.targetId);
  const commentRows = commentIds.length === 0 ? [] : await commentRepository.findManyByIds(context.database.client, commentIds, viewerId);
  const commentViews = new Map((await buildCommentViews(context, viewerId, commentRows)).map((view) => [view.id, view]));
  const productIds = rows.filter((row) => row.type === "product").map((row) => row.targetId);
  const products = productIds.length === 0 || context.products === undefined ? new Map() : await context.products.findProducts(productIds).catch(() => new Map());
  return rows.flatMap((row): SavedItemView[] => {
    const base = { id: row.id, type: row.type, targetId: row.targetId, savedAt: row.createdAt.toISOString(), collectionId: row.collectionId };
    if (row.type === "product") {
      const product = products.get(row.targetId);
      const preview = { title: product?.name ?? null, thumbnailUrl: product?.imageUrl ?? null, href: `/product/${row.targetId}`, author: null, price: product?.price ?? null, durationSeconds: null };
      return [{ ...base, preview, ...(product === undefined ? {} : { product: { id: product.id, name: product.name, price: product.price, imageUrl: product.imageUrl, stock: product.stock } }) }];
    }
    const view = views.get(row.targetId);
    if (row.type === "comment") {
      const comment = commentViews.get(row.targetId);
      return comment === undefined ? [] : [buildSavedCommentItem(base, comment)];
    }
    if (view === undefined) return [];
    return [{ ...base, preview: previewForPost(view), ...(row.type === "clip" ? { clip: view } : { post: view }) }];
  });
}
