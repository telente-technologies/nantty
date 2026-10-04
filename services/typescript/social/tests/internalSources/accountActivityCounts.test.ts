import { describe, expect, it } from "vitest";

import { createGetAccountActivityCountsHandler } from "../../src/modules/internalSources/queries/getAccountActivityCounts/getAccountActivityCounts.handler.js";
import type { HandlerContext } from "../../src/types/handlerContext.type.js";

describe("account activity counts", () => {
  it("counts the author's undeleted posts since the window start", async () => {
    let where: Record<string, unknown> = {};
    const context = {
      clock: { now: () => new Date("2026-10-04T00:00:00.000Z") },
      database: { client: { post: { count: async (args: { where: Record<string, unknown> }) => { where = args.where; return 148; } } } },
    } as unknown as HandlerContext;
    const result = await createGetAccountActivityCountsHandler(context)({ accountId: "acc", sinceDays: 365 });
    expect(result).toEqual({ posts: 148 });
    expect(where).toMatchObject({ authorId: "acc", deletedAt: null, createdAt: { gte: new Date("2025-10-04T00:00:00.000Z") } });
  });
});
