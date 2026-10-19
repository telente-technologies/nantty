import { describe, expect, it } from "vitest";

import { suggestAccountsToFollow } from "../../src/modules/explore/services/whoToFollow.service.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

interface FollowRow {
  readonly followerId: string;
  readonly followeeId: string;
  readonly state: "accepted" | "requested";
  readonly createdAt: Date;
}

const viewer = "viewer";
const now = new Date("2026-10-17T12:00:00Z");

function buildContext(follows: readonly FollowRow[], blocks: readonly { blockerId: string; blockedId: string }[], privateAccountIds: readonly string[]): HandlerContext {
  const matches = (row: FollowRow, where: Record<string, unknown>) =>
    (where.followerId === undefined || (typeof where.followerId === "string" ? row.followerId === where.followerId : (where.followerId as { in: string[] }).in.includes(row.followerId))) &&
    (where.state === undefined || row.state === where.state) &&
    (where.createdAt === undefined || row.createdAt >= (where.createdAt as { gte: Date }).gte);
  const client = {
    follow: { findMany: async ({ where }: { where: Record<string, unknown> }) => follows.filter((row) => matches(row, where)) },
    block: { findMany: async () => blocks },
    like: { findMany: async () => [] },
    postLike: { findMany: async () => [] },
    $queryRaw: async () => [],
    $queryRawUnsafe: async () => [],
  };
  return {
    database: { client },
    clock: { now: () => now },
    directory: {
      findPrivateAccountIds: async (ids: readonly string[]) => new Set(ids.filter((id) => privateAccountIds.includes(id))),
      findUserSummaries: async (ids: readonly string[]) => new Map(ids.map((id) => [id, { id, name: id, username: id, avatarUrl: null, verified: false }])),
    },
  } as unknown as HandlerContext;
}

const recentFollow = (followerId: string, followeeId: string, state: FollowRow["state"] = "accepted"): FollowRow => ({ followerId, followeeId, state, createdAt: new Date("2026-10-16T12:00:00Z") });

describe("people you may know", () => {
  const popularTargets = ["followed", "blocked", "blocker", "requested", "private", "open"].flatMap((target) => [recentFollow("fan1", target), recentFollow("fan2", target)]);
  const follows = [...popularTargets, recentFollow(viewer, "followed"), recentFollow(viewer, "requested", "requested")];
  const blocks = [{ blockerId: viewer, blockedId: "blocked" }, { blockerId: "blocker", blockedId: viewer }];

  it("never suggests people the viewer follows, has asked to follow, blocked or is blocked by", async () => {
    const suggestions = await suggestAccountsToFollow(buildContext(follows, blocks, ["private"]), { viewerId: viewer, country: null, limit: 10, includePrivateAccounts: true });
    const ids = suggestions.map((suggestion) => suggestion.user.id);
    expect(ids).toEqual(expect.arrayContaining(["open", "private"]));
    for (const excluded of [viewer, "followed", "requested", "blocked", "blocker"]) expect(ids).not.toContain(excluded);
  });

  it("marks private accounts so the follow button can show Requested, and hides them unless asked", async () => {
    const withPrivate = await suggestAccountsToFollow(buildContext(follows, blocks, ["private"]), { viewerId: viewer, country: null, limit: 10, includePrivateAccounts: true });
    expect(withPrivate.find((suggestion) => suggestion.user.id === "private")?.isPrivate).toBe(true);
    expect(withPrivate.find((suggestion) => suggestion.user.id === "open")?.isPrivate).toBe(false);
    const withoutPrivate = await suggestAccountsToFollow(buildContext(follows, blocks, ["private"]), { viewerId: viewer, country: null, limit: 10 });
    expect(withoutPrivate.map((suggestion) => suggestion.user.id)).not.toContain("private");
  });
});
