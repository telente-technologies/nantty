import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildOwnProfileMenuItems, resolveCreatorEntry } from "./ownProfileMenu.util";

const creatorEntry = resolveCreatorEntry("none", null, false);

describe("own profile ⋯ menu", () => {
  it("matches the app's shortcuts and order for a seller with requests", () => {
    const items = buildOwnProfileMenuItems({ isSeller: true, isPrivate: false, verificationBadgeVisible: false, creatorEntry, pendingFollowRequests: 3, hasMoreFollowRequests: true });
    assert.deepEqual(items.map((item) => item.label), ["Seller dashboard", "Switch to creator account", "Ads", "Follow requests", "Saved", "My orders", "Wallet", "Get verified", "Settings"]);
    assert.equal(items.find((item) => item.key === "followRequests")?.badge, "3+");
  });

  it("hides seller and follow requests for a public non-seller and says Verification once verified", () => {
    const items = buildOwnProfileMenuItems({ isSeller: false, isPrivate: false, verificationBadgeVisible: true, creatorEntry, pendingFollowRequests: 0 });
    assert.ok(!items.some((item) => item.key === "seller" || item.key === "followRequests"));
    assert.equal(items.find((item) => item.key === "verification")?.label, "Verification");
  });

  it("never repeats an item, so nothing is duplicated", () => {
    const items = buildOwnProfileMenuItems({ isSeller: true, isPrivate: true, verificationBadgeVisible: true, creatorEntry, pendingFollowRequests: 0 });
    assert.equal(new Set(items.map((item) => item.href)).size, items.length);
  });

  it("routes the creator entry by programme status", () => {
    assert.equal(resolveCreatorEntry("approved", null, false).href, "/creator");
    assert.equal(resolveCreatorEntry("none", "pending", false).label, "Creator application status");
    assert.equal(resolveCreatorEntry(undefined, undefined, true).isLoading, true);
  });

  it("offers the Ads hub right after the creator entry for everyone", () => {
    const items = buildOwnProfileMenuItems({ userId: "user-1", isSeller: false, isPrivate: false, verificationBadgeVisible: false, creatorEntry, pendingFollowRequests: 0 });
    assert.deepEqual(items.slice(0, 2).map((item) => item.key), ["creator", "ads"]);
    assert.equal(items[1]?.href, "/ads");
    assert.equal(items[1]?.label, "Ads");
  });
});
