import { describe, expect, it } from "vitest";

import { createListStoryViewersHandler } from "../../src/modules/posts/queries/listStoryViewers/listStoryViewers.handler.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";
import { authorId, buildPostRow, viewerId } from "./socialPostFakes.fake.js";

describe("list story viewers authorization", () => {
  it("rejects non-owners before reading or returning viewer identities", async () => {
    const story = buildPostRow({ kind: "story" });
    let viewerIdentityReads = 0;
    const context = {
      database: {
        client: {
          post: { findFirst: async () => story },
          storyView: {
            count: async () => { viewerIdentityReads += 1; return 1; },
            findMany: async () => { viewerIdentityReads += 1; return [{ viewerId: authorId }]; },
          },
        },
      },
      directory: {
        findOwnedPostableProfile: async () => null,
        findUserSummaries: async () => { viewerIdentityReads += 1; return new Map(); },
      },
    } as unknown as HandlerContext;

    await expect(createListStoryViewersHandler(context)({
      viewerId,
      storyId: story.id,
      cursor: undefined,
      limit: 20,
    })).rejects.toMatchObject({ status: 403, code: "NOT_STORY_OWNER" });

    expect(viewerIdentityReads).toBe(0);
  });

  it("allows the account that owns the posting profile to view its story viewers", async () => {
    const story = buildPostRow({ kind: "story", authorProfileId: "0192f0a0-0000-7000-8000-00000000c001" });
    let viewerIdentityReads = 0;
    const context = {
      database: {
        client: {
          post: { findFirst: async () => story },
          storyView: {
            count: async () => 1,
            findMany: async () => [{ viewerId: authorId, createdAt: new Date("2026-11-07T12:00:00.000Z") }],
          },
        },
      },
      directory: {
        findOwnedPostableProfile: async (accountId: string, profileId: string) =>
          accountId === viewerId && profileId === story.authorProfileId ? { id: profileId } : null,
        findUserSummaries: async (ids: readonly string[]) => {
          viewerIdentityReads += ids.length;
          return new Map(ids.map((id) => [id, { id, name: "Viewer", username: "viewer", avatarUrl: null, verified: false, isCreator: false }]));
        },
      },
    } as unknown as HandlerContext;

    const result = await createListStoryViewersHandler(context)({
      viewerId,
      storyId: story.id,
      cursor: undefined,
      limit: 20,
    });

    expect(result.viewers.map((viewer) => viewer.id)).toEqual([authorId]);
    expect(viewerIdentityReads).toBe(1);
  });

  it("uses a stable viewer keyset so newly inserted views cannot shift later pages", async () => {
    const story = buildPostRow({ kind: "story", authorId: viewerId });
    const viewerRows = [
      { viewerId: "0192f0a0-0000-7000-8000-00000000b002", createdAt: new Date("2026-11-07T12:03:00.000Z") },
      { viewerId: "0192f0a0-0000-7000-8000-00000000b003", createdAt: new Date("2026-11-07T12:02:00.000Z") },
      { viewerId: "0192f0a0-0000-7000-8000-00000000b004", createdAt: new Date("2026-11-07T12:01:00.000Z") },
      { viewerId: "0192f0a0-0000-7000-8000-00000000b005", createdAt: new Date("2026-11-07T12:00:00.000Z") },
    ];
    const requests: Array<{ readonly where: Record<string, unknown>; readonly orderBy: unknown; readonly skip?: number }> = [];
    const context = {
      database: {
        client: {
          post: { findFirst: async () => story },
          storyView: {
            count: async () => viewerRows.length,
            findMany: async (query: { where: Record<string, unknown>; orderBy: unknown; skip?: number; take: number }) => {
              requests.push(query);
              if (query.where.OR) {
                // Simulate another viewer arriving before page two is requested.
                return viewerRows.slice(2, 4);
              }
              return viewerRows.slice(0, query.take);
            },
          },
        },
      },
      directory: {
        findOwnedPostableProfile: async () => null,
        findUserSummaries: async (ids: readonly string[]) => new Map(ids.map((id) => [id, { id, name: id, username: id.slice(-4), avatarUrl: null, verified: false, isCreator: false }])),
      },
    } as unknown as HandlerContext;
    const list = createListStoryViewersHandler(context);

    const first = await list({ viewerId, storyId: story.id, cursor: undefined, limit: 2 });
    expect(first.viewers.map((viewer) => viewer.id)).toEqual(viewerRows.slice(0, 2).map((row) => row.viewerId));
    expect(first.nextCursor).not.toBeNull();
    expect(first.nextCursor!.length).toBeLessThanOrEqual(100);

    const second = await list({ viewerId, storyId: story.id, cursor: first.nextCursor!, limit: 2 });
    expect(second.viewers.map((viewer) => viewer.id)).toEqual(viewerRows.slice(2, 4).map((row) => row.viewerId));
    expect(requests[0]?.orderBy).toEqual([{ createdAt: "desc" }, { viewerId: "asc" }]);
    expect(requests[1]?.skip).toBeUndefined();
    expect(requests[1]?.where.OR).toEqual([
      { createdAt: { lt: new Date("2026-11-07T12:02:00.000Z") } },
      { createdAt: new Date("2026-11-07T12:02:00.000Z"), viewerId: { gt: "0192f0a0-0000-7000-8000-00000000b003" } },
    ]);
  });

  it("rejects malformed story viewer cursors instead of silently restarting pagination", async () => {
    const story = buildPostRow({ kind: "story" });
    const context = {
      database: { client: { post: { findFirst: async () => story }, storyView: { count: async () => 0, findMany: async () => [] } } },
      directory: { findOwnedPostableProfile: async () => null, findUserSummaries: async () => new Map() },
    } as unknown as HandlerContext;

    await expect(createListStoryViewersHandler(context)({ viewerId: authorId, storyId: story.id, cursor: "not-a-cursor", limit: 20 }))
      .rejects.toMatchObject({ status: 400, code: "INVALID_STORY_VIEWER_CURSOR" });
  });
});
