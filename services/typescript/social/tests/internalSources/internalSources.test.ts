import { describe, expect, it } from "vitest";

import { ineligibilityReasonFor } from "../../src/modules/internalSources/queries/listAdContentSources/listAdContentSources.handler.js";
import { mergeEngagerTallies } from "../../src/modules/internalSources/queries/listAudienceEngagers/listAudienceEngagers.handler.js";
import { extractHashtags } from "../../src/modules/internalSources/services/hashtags.service.js";
import type { PostRow } from "../../src/modules/posts/repositories/post.repository.js";

const post = (overrides: Partial<PostRow>): PostRow => ({ text: "Hello", audience: "everyone", visibility: "public", moderationVisibility: "visible", media: [], ...overrides }) as PostRow;

describe("internal sources", () => {
  it("only lets public, visible, fully processed posts be boosted", () => {
    expect(ineligibilityReasonFor(post({}))).toBeNull();
    expect(ineligibilityReasonFor(post({ audience: "followers" }))).toMatch(/public/);
    expect(ineligibilityReasonFor(post({ moderationVisibility: "restricted" }))).toMatch(/moderation/);
    expect(ineligibilityReasonFor(post({ media: [{ status: "processing" }] as PostRow["media"] }))).toMatch(/processing/);
  });

  it("merges like and comment tallies per person and pages by account id", () => {
    const at = new Date("2026-10-01T00:00:00Z");
    const later = new Date("2026-10-03T00:00:00Z");
    const { page, hasMore } = mergeEngagerTallies([[{ accountId: "b", interactions: 2, lastActiveAt: at }, { accountId: "c", interactions: 1, lastActiveAt: at }], [{ accountId: "a", interactions: 1, lastActiveAt: at }, { accountId: "b", interactions: 3, lastActiveAt: later }]], 2);
    expect(page.map((tally) => [tally.accountId, tally.interactions])).toEqual([["a", 1], ["b", 5]]);
    expect(page[1]?.lastActiveAt).toEqual(later);
    expect(hasMore).toBe(true);
  });

  it("extracts unique lowercase hashtags", () => {
    expect(extractHashtags("New #Drop for #drop lovers #Lagos_Style")).toEqual(["drop", "lagos_style"]);
  });
});
