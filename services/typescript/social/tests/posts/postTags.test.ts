import { describe, expect, it } from "vitest";

import { createListTagCandidatesHandler } from "../../src/modules/posts/queries/listTagCandidates/listTagCandidates.handler.js";
import { createListPostTaggedUsersHandler } from "../../src/modules/posts/queries/listPostTaggedUsers/listPostTaggedUsers.handler.js";
import { dedupeTaggedUserIds, selectTaggableUserIds } from "../../src/modules/posts/services/postTagEligibility.service.js";
import { syncPostTags } from "../../src/modules/posts/services/postTagWrite.service.js";
import { buildPostViews } from "../../src/modules/posts/services/postView.service.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";
import { authorId, buildFakeContext, buildPostRow, viewerId } from "./socialPostFakes.fake.js";

const ids = Array.from({ length: 6 }, (_, index) => `0192f0a0-0000-7000-8000-00000000c00${index}`);
const [active, blockedByAuthor, blocksAuthor, taggingOff, suspended, deleted] = ids as [string, string, string, string, string, string];

function contextWith(overrides: Record<string, unknown>, post = buildPostRow({})): HandlerContext {
  const base = buildFakeContext([post]);
  const client = new Proxy(base.database.client as unknown as Record<string, unknown>, {
    get: (target, key: string) => overrides[key] ?? target[key],
  });
  const summaries = new Map(ids.map((id, index) => [id, { id, name: `User ${index}`, username: `user${index}`, avatarUrl: null, verified: index === 0, isCreator: false }]));
  return {
    ...base,
    database: { client, transaction: async (work: (db: unknown) => Promise<unknown>) => work(client) },
    directory: {
      findPrivateAccountIds: async () => new Set(),
      findCheckmarkColors: async () => new Map([[active, "gold"]]),
      searchUserSummaries: async () => [...summaries.values()],
      findUserSummaries: async (wanted: string[]) => new Map(wanted.flatMap((id) => (summaries.has(id) ? [[id, summaries.get(id)]] : []))),
      findMentionTargetStatuses: async (wanted: string[]) => new Map(wanted.map((id) => [id, { username: "x", status: id === suspended ? "suspended" : id === deleted ? "deleted" : "active" }])),
    },
  } as unknown as HandlerContext;
}

describe("tag eligibility", () => {
  it("dedupes and rejects more than 20 tags", () => {
    expect(dedupeTaggedUserIds([active, active])).toEqual([active]);
    expect(() => dedupeTaggedUserIds(Array.from({ length: 21 }, (_, index) => `u${index}`))).toThrow(/up to 20/);
  });

  it("silently drops self, blocked either way, tagging-off, suspended and deleted users", async () => {
    const context = contextWith({
      block: {
        findMany: async ({ where }: { where: { blockerId?: string } }) => (where.blockerId === authorId ? [{ blockedId: blockedByAuthor }] : [{ blockerId: blocksAuthor }]),
      },
      taggingSetting: { findMany: async () => [{ accountId: taggingOff }] },
    });
    expect(await selectTaggableUserIds(context, authorId, [active, authorId, blockedByAuthor, blocksAuthor, taggingOff, suspended, deleted])).toEqual([active]);
  });
});

describe("tag writes", () => {
  it("adds new tags, removes dropped ones and emits post.tagged once per new tag", async () => {
    const created: unknown[] = [];
    const removed: unknown[] = [];
    const events: { payload: { type: string; data: { recipientUserId: string } } }[] = [];
    const db = {
      postTag: {
        findMany: async () => [{ taggedUserId: blockedByAuthor }],
        createMany: async ({ data }: { data: unknown[] }) => created.push(...data),
        deleteMany: async ({ where }: { where: unknown }) => removed.push(where),
      },
      postNotificationMute: { findMany: async () => [] },
      outboxEvent: { createMany: async ({ data }: { data: typeof events }) => events.push(...data) },
    };
    await syncPostTags(db as never, { postId: "p1", kind: "clip", authorId, actor: { id: authorId, name: "Ada" }, desiredUserIds: [active, taggingOff], now: new Date() });
    expect(created).toHaveLength(2);
    expect(removed).toEqual([{ postId: "p1", taggedUserId: { in: [blockedByAuthor] } }]);
    expect(events.map((event) => event.payload.type)).toEqual(["post.tagged", "post.tagged"]);
    expect(events[0]?.payload.data.recipientUserId).toBe(active);
  });
});

