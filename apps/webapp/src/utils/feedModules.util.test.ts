import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { millisecondsPerDay, type FeedModuleKind } from "@/config/feedModules.config";
import type { MyVerification, VerificationDiscounts } from "@/types/verification.type";

import { interleaveFeedModules, planFeedModuleSlots, planProductsYouMightLikeSlots, shouldFetchProductsYouMightLike, takeChunkForOccurrence } from "./feedModuleLayout.util";
import { canShowGetVerifiedCard, emptyGetVerifiedCardHistory, offerIdsNotYetSurfaced, recordGetVerifiedCardDismissal, recordGetVerifiedCardImpression, recordGetVerifiedCardNeverAgain, recordOffersSurfaced } from "./getVerifiedCardFrequency.util";
import { pickGetVerifiedDiscountHighlight, resolveGetVerifiedCardState } from "./getVerifiedCardState.util";
import { buildSuggestedVideoSequence, collectSuggestedRailClips } from "./suggestedVideoSequence.util";

const only = (...kinds: FeedModuleKind[]) => (kind: FeedModuleKind) => kinds.includes(kind);
const positionsOf = (slots: ReturnType<typeof planFeedModuleSlots>, kind: FeedModuleKind) => slots.filter((slot) => slot.kind === kind).map((slot) => slot.afterPostCount);
const days = (count: number) => count * millisecondsPerDay;
const start = Date.parse("2026-10-17T09:00:00Z");

describe("feed module cadence", () => {
  it("places suggested clips after 6 posts then every 18, people after 10 then every 30, and the verified card once", () => {
    const slots = planFeedModuleSlots({ postCount: 80, isModuleEnabled: () => true });
    assert.deepEqual(positionsOf(slots, "suggestedClips"), [6, 24, 42, 60, 78]);
    assert.deepEqual(positionsOf(slots, "peopleYouMayKnow"), [10, 40, 70]);
    assert.deepEqual(positionsOf(slots, "getVerified"), [3]);
  });

  it("never stacks modules back to back or after the last post", () => {
    const slots = planFeedModuleSlots({
      postCount: 120,
      isModuleEnabled: () => true,
      cadence: { getVerified: { firstAfterPosts: 4, repeatEveryPosts: null }, suggestedClips: { firstAfterPosts: 4, repeatEveryPosts: 8 }, peopleYouMayKnow: { firstAfterPosts: 4, repeatEveryPosts: 8 }, productsYouMightLike: { firstAfterPosts: 4, repeatEveryPosts: 8 } },
    });
    const rows = interleaveFeedModules(Array.from({ length: 120 }, (_, index) => index), slots);
    for (let index = 1; index < rows.length; index++) assert.ok(!(rows[index]!.type === "module" && rows[index - 1]!.type === "module"));
    assert.equal(rows.at(-1)?.type, "post");
  });

  it("respects hidden modules and skips rails with nothing fresh", () => {
    assert.deepEqual(positionsOf(planFeedModuleSlots({ postCount: 100, isModuleEnabled: only("peopleYouMayKnow") }), "suggestedClips"), []);
    assert.deepEqual(positionsOf(planFeedModuleSlots({ postCount: 100, isModuleEnabled: only("suggestedClips"), isOccurrenceAvailable: (_, occurrence) => occurrence < 1 }), "suggestedClips"), [6]);
  });

  it("gives every rail different clips", () => {
    const stream = Array.from({ length: 17 }, (_, index) => index);
    assert.deepEqual(takeChunkForOccurrence(stream, 1, 8), [8, 9, 10, 11, 12, 13, 14, 15]);
    assert.deepEqual(takeChunkForOccurrence(stream, 2, 8), [16]);
  });
});

