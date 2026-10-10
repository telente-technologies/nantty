import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { UserSummary } from "../../../interfaces/identityDirectory.interface.js";
import { followRepository } from "../../follows/repositories/follow.repository.js";
import { filterAuthorsVisibleToViewer } from "../../follows/services/profileAccess.service.js";
import type { QuotedPostSummary, QuotedPostThumbnail } from "../models/post.model.js";
import { postRepository, type PostRow } from "../repositories/post.repository.js";
import { selectQuotesVisibleToViewer } from "./quoteVisibility.service.js";
import { resolveCurrentViewerContentPolicy, type ViewerContentPolicy } from "./sensitiveContent.service.js";

const quotedTextExcerptLength = 280;

export async function selectPostsViewerMayEmbed(context: HandlerContext, viewerId: string | undefined, rows: readonly PostRow[], policy: Pick<ViewerContentPolicy, "withheldLabels">): Promise<PostRow[]> {
  if (rows.length === 0) return [];
  const now = context.clock.now();
  const live = rows.filter((row) => row.kind !== "story" && (row.expiresAt === null || row.expiresAt > now));
  const authorIds = [...new Set(live.map((row) => row.authorId))];
  const [visibleAuthors, followedAuthors] = await Promise.all([
    filterAuthorsVisibleToViewer(context, viewerId, authorIds),
    viewerId === undefined ? new Set<string>() : followRepository.followedAccountIds(context.database.client, viewerId, authorIds),
  ]);
  return selectQuotesVisibleToViewer(live, { viewerId, visibleAuthors, followedAuthors, withheldLabels: policy.withheldLabels });
}

function thumbnailFor(row: PostRow): QuotedPostThumbnail | null {
  const first = row.media.find((media) => media.status === "ready") ?? row.media[0];
  if (first === undefined) return null;
  const url = first.type === "video" ? first.posterUrl : (first.url ?? first.posterUrl);
  return url === null ? null : { type: first.type, url, blurhash: first.blurhash };
}

function excerpt(text: string): string {
  return text.length <= quotedTextExcerptLength ? text : `${text.slice(0, quotedTextExcerptLength - 1)}…`;
}

export function toQuotedPostSummary(row: PostRow, author: UserSummary): QuotedPostSummary {
  return {
    id: row.id,
    kind: row.kind === "clip" ? "clip" : "post",
    author,
    text: excerpt(row.text),
    thumbnail: thumbnailFor(row),
    mediaCount: row.media.length,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function loadQuotedPostSummaries(context: HandlerContext, viewerId: string | undefined, quotedPostIds: readonly (string | null)[]): Promise<Map<string, QuotedPostSummary>> {
  const ids = [...new Set(quotedPostIds.filter((id): id is string => id !== null))];
  if (ids.length === 0) return new Map();
  const policy = await resolveCurrentViewerContentPolicy(context, viewerId);
  const rows = await postRepository.findManyByIds(context.database.client, ids);
  const embeddable = (await selectPostsViewerMayEmbed(context, viewerId, rows, policy)).filter((row) => row.visibility !== "subscribers" || row.authorId === viewerId);
  const authors = await context.directory.findUserSummaries([...new Set(embeddable.map((row) => row.authorId))]);
  const summaries = new Map<string, QuotedPostSummary>();
  for (const row of embeddable) {
    const author = authors.get(row.authorId);
    if (author !== undefined) summaries.set(row.id, toQuotedPostSummary(row, author));
  }
  return summaries;
}
