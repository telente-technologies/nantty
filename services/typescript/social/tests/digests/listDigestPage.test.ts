import { describe, expect, it } from "vitest";

import { createListDigestPageHandler } from "../../src/modules/digests/queries/listDigestPage/listDigestPage.handler.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

describe("listDigestPage weekly personalization consent", () => {
  it("skips weekly digest entries for users without personalization consent", async () => {
    const postRow = { id: "post-1", authorId: "author-1", text: "Hello world", likeCount: 12 };
    const context = {
      clock: { now: () => new Date("2026-11-16T10:00:00Z") },
      directory: {
        hasPersonalizationConsent: async (accountId: string) => accountId === "user-consented",
        findUserSummaries: async () => new Map([["author-1", { id: "author-1", name: "Ada", username: "ada", avatarUrl: null, verified: false, isCreator: false }]]),
      },
      database: {
        client: {
          follow: {
            groupBy: async () => [{ followerId: "user-opted-out" }, { followerId: "user-consented" }],
            findMany: async () => [{ followeeId: "author-1" }],
          },
          post: {
            findMany: async () => [postRow],
          },
        },
      },
    } as unknown as HandlerContext;

    const handler = createListDigestPageHandler(context);
    const page = await handler({ kind: "weekly", cursor: undefined, limit: 10, since: new Date("2026-11-09T10:00:00Z") });

    expect(page.data.map((entry) => entry.userId)).toEqual(["user-consented"]);
    expect(page.data[0]?.props).toMatchObject({ topPosts: [{ postId: "post-1", authorHandle: "ada" }] });
  });
});
