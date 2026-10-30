import { publishedPostToViewers } from "../../../constants/moderation.constant.js";
import type { Prisma } from "../../../generated/prisma/client.js";
import type { Db } from "../../../types/database.type.js";
import { postWithMedia, type PostRow } from "../../posts/repositories/post.repository.js";

export const quoteCandidateLimit = 300;

const quotesOf = (postId: string) => ({ resharedFromId: postId, isQuote: true, kind: "post" as const, ...publishedPostToViewers });

export const conversationQuotesRepository = {
  rankingCandidates: (db: Db, postId: string): Promise<PostRow[]> =>
    db.post.findMany({ where: quotesOf(postId), orderBy: [{ likeCount: "desc" }, { commentCount: "desc" }, { id: "desc" }], take: quoteCandidateLimit, include: postWithMedia }),

  quotesByIds: (db: Db, postId: string, ids: readonly string[]): Promise<PostRow[]> =>
    ids.length === 0 ? Promise.resolve([]) : db.post.findMany({ where: { id: { in: [...ids] }, ...quotesOf(postId) }, include: postWithMedia }),

  pageNewest: (db: Db, postId: string, afterId: string | undefined, limit: number, extraWhere: Prisma.PostWhereInput): Promise<PostRow[]> =>
    db.post.findMany({ where: { ...quotesOf(postId), ...extraWhere, ...(afterId === undefined ? {} : { id: { lt: afterId } }) }, orderBy: { id: "desc" }, take: limit + 1, include: postWithMedia }),
};
