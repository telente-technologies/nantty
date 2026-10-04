import type { ViewerCelebrations } from "@/types/celebrations.type";

import { anniversaryMessage, birthdayMessage, celebrationSeenKey, ordinal, pickCelebration } from "../celebrations.util";

const none = { app: false, profile: false };
const base: ViewerCelebrations = {
  timezone: "Africa/Lagos", timezoneConfigured: true, localDate: "2026-10-04", birthdayBalloonsVisible: true,
  birthday: { today: false, shown: none }, anniversary: { today: false, shown: none },
};

describe("celebration copy", () => {
  it("builds ordinals", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 101, 111].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "23rd", "101st", "111th"]);
  });

  it("writes the warm birthday message with the age and first name", () => {
    expect(birthdayMessage("Ada Obi", 25).message).toBe("Happy 25th birthday, Ada! Wishing you an amazing year ahead from all of us at Zudomart.");
  });

  it("writes the Zudoversary message", () => {
    expect(anniversaryMessage(2).message).toBe("Happy 2nd Zudoversary! Thanks for being part of Zudomart for 2 years.");
    expect(anniversaryMessage(1).message).toContain("for 1 year.");
  });
});

describe("once per day per surface", () => {
  it("shows nothing when there is no celebration", () => {
    expect(pickCelebration(base, "app", "Ada")).toBeNull();
  });

  it("shows the birthday first, and only on surfaces not yet shown", () => {
    const both: ViewerCelebrations = { ...base, birthday: { today: true, age: 25, shown: none }, anniversary: { today: true, years: 2, shown: none } };
    expect(pickCelebration(both, "app", "Ada")?.kind).toBe("birthday");
    const appShown: ViewerCelebrations = { ...both, birthday: { today: true, age: 25, shown: { app: true, profile: false } } };
    expect(pickCelebration(appShown, "app", "Ada")?.kind).toBe("anniversary");
    expect(pickCelebration(appShown, "profile", "Ada")?.kind).toBe("birthday");
    const allShown: ViewerCelebrations = { ...both, birthday: { today: true, age: 25, shown: { app: true, profile: true } }, anniversary: { today: true, years: 2, shown: { app: true, profile: true } } };
    expect(pickCelebration(allShown, "app", "Ada")).toBeNull();
  });

  it("merges client-known stats into the anniversary card and drops zeros", () => {
    const anniversary: ViewerCelebrations = { ...base, anniversary: { today: true, years: 2, shown: none, stats: { followers: 1260, orders: 0 } } };
    expect(pickCelebration(anniversary, "app", "Ada", { posts: 148 })?.stats).toEqual([{ label: "Posts", value: "148" }, { label: "Followers gained", value: "1,260" }]);
  });

  it("scopes the local memory by account, kind, surface and local date", () => {
    expect(celebrationSeenKey("a1", "birthday", "app", "2026-10-04")).not.toBe(celebrationSeenKey("a1", "birthday", "app", "2026-10-05"));
    expect(celebrationSeenKey("a1", "birthday", "app", "2026-10-04")).not.toBe(celebrationSeenKey("a1", "birthday", "profile", "2026-10-04"));
  });
});
