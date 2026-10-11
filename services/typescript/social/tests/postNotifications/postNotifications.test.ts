import { describe, expect, it } from "vitest";

import { SocialError } from "../../src/errors/social.error.js";
import { followRepository } from "../../src/modules/follows/repositories/follow.repository.js";
import { createSetPostNotificationsHandler } from "../../src/modules/postNotifications/commands/setPostNotifications/setPostNotifications.handler.js";
import { createGetPostNotificationsHandler } from "../../src/modules/postNotifications/queries/getPostNotifications/getPostNotifications.handler.js";
import { createListPostNotificationSubscribersHandler } from "../../src/modules/postNotifications/queries/listPostNotificationSubscribers/listPostNotificationSubscribers.handler.js";
import { assertCanChangePostNotifications, levelsForScope, viewerLevelOf } from "../../src/modules/postNotifications/services/postNotificationRules.service.js";
import type { Db } from "../../src/types/database.type.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

interface FollowRow { id: string; followerId: string; followeeId: string; state: "requested" | "accepted" | "rejected"; postNotifications: "off" | "posts" | "posts_and_lives" }

function fakeDatabase(follows: FollowRow[], blocks: Array<[string, string]> = [], livePosts: Array<{ id: string; authorId: string }> = []) {
  const findManyCalls: unknown[] = [];
  const db = {
    follow: {
      findUnique: async ({ where }: { where: { followerId_followeeId: { followerId: string; followeeId: string } } }) =>
        follows.find((row) => row.followerId === where.followerId_followeeId.followerId && row.followeeId === where.followerId_followeeId.followeeId) ?? null,
      update: async ({ where, data }: { where: { id: string }; data: Partial<FollowRow> }) => Object.assign(follows.find((row) => row.id === where.id)!, data),
      findMany: async (args: { where: { followeeId: string; state: string; postNotifications: { in: string[] }; id?: { gt: string } }; take: number }) => {
        findManyCalls.push(args);
        const matching = follows.filter((row) => row.followeeId === args.where.followeeId && row.state === args.where.state && args.where.postNotifications.in.includes(row.postNotifications)).sort((a, b) => a.id.localeCompare(b.id));
        return matching.filter((row) => args.where.id === undefined || row.id > args.where.id.gt).slice(0, args.take);
      },
      upsert: async (args: { update: Partial<FollowRow> }) => args,
    },
    post: { count: async ({ where }: { where: { id: string; authorId: string } }) => livePosts.filter((post) => post.id === where.id && post.authorId === where.authorId).length },
    block: {
      count: async ({ where }: { where: { OR: Array<{ blockerId: string; blockedId: string }> } }) => blocks.filter(([blocker, blocked]) => where.OR.some((pair) => pair.blockerId === blocker && pair.blockedId === blocked)).length,
      findMany: async ({ where }: { where: { blockerId?: string | { in: string[] }; blockedId?: string | { in: string[] } } }) =>
        blocks.filter(([blocker, blocked]) => (typeof where.blockerId === "string" ? where.blockerId === blocker : where.blockerId!.in.includes(blocker)) && (typeof where.blockedId === "string" ? where.blockedId === blocked : where.blockedId!.in.includes(blocked)))
          .map(([blockerId, blockedId]) => ({ blockerId, blockedId })),
    },
  };
  const context = { database: { client: db as unknown as Db }, directory: { findUserSummaries: async (ids: readonly string[]) => new Map(ids.filter((id) => id !== "ghost").map((id) => [id, { id }])) } } as unknown as HandlerContext;
  return { context, findManyCalls };
}

const codeOf = async (promise: Promise<unknown>) => promise.then(() => "ok", (error: unknown) => (error instanceof SocialError ? `${error.status}:${error.code}` : String(error)));

describe("post notification rules", () => {
  it("only allows an accepted, unblocked follower who is not the author", () => {
    expect(() => assertCanChangePostNotifications({ isSelf: false, blockedEitherWay: false, followState: "accepted" })).not.toThrow();
    expect(() => assertCanChangePostNotifications({ isSelf: true, blockedEitherWay: false, followState: "accepted" })).toThrow(/yourself/);
    expect(() => assertCanChangePostNotifications({ isSelf: false, blockedEitherWay: true, followState: "accepted" })).toThrow(/notifications from this account/);
    expect(() => assertCanChangePostNotifications({ isSelf: false, blockedEitherWay: false, followState: "requested" })).toThrow(/Follow this account/);
    expect(() => assertCanChangePostNotifications({ isSelf: false, blockedEitherWay: false, followState: undefined })).toThrow(/Follow this account/);
  });

  it("maps scopes to stored levels and hides levels unless the follow is accepted", () => {
    expect(levelsForScope("posts")).toEqual(["posts", "posts_and_lives"]);
    expect(levelsForScope("lives")).toEqual(["posts_and_lives"]);
    expect(viewerLevelOf("accepted", "posts")).toBe("posts");
    expect(viewerLevelOf("requested", "posts")).toBe("off");
    expect(viewerLevelOf("blocked", "posts_and_lives")).toBe("off");
  });
});

