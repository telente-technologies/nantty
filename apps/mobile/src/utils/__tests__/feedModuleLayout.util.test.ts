import type { FeedModuleKind } from "@/constants/feedModules.constant";

import { interleaveFeedModules, planFeedModuleSlots, takeChunkForOccurrence } from "../feedModuleLayout.util";

const everything = () => true;
const only = (...kinds: FeedModuleKind[]) => (kind: FeedModuleKind) => kinds.includes(kind);
const positionsOf = (slots: ReturnType<typeof planFeedModuleSlots>, kind: FeedModuleKind) => slots.filter((slot) => slot.kind === kind).map((slot) => slot.afterPostCount);

describe("feed module cadence", () => {
  it("shows suggested clips first after 6 posts and then every 18", () => {
    const slots = planFeedModuleSlots({ postCount: 80, isModuleEnabled: only("suggestedClips") });
    expect(positionsOf(slots, "suggestedClips")).toEqual([6, 24, 42, 60, 78]);
    expect(slots.map((slot) => slot.occurrence)).toEqual([0, 1, 2, 3, 4]);
  });

  it("shows people you may know after 10 posts and then every 30, and the verified card once", () => {
    const slots = planFeedModuleSlots({ postCount: 100, isModuleEnabled: only("peopleYouMayKnow", "getVerified") });
    expect(positionsOf(slots, "peopleYouMayKnow")).toEqual([10, 40, 70]);
    expect(positionsOf(slots, "getVerified")).toEqual([3]);
  });

  it("never places two modules back to back", () => {
    const slots = planFeedModuleSlots({
      postCount: 200,
      isModuleEnabled: everything,
      cadence: {
        getVerified: { firstAfterPosts: 5, repeatEveryPosts: null },
        suggestedClips: { firstAfterPosts: 5, repeatEveryPosts: 10 },
        peopleYouMayKnow: { firstAfterPosts: 5, repeatEveryPosts: 10 },
        productsYouMightLike: { firstAfterPosts: 8, repeatEveryPosts: 12 },
      },
    });
    const positions = slots.map((slot) => slot.afterPostCount);
    for (let index = 1; index < positions.length; index++) expect(positions[index]! - positions[index - 1]!).toBeGreaterThanOrEqual(1);
    expect(new Set(positions).size).toBe(positions.length);
    const rows = interleaveFeedModules(Array.from({ length: 200 }, (_, index) => `p${index}`), slots);
    for (let index = 1; index < rows.length; index++) expect(rows[index]!.type === "module" && rows[index - 1]!.type === "module").toBe(false);
  });

  it("never puts a module after the last loaded post", () => {
    expect(planFeedModuleSlots({ postCount: 6, isModuleEnabled: only("suggestedClips") })).toEqual([]);
    expect(positionsOf(planFeedModuleSlots({ postCount: 7, isModuleEnabled: only("suggestedClips") }), "suggestedClips")).toEqual([6]);
  });

  it("respects hidden modules and skips occurrences that have nothing fresh to show", () => {
    expect(planFeedModuleSlots({ postCount: 100, isModuleEnabled: only("peopleYouMayKnow") }).some((slot) => slot.kind === "suggestedClips")).toBe(false);
    const slots = planFeedModuleSlots({ postCount: 100, isModuleEnabled: only("suggestedClips"), isOccurrenceAvailable: (_, occurrence) => occurrence < 2 });
    expect(positionsOf(slots, "suggestedClips")).toEqual([6, 24]);
  });

  it("keeps earlier modules where they were as more posts load", () => {
    const early = planFeedModuleSlots({ postCount: 30, isModuleEnabled: everything });
    const later = planFeedModuleSlots({ postCount: 90, isModuleEnabled: everything });
    expect(later.slice(0, early.length)).toEqual(early);
  });

  it("inserts module rows after the right number of posts", () => {
    const rows = interleaveFeedModules(["a", "b", "c", "d"], [{ kind: "suggestedClips", occurrence: 0, afterPostCount: 2 }]);
    expect(rows.map((row) => (row.type === "post" ? row.post : row.slot.kind))).toEqual(["a", "b", "suggestedClips", "c", "d"]);
  });
});

describe("fresh clips for each rail", () => {
  it("gives each rail its own clips so nothing repeats across rails", () => {
    const stream = Array.from({ length: 20 }, (_, index) => index);
    const first = takeChunkForOccurrence(stream, 0, 8);
    const second = takeChunkForOccurrence(stream, 1, 8);
    const third = takeChunkForOccurrence(stream, 2, 8);
    expect(first).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(second.some((clip) => first.includes(clip))).toBe(false);
    expect(third).toEqual([16, 17, 18, 19]);
    expect(takeChunkForOccurrence(stream, 3, 8)).toEqual([]);
  });
});
