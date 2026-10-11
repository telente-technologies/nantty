import { describe, expect, it } from "vitest";

import { feedRepository } from "../../src/modules/feeds/repositories/feed.repository.js";

describe("following feed cursor", () => {
  it("pages with an id keyset so a deleted cursor row cannot end or repeat the feed", async () => {
    const calls: Record<string, unknown>[] = [];
    const db = { post: { findMany: async (args: Record<string, unknown>) => { calls.push(args); return []; } } };
    await feedRepository.pageFollowing(db as never, ["a1"], ["post"], 20, "0192a4f0-0000-7000-8000-000000000010");
    expect(calls[0]).not.toHaveProperty("cursor");
    expect(calls[0]?.["where"]).toMatchObject({ id: { lt: "0192a4f0-0000-7000-8000-000000000010" } });
    expect(calls[0]).toMatchObject({ orderBy: { id: "desc" }, take: 21 });
  });
});
