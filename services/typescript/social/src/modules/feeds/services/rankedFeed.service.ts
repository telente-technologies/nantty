import { popularFeedCandidateWindowDays } from "../../../constants/social.constant.js";
import type { RankingCandidate } from "../../../interfaces/feedRanker.interface.js";
import type { HandlerContext } from "../../../types/handlerContext.type.js";
import type { Page } from "../../../types/pagination.type.js";
import { decodeOffsetCursor, encodeOffsetCursor } from "../../../utils/cursor.util.js";
import { blockRepository } from "../../blocks/repositories/block.repository.js";
import { followRepository } from "../../follows/repositories/follow.repository.js";
import type { PostView } from "../../posts/models/post.model.js";
import type { PostRow } from "../../posts/repositories/post.repository.js";
import { buildPostViews } from "../../posts/services/postView.service.js";
import { feedRepository } from "../repositories/feed.repository.js";

export interface RankedFeedRequest {
  readonly viewerId: string | undefined;
  readonly personalized: boolean;
  readonly kinds: readonly ("post" | "clip")[];
  readonly cursor: string | undefined;
  readonly limit: number;
}

export function toRankingCandidate(row: PostRow, followedAuthors: ReadonlySet<string>): RankingCandidate {
  return {
    postId: row.id, authorId: row.authorId, createdAt: row.createdAt, likeCount: row.likeCount, commentCount: row.commentCount,
    repostCount: row.repostCount, shareCount: row.shareCount, viewCount: row.viewCount, followedAuthor: followedAuthors.has(row.authorId),
  };
}

export async function buildRankedFeedPage(context: HandlerContext, request: RankedFeedRequest): Promise<Page<PostView>> {
  const db = context.database.client;
  const now = context.clock.now();
  const since = new Date(now.getTime() - popularFeedCandidateWindowDays * 86_400_000);
  const rows = await feedRepository.popularCandidates(db, request.kinds, since);
  const [privateAuthors, hiddenAuthors, dismissed, followed] = await Promise.all([
    context.directory.findPrivateAccountIds(rows.map((row) => row.authorId)),
    request.viewerId === undefined ? new Set<string>() : blockRepository.everyoneBlockedByOrBlocking(db, request.viewerId),
    request.viewerId === undefined || !request.personalized ? new Set<string>() : feedRepository.dismissedPostIds(db, request.viewerId),
    request.viewerId === undefined || !request.personalized ? new Set<string>() : followRepository.followedAccountIds(db, request.viewerId, [...new Set(rows.map((row) => row.authorId))]),
  ]);
  const eligible = rows.filter((row) => !privateAuthors.has(row.authorId) && !hiddenAuthors.has(row.authorId) && !dismissed.has(row.id) && row.authorId !== request.viewerId);
  const ranked = await context.ranker.rank(eligible.map((row) => toRankingCandidate(row, followed)), { viewerId: request.viewerId ?? null, personalized: request.personalized, now });
  const offset = decodeOffsetCursor(request.cursor);
  const window = ranked.slice(offset, offset + request.limit);
  const rowById = new Map(eligible.map((row) => [row.id, row]));
  const pageRows = window.flatMap((candidate) => rowById.get(candidate.postId) ?? []);
  const nextOffset = offset + request.limit;
  return { data: await buildPostViews(context, request.viewerId, pageRows), nextCursor: nextOffset < ranked.length ? encodeOffsetCursor(nextOffset) : null };
}
