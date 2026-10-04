import type { PostRow } from "../../src/modules/posts/repositories/post.repository.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

export const authorId = "0192f0a0-0000-7000-8000-00000000a001";
export const viewerId = "0192f0a0-0000-7000-8000-00000000b001";

export function buildPostRow(overrides: Partial<PostRow>): PostRow {
  return {
    id: "0192f0a0-0000-7000-8000-000000000001", authorId, kind: "post", text: "Hello", audience: "everyone", visibility: "public", isAiGenerated: false, soundId: null,
    resharedFromId: null, replyToCommentId: null, replyToClipId: null, replyToCommenterId: null, stickerLayout: null, mentions: [], linkPreview: null,
    likeCount: 0, commentCount: 0, repostCount: 0, shareCount: 0, viewCount: 0, profileVisitCount: 0, saveCount: 0, quoteCount: 0, isQuote: false, replyPolicy: "everyone",
    sensitiveLabels: [], authorSensitiveLabels: [], moderationSensitiveLabels: [], advisorySensitiveLabels: [], sensitiveLabelsReviewed: false,
    moderationVisibility: "visible", expiresAt: null, deletedAt: null, createdAt: new Date("2026-10-04T10:00:00Z"), media: [],
    ...overrides,
  } as PostRow;
}

export function buildFakeContext(posts: readonly PostRow[], options: { readonly showSensitiveWithoutWarning?: boolean } = {}): HandlerContext {
  const emptyList = { findMany: async () => [], count: async () => 0, findFirst: async () => null, findUnique: async () => null };
  const client = new Proxy({
    post: {
      findFirst: async ({ where }: { where: { id: string } }) => posts.find((post) => post.id === where.id) ?? null,
      findMany: async ({ where }: { where: { id?: { in: string[] } } }) => posts.filter((post) => where.id?.in.includes(post.id) ?? true),
    },
    contentPreference: { findUnique: async () => (options.showSensitiveWithoutWarning === undefined ? null : { showSensitiveWithoutWarning: options.showSensitiveWithoutWarning }) },
  } as Record<string, unknown>, { get: (target, key: string) => target[key] ?? emptyList });
  return {
    database: { client, transaction: async (work: (db: unknown) => Promise<unknown>) => work(client) },
    directory: { findUserSummaries: async () => new Map(), findPrivateAccountIds: async () => new Set() },
    clock: { now: () => new Date("2026-10-04T12:00:00Z") },
    premium: { isPremium: async () => false, hasSubscribedToCreator: async () => false },
    ranker: { rank: async (candidates: unknown[]) => candidates },
  } as unknown as HandlerContext;
}
