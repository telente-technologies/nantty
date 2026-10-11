import { describe, expect, it, vi } from "vitest";

import type { FeedRanker, RankingCandidate } from "../../src/interfaces/feedRanker.interface.js";
import type { PostRow } from "../../src/modules/posts/repositories/post.repository.js";
import { createListClipsHandler } from "../../src/modules/feeds/queries/listClips/listClips.handler.js";
import { decodeSnapshotCursor, encodeSnapshotCursor } from "../../src/modules/feeds/services/clipsForYou.service.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";
import { buildPostRow } from "../posts/socialPostFakes.fake.js";

vi.mock("../../src/modules/posts/services/postView.service.js", () => ({
  buildPostViews: async (_context: unknown, _viewerId: unknown, rows: readonly PostRow[]) => rows.map((row) => ({ id: row.id, authorId: row.authorId })),
}));
vi.mock("../../src/modules/posts/services/sensitiveContent.service.js", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolveCurrentViewerContentPolicy: async (_context: unknown, viewerId: string | undefined) => ({ viewerId, ageBracket: "adult", withheldLabels: [], showSensitiveWithoutWarning: false }),
}));

const viewer = "0192f0a0-0000-7000-8000-0000000000aa";
const id = (index: number) => `0192f0a0-0000-7000-8000-${index.toString().padStart(12, "0")}`;
const clip = (index: number, authorId: string, overrides: Partial<PostRow> = {}) =>
  buildPostRow({ id: id(index), authorId, kind: "clip", createdAt: new Date(Date.UTC(2026, 9, 4, 0, index)), media: [{ type: "video", durationSeconds: 15 }] as PostRow["media"], ...overrides });

interface FakeState {
  posts: PostRow[];
  follows: { followerId: string; followeeId: string; state: string }[];
  blocks: { blockerId: string; blockedId: string }[];
  snapshots: Map<string, Record<string, unknown>>;
  watchTotals: Record<string, { videoViews: number; completedViews: number }>;
}

function buildContext(state: FakeState, clipRanker: FeedRanker, consent = true): HandlerContext {
  let snapshotCounter = 0;
  const emptyTable = { findMany: async () => [], findUnique: async () => null, findFirst: async () => null, count: async () => 0, groupBy: async () => [], deleteMany: async () => ({ count: 0 }) };
  const visible = (post: PostRow) => post.deletedAt === null && post.moderationVisibility === "visible";
  const client = new Proxy({
    post: {
      findMany: async ({ where }: { where: { id?: { in: string[] } | { lt: string }; authorId?: { in: string[] }; kind?: { in: string[] } } }) => {
        let rows = state.posts.filter((post) => visible(post) && (where.kind?.in.includes(post.kind) ?? true));
        if (where.authorId !== undefined) rows = rows.filter((post) => where.authorId?.in.includes(post.authorId));
        if (where.id !== undefined && "in" in where.id) rows = rows.filter((post) => (where.id as { in: string[] }).in.includes(post.id));
        if (where.id !== undefined && "lt" in where.id) rows = rows.filter((post) => post.id < (where.id as { lt: string }).lt);
        return where.authorId !== undefined ? rows.sort((left, right) => right.id.localeCompare(left.id)) : rows;
      },
    },
    follow: { findMany: async ({ where }: { where: { followerId: string; followeeId?: { in: string[] } } }) => state.follows.filter((follow) => follow.followerId === where.followerId && follow.state === "accepted" && (where.followeeId?.in.includes(follow.followeeId) ?? true)) },
    block: { findMany: async () => state.blocks },
    postDailyStat: { groupBy: async () => Object.entries(state.watchTotals).map(([postId, totals]) => ({ postId, _sum: totals })) },
    feedRankSnapshot: {
      deleteMany: async () => ({ count: 0 }),
      create: async ({ data }: { data: Record<string, unknown> }) => {
        snapshotCounter += 1;
        const row = { ...data, id: `0192f0a0-0000-7000-9000-${snapshotCounter.toString().padStart(12, "0")}` };
        state.snapshots.set(row.id, row);
        return row;
      },
      findUnique: async ({ where }: { where: { id: string } }) => state.snapshots.get(where.id) ?? null,
    },
  } as Record<string, unknown>, { get: (target, key: string) => target[key] ?? emptyTable });
  return {
    database: { client, transaction: async (work: (db: unknown) => Promise<unknown>) => work(client) },
    directory: { findUserSummaries: async () => new Map(), findPrivateAccountIds: async () => new Set(), hasPersonalizationConsent: async () => consent },
    clock: { now: () => new Date("2026-10-04T12:00:00Z") },
    premium: { isPremium: async () => false },
    ranker: { rank: async () => { throw new Error("posts ranker must not rank clips"); } },
    clipRanker,
  } as unknown as HandlerContext;
}

const reverseRanker = (calls: { candidates: readonly RankingCandidate[]; personalized: boolean }[] = []): FeedRanker => ({
  rank: async (candidates, context) => {
    calls.push({ candidates, personalized: context.personalized });
    return [...candidates].sort((left, right) => right.postId.localeCompare(left.postId)).map((candidate) => ({ ...candidate, explanations: [{ code: "popular", label: "Popular right now" }], boostMultiplier: 1 }));
  },
});