describe("product recommendation feed placement", () => {
  it("matches mobile cadence after 16 organic posts and every 45 thereafter", () => {
    const posts = Array.from({ length: 62 }, (_, index) => ({ sponsored: null, id: index }));
    const slots = planProductsYouMightLikeSlots(posts, [], true, true);
    assert.deepEqual(slots.map((slot) => slot.afterPostCount), [16, 61]);
  });

  it("does not count sponsored posts and avoids an occupied module boundary", () => {
    const posts = Array.from({ length: 17 }, (_, index) => ({ sponsored: index === 3 ? { id: "ad" } : null }));
    const occupied = [{ kind: "suggestedClips" as const, occurrence: 0, afterPostCount: 16 }];
    const slots = planProductsYouMightLikeSlots(posts, occupied, true, true);
    assert.deepEqual(slots.map((slot) => slot.afterPostCount), [17]);
  });

  it("fetches only after enough organic posts on the For You feed", () => {
    assert.equal(shouldFetchProductsYouMightLike(15, true), false);
    assert.equal(shouldFetchProductsYouMightLike(16, true), true);
    assert.equal(shouldFetchProductsYouMightLike(100, false), false);
    assert.deepEqual(planProductsYouMightLikeSlots(Array.from({ length: 30 }, () => ({})), [], true, false), []);
  });
});

describe("get verified card", () => {
  it("caps impressions at one per 3 days, snoozes 30 days after two dismissals, and honours never again", () => {
    const seen = recordGetVerifiedCardImpression(emptyGetVerifiedCardHistory, start);
    assert.equal(canShowGetVerifiedCard(seen, start + days(2)), false);
    assert.equal(canShowGetVerifiedCard(seen, start + days(3)), true);
    const twice = recordGetVerifiedCardDismissal(recordGetVerifiedCardDismissal(emptyGetVerifiedCardHistory, start), start + days(3));
    assert.equal(canShowGetVerifiedCard(twice, start + days(32)), false);
    assert.equal(canShowGetVerifiedCard(twice, start + days(33)), true);
    assert.equal(canShowGetVerifiedCard(recordGetVerifiedCardNeverAgain(emptyGetVerifiedCardHistory), start + days(999)), false);
  });

  it("surfaces an offer once", () => {
    assert.deepEqual(offerIdsNotYetSurfaced(recordOffersSurfaced(emptyGetVerifiedCardHistory, ["o1"]), ["o1", "o2"]), ["o2"]);
  });

  it("hides for verified and government profiles and shows review states for pending and rejected", () => {
    const none: MyVerification = { current: null, subscription: null, application: null };
    assert.equal(resolveGetVerifiedCardState({ profileType: "personal", myVerification: { ...none, current: { status: "active", type: "personal", color: "blue", tier: "VERIFIED", badgeVisible: true } }, dismissedOnServer: false }).kind, "hidden");
    assert.equal(resolveGetVerifiedCardState({ profileType: "government", myVerification: none, dismissedOnServer: false }).kind, "hidden");
    assert.equal(resolveGetVerifiedCardState({ profileType: "business", myVerification: { ...none, current: { status: "pending", type: "business", color: "gold", tier: "PRO", badgeVisible: false } }, dismissedOnServer: false }).kind, "pending");
    assert.deepEqual(resolveGetVerifiedCardState({ profileType: "business", myVerification: none, dismissedOnServer: false }), { kind: "offer", color: "gold" });
  });

  it("prefers the emailed offer, then the bundle, then yearly", () => {
    const offer = { linkId: "l1", token: "t", plans: [{ planCode: "gold_only", planLabel: "Gold" }], discount: { kind: "percentage" as const, percentOff: 30 }, durationCycles: 1, expiresAt: null, sentAt: "2026-10-10T00:00:00Z" };
    const discounts: VerificationDiscounts = { offers: [offer], yearlyPercentOff: 20, bundle: { percentOff: 15 } };
    assert.equal(pickGetVerifiedDiscountHighlight(discounts, "gold")?.kind, "offerLink");
    assert.equal(pickGetVerifiedDiscountHighlight(discounts, "blue")?.kind, "yearly");
    assert.equal(pickGetVerifiedDiscountHighlight({ ...discounts, offers: [] }, "gold")?.kind, "bundle");
  });
});

describe("suggested videos sequence", () => {
  it("starts at the tapped clip, never repeats, and keeps ads out of the rail", () => {
    const clip = (id: string, sponsored: unknown = null) => ({ id, sponsored });
    assert.deepEqual(buildSuggestedVideoSequence(clip("t"), [[clip("a"), clip("t")], [clip("a"), clip("b")]]).map((item) => item.id), ["t", "a", "b"]);
    assert.deepEqual(buildSuggestedVideoSequence(clip("t"), []).map((item) => item.id), ["t"]);
    assert.deepEqual(collectSuggestedRailClips([[clip("a"), clip("ad", {})]]).map((item) => item.id), ["a"]);
  });
});