describe("tag reads", () => {
  it("shows the first 3 tagged users with a count and batches the lookup", async () => {
    let tagQueries = 0;
    const row = buildPostRow({});
    const context = contextWith({
      postTag: { findMany: async () => { tagQueries += 1; return [active, blockedByAuthor, blocksAuthor, taggingOff].map((taggedUserId) => ({ postId: row.id, taggedUserId })); } },
      block: { findMany: async () => [] },
    });
    const [view] = await buildPostViews(context, viewerId, [row, buildPostRow({ id: "0192f0a0-0000-7000-8000-000000000002" })]);
    expect(tagQueries).toBe(1);
    expect(view?.taggedUsersCount).toBe(4);
    expect(view?.taggedUsers).toHaveLength(3);
    expect(view?.taggedUsers[0]).toMatchObject({ id: active, username: "user0", displayName: "User 0", checkmark: "gold" });
  });

  it("hides the tagged list of a subscriber-only post from non-subscribers", async () => {
    const row = buildPostRow({ visibility: "subscribers" });
    const context = contextWith({ postTag: { findMany: async () => [{ postId: row.id, taggedUserId: active, createdAt: new Date() }] } }, row);
    const handler = createListPostTaggedUsersHandler({ ...context, premium: { hasSubscribedToCreator: async () => false } } as unknown as HandlerContext);
    await expect(handler({ viewerId: undefined, postId: row.id, cursor: undefined, limit: 20 })).rejects.toMatchObject({ status: 404 });
  });
});

describe("tag candidates", () => {
  const overrides = {
    block: { findMany: async ({ where }: { where: { blockerId?: string } }) => (where.blockerId === authorId ? [{ blockedId: blockedByAuthor }] : [{ blockerId: blocksAuthor }]) },
    taggingSetting: { findMany: async () => [{ accountId: taggingOff }] },
  };

  it("keeps opted-out users visible but unselectable while preserving block and status filtering", async () => {
    const handler = createListTagCandidatesHandler(contextWith(overrides));
    const result = await handler({ viewerId: authorId, term: "user", cursor: undefined, limit: 20 });

    expect(result.data.map(({ user }) => user.id)).toEqual([active, taggingOff]);
    expect(result.data[0]).toMatchObject({ user: { id: active }, canTag: true, unavailableReason: null });
    expect(result.data[1]).toMatchObject({ user: { id: taggingOff }, canTag: false, unavailableReason: "Doesn't allow tags" });
    expect(Object.keys(result.data[1] ?? {}).sort()).toEqual(["canTag", "unavailableReason", "user"]);
    expect(result.data.some(({ user }) => [blockedByAuthor, blocksAuthor, suspended, deleted].includes(user.id))).toBe(false);
    expect(result.nextCursor).toBeNull();
    expect(result.candidates).toEqual(result.data);
  });

  it("pages through visible eligible and opted-out candidates", async () => {
    const handler = createListTagCandidatesHandler(contextWith({ block: { findMany: async () => [] }, taggingSetting: { findMany: async () => [{ accountId: taggingOff }] } }));
    const first = await handler({ viewerId: authorId, term: "user", cursor: undefined, limit: 1 });
    expect(first.data).toHaveLength(1);
    expect(first.candidates).toEqual(first.data);
    expect(first.nextCursor).not.toBeNull();
    const second = await handler({ viewerId: authorId, term: "user", cursor: first.nextCursor ?? undefined, limit: 1 });
    expect(second.data[0]?.user.id).not.toBe(first.data[0]?.user.id);
  });

  it("returns nothing for an empty term", async () => {
    expect((await createListTagCandidatesHandler(contextWith(overrides))({ viewerId: authorId, term: "  ", cursor: undefined, limit: 20 })).data).toEqual([]);
  });
});
