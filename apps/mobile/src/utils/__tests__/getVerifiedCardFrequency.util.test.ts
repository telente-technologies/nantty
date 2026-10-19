import { millisecondsPerDay } from "@/constants/feedModules.constant";

import {
  canShowGetVerifiedCard,
  emptyGetVerifiedCardHistory,
  offerIdsNotYetSurfaced,
  recordGetVerifiedCardDismissal,
  recordGetVerifiedCardImpression,
  recordGetVerifiedCardNeverAgain,
  recordOffersSurfaced,
} from "../getVerifiedCardFrequency.util";

const start = Date.parse("2026-10-17T09:00:00Z");
const days = (count: number) => count * millisecondsPerDay;

describe("get verified card frequency", () => {
  it("shows at most one impression every 3 days", () => {
    expect(canShowGetVerifiedCard(emptyGetVerifiedCardHistory, start)).toBe(true);
    const seen = recordGetVerifiedCardImpression(emptyGetVerifiedCardHistory, start);
    expect(canShowGetVerifiedCard(seen, start + days(1))).toBe(false);
    expect(canShowGetVerifiedCard(seen, start + days(3) - 1)).toBe(false);
    expect(canShowGetVerifiedCard(seen, start + days(3))).toBe(true);
  });

  it("snoozes for 30 days after the second dismissal and then starts counting again", () => {
    const once = recordGetVerifiedCardDismissal(emptyGetVerifiedCardHistory, start);
    expect(once.snoozedUntil).toBeNull();
    expect(canShowGetVerifiedCard(once, start + days(3))).toBe(true);
    const twice = recordGetVerifiedCardDismissal(once, start + days(3));
    expect(twice.snoozedUntil).toBe(start + days(33));
    expect(canShowGetVerifiedCard(twice, start + days(20))).toBe(false);
    expect(canShowGetVerifiedCard(twice, start + days(33))).toBe(true);
    const afterSnooze = recordGetVerifiedCardDismissal(twice, start + days(33));
    expect(afterSnooze.snoozedUntil).toBe(twice.snoozedUntil);
    expect(afterSnooze.dismissalsSinceSnooze).toBe(1);
  });

  it("never shows again after Don't show again", () => {
    const never = recordGetVerifiedCardNeverAgain(emptyGetVerifiedCardHistory);
    expect(canShowGetVerifiedCard(never, start + days(400))).toBe(false);
  });

  it("surfaces each discount offer only once", () => {
    expect(offerIdsNotYetSurfaced(emptyGetVerifiedCardHistory, ["offer-1", "offer-2"])).toEqual(["offer-1", "offer-2"]);
    const surfaced = recordOffersSurfaced(emptyGetVerifiedCardHistory, ["offer-1"]);
    expect(offerIdsNotYetSurfaced(surfaced, ["offer-1", "offer-2"])).toEqual(["offer-2"]);
    expect(recordOffersSurfaced(surfaced, ["offer-1"]).surfacedOfferIds).toEqual(["offer-1"]);
  });
});
