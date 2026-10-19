import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { SponsoredPlacement } from "@/types";
import { resolveAdTapAction } from "./adDestination.util";
import { boostGoalsFor, boostRequestTarget, boostResultMetricsFor } from "./boostDestination.util";
import { canPromoteStore, isPromotedEntityAd, promoteHrefFor, promotedCheckmarkColor, promotedEntityCallToActionLabel, promotedEntityThumbnails, resolvePromotedFollowState, viewHrefForBoostDestination } from "./promotedEntityAd.util";

const storeCard = { kind: "store", id: "store-1", name: "Ada Fabrics", handle: "adafabrics", avatarUrl: null, verified: true, private: false } as const;
const profileCard = { kind: "profile", id: "user-1", name: "Ada", handle: "ada", avatarUrl: null, verified: false, private: true } as const;
const sponsored = (promoted?: SponsoredPlacement["promoted"]): SponsoredPlacement => ({ campaignId: "ad-1", label: "Boosted", advertiserName: "Ada", destination: promoted ? { type: promoted.kind, targetId: promoted.id } : { type: "url", url: "https://ada.example" }, promoted });

describe("promoted store and profile ads", () => {
  it("renders only store and profile ads as entity cards with View store / View profile", () => {
    assert.equal(isPromotedEntityAd(sponsored(storeCard)), true);
    assert.equal(isPromotedEntityAd(sponsored()), false);
    assert.equal(promotedEntityCallToActionLabel("store"), "View store");
    assert.equal(promotedEntityCallToActionLabel("profile"), "View profile");
  });

  it("opens the store page and the profile on the web", () => {
    assert.deepEqual(resolveAdTapAction(sponsored(storeCard), { kind: "cta" }, "web"), { kind: "internal", href: "/store/store-1" });
    assert.deepEqual(resolveAdTapAction(sponsored(profileCard), { kind: "media" }, "ios"), { kind: "internal", href: "/user/user-1" });
  });

  it("shows the Gold checkmark on verified stores and keeps private follows as requests", () => {
    assert.equal(promotedCheckmarkColor(storeCard, null), "gold");
    assert.equal(promotedCheckmarkColor(profileCard, null), null);
    assert.equal(resolvePromotedFollowState({ followState: "requested" }), "requested");
    assert.equal(resolvePromotedFollowState(undefined), "none");
  });

  it("uses product photos for store thumbnails, else the banner", () => {
    assert.deepEqual(promotedEntityThumbnails([{ imageUrl: "a" }, { imageUrl: "b" }, { imageUrl: "c" }, { imageUrl: "d" }], "x"), ["a", "b", "c"]);
    assert.deepEqual(promotedEntityThumbnails([{ imageUrl: "a" }], "x"), ["x"]);
  });
});

describe("promoting a profile or store", () => {
  it("links the boost flow and the result page per destination", () => {
    assert.equal(promoteHrefFor({ type: "store", targetId: "store-1" }), "/boost/store/store-1");
    assert.equal(promoteHrefFor({ type: "post", targetId: "post-1" }), "/boost/post-1");
    assert.equal(viewHrefForBoostDestination({ type: "profile", targetId: "user-1" }), "/user/user-1");
    assert.deepEqual(boostRequestTarget({ type: "profile", targetId: "user-1" }), { destinationType: "profile", targetId: "user-1" });
    assert.deepEqual(boostGoalsFor("store").map((goal) => goal.id), ["store_visits"]);
  });

  it("labels store visits honestly as ad taps", () => {
    const metrics = boostResultMetricsFor({ id: "b", postId: "", destinationType: "store", targetId: "store-1", status: "active", goal: "store_visits", totalBudget: { amountMinor: 1, currency: "NGN" }, spent: { amountMinor: 0, currency: "NGN" }, startsAt: null, endsAt: null, results: { impressions: 4, reach: 3, profileVisits: 0, storeVisits: 2, messages: 0 }, rejectionReason: null });
    assert.deepEqual(metrics.map((metric) => metric.label), ["Impressions", "People reached", "Store visits (ad taps)"]);
  });

  it("only the owner or a manager can promote a store", () => {
    const myStores = [{ storeId: "store-1", storeName: "A", role: "manager", isCurrent: true }, { storeId: "store-2", storeName: "B", role: "cashier", isCurrent: false }];
    assert.equal(canPromoteStore({ storeId: "store-1", storeOwnerUserId: "o", signedInUserId: "s", myStores }), true);
    assert.equal(canPromoteStore({ storeId: "store-2", storeOwnerUserId: "o", signedInUserId: "s", myStores }), false);
    assert.equal(canPromoteStore({ storeId: "store-1", storeOwnerUserId: "o", signedInUserId: undefined, myStores }), false);
  });
});
