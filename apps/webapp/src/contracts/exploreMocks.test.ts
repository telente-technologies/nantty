import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isGuestBrowsablePage, isPublicApiRead } from "@/config/guestBrowsing.config";
import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import type { HeadlineItem, RankedPost, TrendItem } from "@/types/explore.type";

describe("explore home", () => {
  it("is browsable by guests, read-only", () => {
    assert.equal(isGuestBrowsablePage("/explore"), true);
    for (const section of ["categories", "trends", "headlines", "who-to-follow", "posts-for-you"]) {
      assert.equal(isPublicApiRead("GET", `/api/v1/explore/${section}`), true);
      assert.equal(isPublicApiRead("POST", `/api/v1/explore/${section}`), false);
    }
  });

  it("labels headlines and filters trends by category", async () => {
    const headlines = (await dispatchMockApiRequest("GET", "/api/v1/explore/headlines", new URLSearchParams(), null)) as { items: HeadlineItem[] };
    assert.ok(headlines.items.length > 0);
    assert.ok(headlines.items.every((headline) => headline.sourceLabel === "Summarised from posts" && headline.postIds.length > 0));
    const sports = (await dispatchMockApiRequest("GET", "/api/v1/explore/trends", new URLSearchParams("category=sports"), null)) as { items: TrendItem[] };
    assert.ok(sports.items.length > 0 && sports.items.every((trend) => trend.category === "sports"));
  });

  it("explains every post for you", async () => {
    const page = (await dispatchMockApiRequest("GET", "/api/v1/explore/posts-for-you", new URLSearchParams(), null)) as { data: RankedPost[] };
    assert.ok(page.data.length > 0);
    assert.ok(page.data.every((post) => (post.ranking?.explanations.length ?? 0) > 0));
  });
});
