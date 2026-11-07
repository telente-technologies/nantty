import { describe, expect, it } from "vitest";

import { createMarkStorySeenHandler } from "../../src/modules/posts/commands/markStorySeen/markStorySeen.handler.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";
import { buildPostRow, viewerId } from "./socialPostFakes.fake.js";

const authorId = "0192f0a0-0000-7000-8000-00000000a001";
const profileId = "0192f0a0-0000-7000-8000-00000000a002";

describe("mark story seen impressions", () => {
  it("does not count an impression when the viewer owns the story's postable profile", async () => {
    const story = buildPostRow({ id: "0192f0a0-0000-7000-8000-00000000a003", authorId, authorProfileId: profileId, kind: "story" });
    let storyViewWrites = 0;
    let counterWrites = 0;
    const db = {
      post: {
        findFirst: async () => story,
        update: async () => { counterWrites += 1; },
      },
      follow: {
        findUnique: async () => null,
        findMany: async () => [],
      },
      block: {
        findUnique: async () => null,
        findMany: async () => [],
      },
      storyView: {
        createMany: async () => { storyViewWrites += 1; return { count: 1 }; },
      },
      postDailyStat: { upsert: async () => { counterWrites += 1; } },
    };
    const context = {
      database: { client: db, transaction: async (work: (transaction: unknown) => Promise<unknown>) => work(db) },
      directory: {
        findPrivateAccountIds: async () => new Set<string>(),
        findOwnedPostableProfile: async (accountId: string, ownedProfileId: string) => accountId === viewerId && ownedProfileId === profileId ? { id: profileId, kind: "brand" } : null,
      },
      clock: { now: () => new Date("2026-11-07T12:00:00Z") },
    } as unknown as HandlerContext;

    await createMarkStorySeenHandler(context)({ viewerId, storyId: story.id });

    expect(storyViewWrites).toBe(0);
    expect(counterWrites).toBe(0);
  });
});
