import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ViewerCelebrations } from "@/types/celebrations.type";

import { anniversaryMessage, birthdayMessage, celebrationSeenKey, ordinal, pickCelebration } from "./celebrations.util";

const none = { app: false, profile: false };
const base: ViewerCelebrations = {
  timezone: "Africa/Lagos", timezoneConfigured: true, localDate: "2026-10-04", birthdayBalloonsVisible: true,
  birthday: { today: false, shown: none }, anniversary: { today: false, shown: none },
};

describe("celebration copy", () => {
  it("builds ordinals", () => {
    assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal), ["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th"]);
  });

  it("writes the warm birthday message with the age and first name", () => {
    assert.equal(birthdayMessage("Ada Obi", 25).message, "Happy 25th birthday, Ada! Wishing you an amazing year ahead from all of us at Nantty.");
  });

  it("writes the Zudoversary message", () => {
    assert.equal(anniversaryMessage(2).message, "Happy 2nd Zudoversary! Thanks for being part of Nantty for 2 years.");
    assert.ok(anniversaryMessage(1).message.endsWith("for 1 year."));
  });
});

describe("once per day per surface", () => {
  it("shows nothing without a celebration", () => {
    assert.equal(pickCelebration(base, "app", "Ada"), null);
  });

  it("prefers the birthday and skips surfaces already shown", () => {
    const both: ViewerCelebrations = { ...base, birthday: { today: true, age: 25, shown: none }, anniversary: { today: true, years: 2, shown: none } };
    assert.equal(pickCelebration(both, "app", "Ada")?.kind, "birthday");
    const appShown: ViewerCelebrations = { ...both, birthday: { today: true, age: 25, shown: { app: true, profile: false } } };
    assert.equal(pickCelebration(appShown, "app", "Ada")?.kind, "anniversary");
    assert.equal(pickCelebration(appShown, "profile", "Ada")?.kind, "birthday");
  });

  it("scopes local memory by account, kind, surface and local date", () => {
    assert.notEqual(celebrationSeenKey("a1", "birthday", "app", "2026-10-04"), celebrationSeenKey("a1", "birthday", "app", "2026-10-05"));
    assert.notEqual(celebrationSeenKey("a1", "birthday", "app", "2026-10-04"), celebrationSeenKey("a1", "birthday", "profile", "2026-10-04"));
  });
});
