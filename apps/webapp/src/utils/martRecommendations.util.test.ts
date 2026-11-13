import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ProductSummary } from "@/types";

import { prioritizeMartRecommendations } from "./martRecommendations.util";

const product = (id: string): ProductSummary => ({ id, name: id, price: { amountMinor: 100, currency: "NGN" }, imageUrl: null });

describe("prioritizeMartRecommendations", () => {
  it("puts server-ranked recommendations ahead of catalog results and deduplicates", () => {
    const ranked = prioritizeMartRecommendations([product("a"), product("b")], [product("b"), product("c")]);

    assert.deepEqual(ranked.map(({ id }) => id), ["b", "c", "a"]);
  });

  it("keeps the catalog intact when recommendation results are empty", () => {
    assert.deepEqual(prioritizeMartRecommendations([product("a"), product("b")], []).map(({ id }) => id), ["a", "b"]);
  });
});