describe("clips For You tab", () => {
  it("ranks clips with the clip ranker and forwards watch totals", async () => {
    const calls: { candidates: readonly RankingCandidate[]; personalized: boolean }[] = [];
    const state: FakeState = { posts: [clip(1, "a1"), clip(2, "a2")], follows: [], blocks: [], snapshots: new Map(), watchTotals: { [id(1)]: { videoViews: 40, completedViews: 30 } } };
    const page = await createListClipsHandler(buildContext(state, reverseRanker(calls)))({ viewerId: viewer, tab: "forYou", cursor: undefined, limit: 10 });
    expect(page.data.map((view) => view.id)).toEqual([id(2), id(1)]);
    expect(page.data[0]?.ranking?.explanations[0]?.code).toBe("popular");
    expect(calls[0]?.personalized).toBe(true);
    expect(calls[0]?.candidates.find((candidate) => candidate.postId === id(1))).toMatchObject({ videoViews: 40, completedViews: 30, durationMs: 15_000 });
    expect(page.nextCursor).toBeNull();
  });

  it("ranks non-consented viewers without personalization", async () => {
    const calls: { candidates: readonly RankingCandidate[]; personalized: boolean }[] = [];
    const state: FakeState = { posts: [clip(1, "a1")], follows: [], blocks: [], snapshots: new Map(), watchTotals: {} };
    await createListClipsHandler(buildContext(state, reverseRanker(calls), false))({ viewerId: viewer, tab: "forYou", cursor: undefined, limit: 10 });
    expect(calls[0]?.personalized).toBe(false);
  });

  it("pages from a snapshot so re-ranking and new clips never duplicate or skip items", async () => {
    const state: FakeState = { posts: Array.from({ length: 7 }, (_, index) => clip(index + 1, `a${index % 3}`)), follows: [], blocks: [], snapshots: new Map(), watchTotals: {} };
    let ranker = reverseRanker();
    const context = buildContext(state, { rank: (candidates, rankingContext) => ranker.rank(candidates, rankingContext) });
    const listClips = createListClipsHandler(context);
    const first = await listClips({ viewerId: viewer, tab: "forYou", cursor: undefined, limit: 3 });
    ranker = { rank: async (candidates) => [...candidates].reverse() };
    state.posts.push(clip(99, "late"));
    state.posts[0] = { ...(state.posts[0] as PostRow), deletedAt: new Date() };
    const second = await listClips({ viewerId: viewer, tab: "forYou", cursor: first.nextCursor ?? undefined, limit: 3 });
    const third = await listClips({ viewerId: viewer, tab: "forYou", cursor: second.nextCursor ?? undefined, limit: 3 });
    const served = [...first.data, ...second.data, ...third.data].map((view) => view.id);
    expect(served).toEqual([id(7), id(6), id(5), id(4), id(3), id(2)]);
    expect(new Set(served).size).toBe(served.length);
    expect(third.nextCursor).toBeNull();
    expect(second.data[0]?.ranking?.explanations[0]?.label).toBe("Popular right now");
  });

  it("rejects a cursor that belongs to another viewer or is malformed", async () => {
    const state: FakeState = { posts: [clip(1, "a1"), clip(2, "a2")], follows: [], blocks: [], snapshots: new Map(), watchTotals: {} };
    const listClips = createListClipsHandler(buildContext(state, reverseRanker()));
    const first = await listClips({ viewerId: viewer, tab: "forYou", cursor: undefined, limit: 1 });
    await expect(listClips({ viewerId: id(500), tab: "forYou", cursor: first.nextCursor ?? undefined, limit: 1 })).rejects.toMatchObject({ code: "CURSOR_EXPIRED" });
    await expect(listClips({ viewerId: viewer, tab: "forYou", cursor: "not-a-cursor", limit: 1 })).rejects.toMatchObject({ code: "CURSOR_EXPIRED" });
    expect(decodeSnapshotCursor(encodeSnapshotCursor({ snapshotId: id(1), offset: 4 }))).toEqual({ snapshotId: id(1), offset: 4 });
    expect(decodeSnapshotCursor(Buffer.from(JSON.stringify({ s: "x", o: -1 })).toString("base64url"))).toBeNull();
  });
});

describe("clips Following tab", () => {
  it("lists only accepted follows newest first, skipping own, blocked and requested accounts", async () => {
    const state: FakeState = {
      posts: [clip(1, "followed"), clip(2, viewer), clip(3, "blocked"), clip(4, "requested"), clip(5, "followed"), clip(6, "stranger"), clip(7, "followed", { kind: "post" })],
      follows: [
        { followerId: viewer, followeeId: "followed", state: "accepted" },
        { followerId: viewer, followeeId: "blocked", state: "accepted" },
        { followerId: viewer, followeeId: "requested", state: "requested" },
      ],
      blocks: [{ blockerId: viewer, blockedId: "blocked" }],
      snapshots: new Map(),
      watchTotals: {},
    };
    const listClips = createListClipsHandler(buildContext(state, reverseRanker()));
    const first = await listClips({ viewerId: viewer, tab: "following", cursor: undefined, limit: 1 });
    expect(first.data.map((view) => view.id)).toEqual([id(5)]);
    const second = await listClips({ viewerId: viewer, tab: "following", cursor: first.nextCursor ?? undefined, limit: 1 });
    expect(second.data.map((view) => view.id)).toEqual([id(1)]);
    expect(second.nextCursor).toBeNull();
  });

  it("returns an empty page when the viewer follows nobody", async () => {
    const state: FakeState = { posts: [clip(1, viewer), clip(2, "stranger")], follows: [], blocks: [], snapshots: new Map(), watchTotals: {} };
    const page = await createListClipsHandler(buildContext(state, reverseRanker()))({ viewerId: viewer, tab: "following", cursor: undefined, limit: 10 });
    expect(page).toEqual({ data: [], nextCursor: null });
  });
});