describe("set and read post notifications", () => {
  it("stores the level for an accepted follower", async () => {
    const follows: FollowRow[] = [{ id: "f1", followerId: "fan", followeeId: "star", state: "accepted", postNotifications: "off" }];
    const { context } = fakeDatabase(follows);
    expect(await createSetPostNotificationsHandler(context)({ followerId: "fan", targetId: "star", level: "posts_and_lives" })).toEqual({ level: "posts_and_lives", following: true });
    expect(follows[0]?.postNotifications).toBe("posts_and_lives");
    expect(await createGetPostNotificationsHandler(context)({ viewerId: "fan", targetId: "star" })).toEqual({ level: "posts_and_lives", following: true });
  });

  it("refuses without an accepted follow (409), on a private account with a pending request, when blocked (403), for yourself and for unknown users", async () => {
    const follows: FollowRow[] = [{ id: "f2", followerId: "fan", followeeId: "private", state: "requested", postNotifications: "off" }, { id: "f3", followerId: "fan", followeeId: "blocker", state: "accepted", postNotifications: "off" }];
    const { context } = fakeDatabase(follows, [["blocker", "fan"]]);
    const set = createSetPostNotificationsHandler(context);
    expect(await codeOf(set({ followerId: "fan", targetId: "stranger", level: "posts" }))).toBe("409:NOT_FOLLOWING");
    expect(await codeOf(set({ followerId: "fan", targetId: "private", level: "posts" }))).toBe("409:NOT_FOLLOWING");
    expect(await codeOf(set({ followerId: "fan", targetId: "blocker", level: "posts" }))).toBe("403:POST_NOTIFICATIONS_NOT_ALLOWED");
    expect(await codeOf(set({ followerId: "fan", targetId: "fan", level: "posts" }))).toBe("422:CANNOT_SUBSCRIBE_TO_SELF");
    expect(await codeOf(set({ followerId: "fan", targetId: "ghost", level: "posts" }))).toBe("404:USER_NOT_FOUND");
    expect(await createGetPostNotificationsHandler(context)({ viewerId: "fan", targetId: "private" })).toEqual({ level: "off", following: false });
    expect(follows.every((row) => row.postNotifications === "off")).toBe(true);
  });

  it("resets the level to off when a follow row is re-created, so a refollow starts at Off", async () => {
    const { context } = fakeDatabase([]);
    const upsert = (await followRepository.upsertState(context.database.client, "fan", "star", "accepted")) as unknown as { update: { postNotifications: string } };
    expect(upsert.update.postNotifications).toBe("off");
  });
});

describe("internal subscriber pages", () => {
  it("pages 10k subscribers in bounded batches, skipping off, pending and blocked followers", async () => {
    const follows: FollowRow[] = Array.from({ length: 10_000 }, (_, index) => ({ id: `f${String(index).padStart(5, "0")}`, followerId: `u${index}`, followeeId: "star", state: "accepted" as const, postNotifications: index % 2 === 0 ? "posts" as const : "posts_and_lives" as const }));
    follows.push({ id: "z1", followerId: "quiet", followeeId: "star", state: "accepted", postNotifications: "off" }, { id: "z2", followerId: "pending", followeeId: "star", state: "requested", postNotifications: "posts" });
    const { context, findManyCalls } = fakeDatabase(follows, [["star", "u1"], ["u2", "star"]]);
    const list = createListPostNotificationSubscribersHandler(context);
    const seen: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ authorId: "star", scope: "posts", cursor, limit: 500 });
      expect(page.data.length).toBeLessThanOrEqual(500);
      seen.push(...page.data.map((entry) => entry.userId));
      cursor = page.nextCursor ?? undefined;
    } while (cursor !== undefined);
    expect(findManyCalls).toHaveLength(20);
    expect(seen).toHaveLength(9_998);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).not.toContain("u1");
    expect(seen).not.toContain("u2");
    expect(seen).not.toContain("quiet");
    expect(seen).not.toContain("pending");
    const lives = await list({ authorId: "star", scope: "lives", cursor: undefined, limit: 500 });
    expect(lives.data.every((entry) => Number(entry.userId.slice(1)) % 2 === 1)).toBe(true);
  });

  it("keeps paging when the follower at the page boundary unfollows mid fan-out", async () => {
    const follows: FollowRow[] = Array.from({ length: 5 }, (_, index) => ({ id: `f${index}`, followerId: `u${index}`, followeeId: "star", state: "accepted" as const, postNotifications: "posts" as const }));
    const { context } = fakeDatabase(follows);
    const list = createListPostNotificationSubscribersHandler(context);
    const first = await list({ authorId: "star", scope: "posts", cursor: undefined, limit: 2 });
    expect(first.nextCursor).toBe("f1");
    follows.splice(1, 1);
    const second = await list({ authorId: "star", scope: "posts", cursor: first.nextCursor!, limit: 2 });
    expect(second.data.map((entry) => entry.userId)).toEqual(["u2", "u3"]);
  });

  it("returns an empty last page once the post being announced is deleted, removed or not the author's", async () => {
    const follows: FollowRow[] = [{ id: "f1", followerId: "u1", followeeId: "star", state: "accepted", postNotifications: "posts" }];
    const { context } = fakeDatabase(follows, [], [{ id: "p-live", authorId: "star" }, { id: "p-other", authorId: "someone" }]);
    const list = createListPostNotificationSubscribersHandler(context);
    expect((await list({ authorId: "star", scope: "posts", cursor: undefined, limit: 10, postId: "p-live" })).data).toEqual([{ userId: "u1" }]);
    expect(await list({ authorId: "star", scope: "posts", cursor: undefined, limit: 10, postId: "p-gone" })).toEqual({ data: [], nextCursor: null });
    expect(await list({ authorId: "star", scope: "posts", cursor: undefined, limit: 10, postId: "p-other" })).toEqual({ data: [], nextCursor: null });
  });
});
