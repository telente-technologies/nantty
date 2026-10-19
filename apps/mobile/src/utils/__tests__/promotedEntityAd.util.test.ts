import type { Boost, SponsoredPlacement } from "@/types";
import { boostDestinationOf, boostGoalsFor, boostRequestTarget, boostResultMetricsFor, boostViewTargetLabelFor } from "@/utils/boostDestination.util";
import { isPromotedEntityAd, promotedCheckmarkColor, promotedEntityCallToActionLabel, promotedEntityThumbnails } from "@/utils/promotedEntityAd.util";
import { resolveAdTapAction } from "@/utils/adDestination.util";
import { canPromoteStore } from "@/utils/storePromotion.util";

const sponsored = (promoted?: SponsoredPlacement["promoted"]): SponsoredPlacement => ({
  campaignId: "ad-1", label: "Boosted", advertiserName: "Ada Fabrics", destination: promoted ? { type: promoted.kind, targetId: promoted.id } : { type: "url", url: "https://ada.example" }, promoted,
});

const storeCard = { kind: "store", id: "store-1", name: "Ada Fabrics", handle: "adafabrics", avatarUrl: null, verified: true, checkmarkColor: "gold", private: false } as const;
const profileCard = { kind: "profile", id: "user-1", name: "Ada", handle: "ada", avatarUrl: null, verified: false, private: true } as const;

test("only store and profile ads render as promoted entity cards", () => {
  expect(isPromotedEntityAd(sponsored(storeCard))).toBe(true);
  expect(isPromotedEntityAd(sponsored(profileCard))).toBe(true);
  expect(isPromotedEntityAd(sponsored())).toBe(false);
  expect(isPromotedEntityAd(null)).toBe(false);
});

test("store and profile cards open the store page and the profile in-app", () => {
  expect(promotedEntityCallToActionLabel("store")).toBe("View store");
  expect(promotedEntityCallToActionLabel("profile")).toBe("View profile");
  for (const platform of ["ios", "android", "web"] as const) {
    expect(resolveAdTapAction(sponsored(storeCard), { kind: "cta" }, platform)).toEqual({ kind: "internal", route: "Store", params: { storeId: "store-1" } });
    expect(resolveAdTapAction(sponsored(profileCard), { kind: "media" }, platform)).toEqual({ kind: "internal", route: "UserProfile", params: { userId: "user-1" } });
  }
});

test("store thumbnails use two or three product photos, else the banner", () => {
  const products = [{ imageUrl: "a" }, { imageUrl: null }, { imageUrl: "b" }, { imageUrl: "c" }, { imageUrl: "d" }];
  expect(promotedEntityThumbnails(products, "banner")).toEqual(["a", "b", "c"]);
  expect(promotedEntityThumbnails([{ imageUrl: "a" }], "banner")).toEqual(["banner"]);
  expect(promotedEntityThumbnails([{ imageUrl: "a" }], null)).toEqual(["a"]);
});

test("each destination has its own goals and sends the right target", () => {
  expect(boostGoalsFor("post").map((goal) => goal.id)).toEqual(["views", "profile_visits", "messages"]);
  expect(boostGoalsFor("profile").map((goal) => goal.label)).toEqual(["More profile visits / followers"]);
  expect(boostGoalsFor("store").map((goal) => goal.id)).toEqual(["store_visits"]);
  expect(boostRequestTarget({ type: "post", targetId: "post-1" })).toEqual({ postId: "post-1", destinationType: "post", targetId: "post-1" });
  expect(boostRequestTarget({ type: "store", targetId: "store-1" })).toEqual({ destinationType: "store", targetId: "store-1" });
});

test("boost results label store and profile visits as ad taps", () => {
  const base: Boost = { id: "b", postId: "", destinationType: "store", targetId: "store-1", status: "active", goal: "store_visits", totalBudget: { amountMinor: 1, currency: "NGN" }, spent: { amountMinor: 0, currency: "NGN" }, startsAt: null, endsAt: null, results: { impressions: 10, reach: 8, profileVisits: 0, storeVisits: 3, messages: 0 }, rejectionReason: null };
  expect(boostResultMetricsFor(base).map((metric) => [metric.label, metric.value])).toEqual([["Impressions", 10], ["People reached", 8], ["Store visits (ad taps)", 3]]);
  expect(boostDestinationOf({ postId: "post-9" })).toEqual({ type: "post", targetId: "post-9" });
  expect(boostViewTargetLabelFor("profile")).toBe("View profile");
});

test("only the store owner or a manager sees Promote store", () => {
  const myStores = [{ storeId: "store-1", storeName: "Ada", role: "manager", isCurrent: true }, { storeId: "store-2", storeName: "B", role: "cashier", isCurrent: false }];
  expect(canPromoteStore({ storeId: "store-1", storeOwnerUserId: "owner", signedInUserId: "owner", myStores: undefined })).toBe(true);
  expect(canPromoteStore({ storeId: "store-1", storeOwnerUserId: "owner", signedInUserId: "staff", myStores })).toBe(true);
  expect(canPromoteStore({ storeId: "store-2", storeOwnerUserId: "owner", signedInUserId: "staff", myStores })).toBe(false);
  expect(canPromoteStore({ storeId: "store-1", storeOwnerUserId: "owner", signedInUserId: undefined, myStores })).toBe(false);
});

test("store ads show the Gold checkmark, profiles their own colour", () => {
  expect(promotedCheckmarkColor({ ...storeCard, checkmarkColor: undefined }, null)).toBe("gold");
  expect(promotedCheckmarkColor(profileCard, null)).toBeNull();
  expect(promotedCheckmarkColor(profileCard, { badgeVisible: true, color: "blue" })).toBe("blue");
  expect(promotedCheckmarkColor(storeCard, { badgeVisible: false, color: "blue" })).toBe("gold");
});
