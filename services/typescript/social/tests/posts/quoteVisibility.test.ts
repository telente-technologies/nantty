import { describe, expect, it } from "vitest";

import { selectQuotesVisibleToViewer, type QuoteCandidate } from "../../src/modules/posts/services/quoteVisibility.service.js";

const quote = (id: string, authorId: string, overrides: Partial<QuoteCandidate> = {}): QuoteCandidate => ({ id, authorId, audience: "everyone", sensitiveLabels: [], ...overrides });

describe("quote listing privacy", () => {
  const rows = [
    quote("q1", "public-author"),
    quote("q2", "private-author"),
    quote("q3", "followers-author", { audience: "followers" }),
    quote("q4", "public-author", { sensitiveLabels: ["nudity"] }),
    quote("q5", "blocked-author"),
    quote("q6", "viewer", { audience: "followers" }),
  ];

  it("hides private, blocked, followers-only and age-restricted quotes from a stranger", () => {
    const visible = selectQuotesVisibleToViewer(rows, { viewerId: "viewer", visibleAuthors: new Set(["public-author", "followers-author", "viewer"]), followedAuthors: new Set(), withheldLabels: ["nudity", "dangerous_acts"] });
    expect(visible.map((row) => row.id)).toEqual(["q1", "q6"]);
  });

  it("shows followers-only quotes to followers and adult content to adults", () => {
    const visible = selectQuotesVisibleToViewer(rows, { viewerId: "viewer", visibleAuthors: new Set(["public-author", "private-author", "followers-author", "viewer"]), followedAuthors: new Set(["private-author", "followers-author"]), withheldLabels: [] });
    expect(visible.map((row) => row.id)).toEqual(["q1", "q2", "q3", "q4", "q6"]);
  });

  it("gives guests public quotes only", () => {
    const visible = selectQuotesVisibleToViewer(rows, { viewerId: undefined, visibleAuthors: new Set(["public-author", "followers-author"]), followedAuthors: new Set(), withheldLabels: ["nudity", "dangerous_acts"] });
    expect(visible.map((row) => row.id)).toEqual(["q1"]);
  });
});
