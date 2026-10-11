import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { LiveSession } from "@/types";
import type { AccountHealthSummary } from "@/types/accountHealth.type";
import { buildCreatorNextActions } from "@/utils/creatorNextActions.util";

const ngn = (amountMinor: number) => ({ amountMinor, currency: "NGN" });
const health = (change: Partial<AccountHealthSummary> = {}): AccountHealthSummary => ({
  status: "GOOD_STANDING", restrictions: [], canMonetise: true, canGoLive: true, activeStrikeCount: 0, restrictionThreshold: 3, pendingTakedownCount: 0, strikeLifetimeDays: 90, warnings: [], notices: [], ...change,
});
const live = (state: LiveSession["state"]): LiveSession => ({ id: "live_9", title: "Now", category: "music", state, createdAt: "", startedAt: null, endedAt: null, viewers: 0, peakViewers: 0, hlsUrl: null, earnings: { coins: 0, giftCount: 0, topGifters: [] } });

describe("creator next actions", () => {
  it("returns nothing while data is still loading", () => {
    assert.deepEqual(buildCreatorNextActions({}), []);
  });

  it("puts a live session and takedown deadline first", () => {
    const actions = buildCreatorNextActions({ lives: [live("live")], health: health({ notices: [{ claimId: "c1", state: "AWAITING_REMOVAL", deadlineAt: new Date().toISOString() }] }) });
    assert.deepEqual(actions.slice(0, 2).map((action) => action.key), ["live-now", "notice-c1"]);
    assert.ok(actions.every((action) => action.href.length > 0));
  });

  it("explains paused earning and going live", () => {
    const [action] = buildCreatorNextActions({ health: health({ canMonetise: false, canGoLive: false, activeStrikeCount: 3 }) });
    assert.equal(action?.key, "restricted");
    assert.match(action?.title ?? "", /earning and going live/);
  });

  it("asks to fix payouts before offering a withdrawal", () => {
    const wallet = { available: ngn(5000), pending: ngn(0), verification: { level: 0, withdrawalsUnlocked: false, waitingForVerification: ngn(5000), nextStep: "payout_setup", message: "Verify to withdraw ₦50" } };
    assert.equal(buildCreatorNextActions({ wallet })[0]?.key, "payout-verify");
    const unlocked = { ...wallet, verification: { ...wallet.verification, withdrawalsUnlocked: true, message: null } };
    assert.equal(buildCreatorNextActions({ wallet: unlocked })[0]?.key, "withdraw");
  });

  it("suggests a tier and a first live only when there are none", () => {
    const keys = buildCreatorNextActions({ plans: [], lives: [] }).map((action) => action.key);
    assert.deepEqual(keys, ["plan", "first-live"]);
    assert.deepEqual(buildCreatorNextActions({ plans: [{ id: "p", name: "x", description: "", price: ngn(1), interval: "month", benefits: [], subscriberCount: 0, active: true }], lives: [live("ended")] }), []);
  });
});
