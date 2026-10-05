import { resolveMockApiRequest } from "@/mocks";
import { rankMartHighlights } from "@/mocks/martHighlights.mock";
import type { Page } from "@/types";
import type { MartHighlight } from "@/types/martHighlight.type";

describe("mart highlights mocks", () => {
  it("returns a ranked page with a reason for every highlight, readable by guests", async () => {
    const page = await resolveMockApiRequest<Page<MartHighlight>>("GET", "/api/v1/mart/highlights?limit=5", undefined, undefined, true);
    expect(page.nextCursor).toBeNull();
    expect(page.data).toHaveLength(5);
    for (const highlight of page.data) expect(highlight.ranking.reason.label.length).toBeGreaterThan(0);
    const scores = page.data.map((highlight) => highlight.ranking.score);
    expect([...scores].sort((left, right) => right - left)).toEqual(scores);
  });

  it("reorders highlights between ranking rounds", () => {
    const rounds = [1, 2, 3, 4].map((round) => rankMartHighlights(round).map((highlight) => highlight.id).join(","));
    expect(new Set(rounds).size).toBeGreaterThan(1);
  });
});
