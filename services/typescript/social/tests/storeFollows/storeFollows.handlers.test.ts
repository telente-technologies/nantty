import { describe, expect, it } from "vitest";

import { createFollowStoreHandler } from "../../src/modules/storeFollows/commands/followStore/followStore.handler.js";
import { createUnfollowStoreHandler } from "../../src/modules/storeFollows/commands/unfollowStore/unfollowStore.handler.js";
import { createGetStoreFollowStatusHandler } from "../../src/modules/storeFollows/queries/getStoreFollowStatus/getStoreFollowStatus.handler.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

const followerId = "0192f0a0-0000-7000-8000-00000000a001";
const storeId = "0192f0a0-0000-7000-8000-00000000b001";

function setup() {
  const follows = new Map<string, { followerId: string; storeId: string; createdAt: Date }>();
  const outbox: Array<Record<string, unknown>> = [];
  let storeAvailable = true;
  let storeLookupUnavailable = false;
  const pairKey = (userId: string, entityId: string) => `${userId}:${entityId}`;
  const client = {
    storeFollow: {
      findUnique: async ({ where }: { where: { followerId_storeId: { followerId: string; storeId: string } } }) =>
        follows.get(pairKey(where.followerId_storeId.followerId, where.followerId_storeId.storeId)) ?? null,
      createMany: async ({ data, skipDuplicates }: { data: Array<{ followerId: string; storeId: string; createdAt: Date }>; skipDuplicates?: boolean }) => {
        let count = 0;
        for (const row of data) {
          const key = pairKey(row.followerId, row.storeId);
          if (skipDuplicates === true && follows.has(key)) continue;
          follows.set(key, row);
          count += 1;
        }
        return { count };
      },
      deleteMany: async ({ where }: { where: { followerId: string; storeId: string } }) => ({ count: follows.delete(pairKey(where.followerId, where.storeId)) ? 1 : 0 }),
      count: async ({ where }: { where: { storeId: string } }) => [...follows.values()].filter((row) => row.storeId === where.storeId).length,
    },
    outboxEvent: {
      createMany: async ({ data }: { data: Array<Record<string, unknown>> }) => { outbox.push(...data); return { count: data.length }; },
    },
  };
  const context = {
    database: { client, transaction: async <T>(work: (tx: typeof client) => Promise<T>) => work(client) },
    clock: { now: () => new Date("2026-11-04T12:00:00.000Z") },
    shareCards: { resolve: async (_kind: string, requestedStoreId: string) => {
      if (storeLookupUnavailable) return null;
      return requestedStoreId === storeId && storeAvailable ? { availability: "available", title: "Sample Store" } : { availability: "unavailable" };
    } },
  } as unknown as HandlerContext;
  return {
    follow: createFollowStoreHandler(context),
    unfollow: createUnfollowStoreHandler(context),
    status: createGetStoreFollowStatusHandler(context),
    follows,
    outbox,
    setStoreAvailable: (value: boolean) => { storeAvailable = value; },
    setStoreLookupUnavailable: (value: boolean) => { storeLookupUnavailable = value; },
  };
}

describe("store follow handlers", () => {
  it("is idempotent for repeated follow and emits one outbox event", async () => {
    const world = setup();
    const command = { followerId, storeId };

    await expect(world.follow(command)).resolves.toEqual({ storeId, isFollowing: true, followers: 1 });
    await expect(world.follow(command)).resolves.toEqual({ storeId, isFollowing: true, followers: 1 });
    await expect(world.status({ viewerId: followerId, storeId })).resolves.toEqual({ storeId, isFollowing: true, followers: 1 });
    expect(world.follows.size).toBe(1);
    expect(world.outbox).toHaveLength(1);
    expect(world.outbox[0]).toMatchObject({ eventType: "store.followed", subject: storeId });
  });

  it("emits only one follow event when duplicate requests race", async () => {
    const world = setup();
    const command = { followerId, storeId };

    await Promise.all([world.follow(command), world.follow(command)]);

    expect(world.follows.size).toBe(1);
    expect(world.outbox).toHaveLength(1);
  });

  it("unfollows idempotently and emits an event only when a relationship is removed", async () => {
    const world = setup();
    const command = { followerId, storeId };
    await world.follow(command);

    await expect(world.unfollow(command)).resolves.toEqual({ storeId, isFollowing: false, followers: 0 });
    await expect(world.unfollow(command)).resolves.toEqual({ storeId, isFollowing: false, followers: 0 });
    await expect(world.status({ viewerId: followerId, storeId })).resolves.toEqual({ storeId, isFollowing: false, followers: 0 });
    expect(world.follows.size).toBe(0);
    expect(world.outbox.map((event) => event["eventType"])).toEqual(["store.followed", "store.unfollowed"]);
  });

  it("does not let a viewer follow a store unavailable to them", async () => {
    const world = setup();
    world.setStoreAvailable(false);
    await expect(world.follow({ followerId, storeId })).rejects.toMatchObject({ status: 404, code: "STORE_NOT_FOUND" });
    expect(world.follows.size).toBe(0);
    expect(world.outbox).toHaveLength(0);
  });

  it("fails closed when Commerce cannot verify the store instead of creating an orphan follow", async () => {
    const world = setup();
    world.setStoreLookupUnavailable(true);

    await expect(world.follow({ followerId, storeId })).rejects.toMatchObject({ status: 503, code: "STORE_LOOKUP_UNAVAILABLE" });
    expect(world.follows.size).toBe(0);
    expect(world.outbox).toHaveLength(0);
  });
});
