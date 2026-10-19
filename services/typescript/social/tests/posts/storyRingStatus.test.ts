import { describe, expect, it } from "vitest";

import { createGetStoryRingStatusHandler } from "../../src/modules/posts/queries/getStoryRingStatus/getStoryRingStatus.handler.js";
import { summariseStoryRingForViewer } from "../../src/modules/posts/services/storyRingStatus.service.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

const ownerId = "0192f0a0-0000-7000-8000-00000000a001";
const viewerId = "0192f0a0-0000-7000-8000-00000000b001";
const now = new Date("2026-10-17T12:00:00Z");

interface StoryFixture {
  readonly id: string;
  readonly audience: "everyone" | "followers";
  readonly expiresAt: Date;
}

interface WorldFixture {
  readonly stories?: readonly StoryFixture[];
  readonly seenByViewer?: readonly string[];
  readonly ownerIsPrivate?: boolean;
  readonly viewerFollowState?: "accepted" | "requested";
  readonly ownerBlockedViewer?: boolean;
  readonly viewerBlockedOwner?: boolean;
  readonly ownerExists?: boolean;
}

function buildStoryRingContext(world: WorldFixture): HandlerContext {
  const stories = world.stories ?? [];
  const client = {
    post: {
      findMany: async ({ where }: { where: { authorId: string; audience: { in: string[] }; expiresAt: { gt: Date } } }) =>
        stories.filter((story) => where.authorId === ownerId && where.audience.in.includes(story.audience) && story.expiresAt > where.expiresAt.gt).map((story) => ({ id: story.id })),
    },
    storyView: {
      findMany: async ({ where }: { where: { viewerId: string; storyId: { in: string[] } } }) =>
        where.viewerId === viewerId ? (world.seenByViewer ?? []).filter((id) => where.storyId.in.includes(id)).map((storyId) => ({ storyId })) : [],
    },
    follow: {
      findUnique: async ({ where }: { where: { followerId_followeeId: { followerId: string; followeeId: string } } }) =>
        world.viewerFollowState && where.followerId_followeeId.followerId === viewerId && where.followerId_followeeId.followeeId === ownerId ? { state: world.viewerFollowState } : null,
    },
    block: {
      findUnique: async ({ where }: { where: { blockerId_blockedId: { blockerId: string; blockedId: string } } }) => {
        const { blockerId, blockedId } = where.blockerId_blockedId;
        if (world.ownerBlockedViewer && blockerId === ownerId && blockedId === viewerId) return { blockerId };
        if (world.viewerBlockedOwner && blockerId === viewerId && blockedId === ownerId) return { blockerId };
        return null;
      },
    },
  };
  return {
    database: { client },
    directory: {
      findUserSummaries: async (ids: readonly string[]) => new Map(world.ownerExists === false ? [] : ids.filter((id) => id === ownerId).map((id) => [id, { id, name: "Owner", username: "owner", avatarUrl: null, verified: false, isCreator: false }])),
      findPrivateAccountIds: async (ids: readonly string[]) => new Set(world.ownerIsPrivate ? ids.filter((id) => id === ownerId) : []),
    },
    clock: { now: () => now },
  } as unknown as HandlerContext;
}

const later = new Date("2026-10-18T00:00:00Z");
const earlier = new Date("2026-10-17T06:00:00Z");
const publicStories: StoryFixture[] = [{ id: "s1", audience: "everyone", expiresAt: later }, { id: "s2", audience: "everyone", expiresAt: later }];

