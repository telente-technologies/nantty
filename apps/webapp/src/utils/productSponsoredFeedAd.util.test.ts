import assert from "node:assert/strict";
import test from "node:test";

import { isProductSponsoredFeedAd } from "./productSponsoredFeedAd.util";

test("recognizes sponsored feed creatives targeting a product", () => {
  assert.equal(isProductSponsoredFeedAd({ campaignId: "campaign-1", label: "Sponsored", advertiserName: "Store", destination: { type: "product", targetId: "product-1" } }), true);
});

test("does not treat unrelated or incomplete sponsored placements as product ads", () => {
  assert.equal(isProductSponsoredFeedAd(null), false);
  assert.equal(isProductSponsoredFeedAd({ campaignId: "campaign-1", label: "Sponsored", advertiserName: "Store", destination: { type: "store", targetId: "store-1" } }), false);
  assert.equal(isProductSponsoredFeedAd({ campaignId: "campaign-1", label: "Sponsored", advertiserName: "Store", destination: { type: "product", targetId: null } }), false);
});
