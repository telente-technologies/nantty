import assert from "node:assert/strict";
import test from "node:test";

import { clipProductRecommendationIndexes, clipProductRecommendations, shouldShowClipProductRecommendations } from "./clipProductRecommendations.util";
import type { ProductSummary } from "@/types";

const cadence = { firstAfterPosts: 16, repeatEveryPosts: 45 };

test("clip product recommendations follow the For You cadence only", () => {
  assert.equal(shouldShowClipProductRecommendations(15, cadence, true, true), false);
  assert.equal(shouldShowClipProductRecommendations(16, cadence, true, true), true);
  assert.equal(shouldShowClipProductRecommendations(60, cadence, true, true), false);
  assert.equal(shouldShowClipProductRecommendations(61, cadence, true, true), true);
  assert.equal(shouldShowClipProductRecommendations(16, cadence, false, true), false);
  assert.equal(shouldShowClipProductRecommendations(16, cadence, true, false), false);
});

test("clip recommendations exclude products already tagged to that clip and cap the shelf", () => {
  const products = Array.from({ length: 8 }, (_, index) => ({ id: `product-${index}`, name: `Product ${index}` } as ProductSummary));
  const result = clipProductRecommendations(products, ["product-1"], 6);
  assert.equal(result.length, 6);
  assert.equal(result.some((product) => product.id === "product-1"), false);
  assert.equal(clipProductRecommendations(products, [], 0).length, 0);
});

test("clip recommendation slots count organic clips and ignore sponsored clips", () => {
  const clips = Array.from({ length: 63 }, (_, index) => ({ sponsored: index === 3 ? { campaignId: "ad" } : null }));
  const indexes = clipProductRecommendationIndexes(clips, cadence, true, true);
  assert.equal(indexes.has(16), true);
  assert.equal(indexes.has(61), true);
  assert.equal(indexes.has(3), false);
  assert.equal(clipProductRecommendationIndexes(clips, cadence, false, true).size, 0);
});