describe("story ring status for a profile avatar", () => {
  it("reports no ring when the owner has no live story", async () => {
    const status = await createGetStoryRingStatusHandler(buildStoryRingContext({ stories: [{ id: "old", audience: "everyone", expiresAt: earlier }] }))({ viewerId, ownerId });
    expect(status).toEqual({ hasActiveStory: false, hasUnseenStory: false });
  });

  it("reports an unseen ring until every story is seen, then a seen ring", async () => {
    const unseen = await createGetStoryRingStatusHandler(buildStoryRingContext({ stories: publicStories, seenByViewer: ["s1"] }))({ viewerId, ownerId });
    expect(unseen).toEqual({ hasActiveStory: true, hasUnseenStory: true });
    const seen = await createGetStoryRingStatusHandler(buildStoryRingContext({ stories: publicStories, seenByViewer: ["s1", "s2"] }))({ viewerId, ownerId });
    expect(seen).toEqual({ hasActiveStory: true, hasUnseenStory: false });
  });

  it("gives guests the public ring as unseen", async () => {
    const status = await createGetStoryRingStatusHandler(buildStoryRingContext({ stories: publicStories }))({ viewerId: undefined, ownerId });
    expect(status).toEqual({ hasActiveStory: true, hasUnseenStory: true });
  });

  it("hides followers-only stories from people who don't follow and shows them to followers", async () => {
    const followersOnly: StoryFixture[] = [{ id: "f1", audience: "followers", expiresAt: later }];
    expect(await createGetStoryRingStatusHandler(buildStoryRingContext({ stories: followersOnly }))({ viewerId, ownerId })).toEqual({ hasActiveStory: false, hasUnseenStory: false });
    expect(await createGetStoryRingStatusHandler(buildStoryRingContext({ stories: followersOnly, viewerFollowState: "requested" }))({ viewerId, ownerId })).toEqual({ hasActiveStory: false, hasUnseenStory: false });
    expect(await createGetStoryRingStatusHandler(buildStoryRingContext({ stories: followersOnly, viewerFollowState: "accepted" }))({ viewerId, ownerId })).toEqual({ hasActiveStory: true, hasUnseenStory: true });
  });

  it("shows nothing on a private profile the viewer doesn't follow, and nothing to guests", async () => {
    expect(await createGetStoryRingStatusHandler(buildStoryRingContext({ stories: publicStories, ownerIsPrivate: true }))({ viewerId, ownerId })).toEqual({ hasActiveStory: false, hasUnseenStory: false });
    expect(await createGetStoryRingStatusHandler(buildStoryRingContext({ stories: publicStories, ownerIsPrivate: true }))({ viewerId: undefined, ownerId })).toEqual({ hasActiveStory: false, hasUnseenStory: false });
    expect(await createGetStoryRingStatusHandler(buildStoryRingContext({ stories: publicStories, ownerIsPrivate: true, viewerFollowState: "accepted" }))({ viewerId, ownerId })).toEqual({ hasActiveStory: true, hasUnseenStory: true });
  });

  it("shows nothing when either side has blocked the other", async () => {
    expect(await createGetStoryRingStatusHandler(buildStoryRingContext({ stories: publicStories, ownerBlockedViewer: true }))({ viewerId, ownerId })).toEqual({ hasActiveStory: false, hasUnseenStory: false });
    expect(await createGetStoryRingStatusHandler(buildStoryRingContext({ stories: publicStories, viewerBlockedOwner: true }))({ viewerId, ownerId })).toEqual({ hasActiveStory: false, hasUnseenStory: false });
  });

  it("shows nothing for an unknown account instead of failing the profile", async () => {
    expect(await createGetStoryRingStatusHandler(buildStoryRingContext({ stories: publicStories, ownerExists: false }))({ viewerId, ownerId })).toEqual({ hasActiveStory: false, hasUnseenStory: false });
  });

  it("treats the owner's own ring as seen, followers-only stories included", async () => {
    const own = await createGetStoryRingStatusHandler(buildStoryRingContext({ stories: [{ id: "f1", audience: "followers", expiresAt: later }] }))({ viewerId: ownerId, ownerId });
    expect(own).toEqual({ hasActiveStory: true, hasUnseenStory: false });
    expect(summariseStoryRingForViewer([], new Set(), false)).toEqual({ hasActiveStory: false, hasUnseenStory: false });
  });
});
