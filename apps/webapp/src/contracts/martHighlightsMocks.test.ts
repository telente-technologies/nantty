import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isPublicApiRead } from "@/config/guestBrowsing.config";
import { dispatchMockApiRequest } from "@/mocks/dispatch.mock";
import { rankMartHighlights } from "@/mocks/martHighlights.mock";
import type { Page } from "@/types";
import type { MartHighlight } from "@/types/martHighlight.type";

describe("mart highlights", () => {
  it("is a public read returning a ranked page with reasons", async () => {
    assert.equal(isPublicApiRead("GET", "/api/v1/mart/highlights"), true);
    const page = (await dispatchMockApiRequest("GET", "/api/v1/mart/highlights", new URLSearchParams("limit=5"), null)) as Page<MartHighlight>;
    assert.equal(page.nextCursor, null);
    assert.equal(page.data.length, 5);
    assert.ok(page.data.every((highlight) => highlight.ranking.reason.label.length > 0));
    const scores = page.data.map((highlight) => highlight.ranking.score);
    assert.deepEqual([...scores].sort((left, right) => right - left), scores);
  });

  it("reorders highlights between ranking rounds", () => {
    const rounds = [1, 2, 3, 4].map((round) => rankMartHighlights(round).map((highlight) => highlight.id).join(","));
    assert.ok(new Set(rounds).size > 1);
  });
});
