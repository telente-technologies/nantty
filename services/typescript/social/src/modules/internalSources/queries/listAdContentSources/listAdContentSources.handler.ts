import type { Handler, HandlerContext } from "../../../../types/handlerContext.type.js";
import type { PostRow } from "../../../posts/repositories/post.repository.js";
import type { AdContentMedia, AdContentSource, CursorPage } from "../../models/internalSources.model.js";
import type { ListAdContentSourcesQuery } from "./listAdContentSources.query.js";

export function ineligibilityReasonFor(row: PostRow): string | null {
  if (row.moderationVisibility !== "visible") return "This post is limited by a moderation decision.";
  if (row.audience !== "everyone" || row.visibility !== "public") return "Only public posts can be promoted.";
  if ((row.sensitiveLabels?.length ?? 0) > 0) return "Posts with a sensitive content warning can't be promoted.";
  if (row.media.some((media) => media.status !== "ready")) return "This post's media is still processing.";
  if (row.media.length === 0 && row.text.trim() === "") return "This post has nothing to show.";
  return null;
}

function toAdMedia(media: PostRow["media"][number]): AdContentMedia[] {
  if (media.url === null) return [];
  return [{ id: media.mediaId, kind: media.type, url: media.url, posterUrl: media.posterUrl, width: media.width ?? 0, height: media.height ?? 0, durationSeconds: media.durationSeconds }];
}

export function toAdContentSource(row: PostRow): AdContentSource {
  const reason = ineligibilityReasonFor(row);
  return {
    id: row.id,
    type: row.kind === "clip" ? "clip" : "post",
    title: row.text.trim().slice(0, 80),
    text: row.text,
    media: row.media.flatMap(toAdMedia),
    createdAt: row.createdAt.toISOString(),
    engagement: { likes: row.likeCount, comments: row.commentCount, views: row.viewCount },
    product: null,
    eligible: reason === null,
    ineligibleReason: reason,
  };
}

export function createListAdContentSourcesHandler(context: HandlerContext): Handler<ListAdContentSourcesQuery, CursorPage<AdContentSource>> {
  return async ({ ownerUserId, type, search, cursor, limit }) => {
    if (type !== undefined && type !== "post" && type !== "clip") return { data: [], nextCursor: null };
    const rows = await context.database.client.post.findMany({
      where: {
        authorId: ownerUserId,
        deletedAt: null,
        kind: type === undefined ? { in: ["post", "clip"] } : type,
        resharedFromId: null,
        ...(search === undefined || search === "" ? {} : { text: { contains: search, mode: "insensitive" as const } }),
      },
      orderBy: { id: "desc" },
      take: limit + 1,
      include: { media: { orderBy: { position: "asc" } } },
      ...(cursor === undefined ? {} : { cursor: { id: cursor }, skip: 1 }),
    });
    const page = rows.slice(0, limit);
    return { data: page.map(toAdContentSource), nextCursor: rows.length > limit ? (page[page.length - 1]?.id ?? null) : null };
  };
}
