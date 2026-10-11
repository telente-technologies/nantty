import { advanceClipWatchSession, createClipWatchSession, summarizeClipWatchSession } from "../clipWatchSession.util";
import { advanceImpressionSession, createImpressionSession, endImpressionSession, visibleFractionOf } from "../impressionSession.util";
import { isContentOwnedBy } from "../postOwnership.util";

describe("post impressions", () => {
  it("needs at least half the post visible for a full second", () => {
    const session = createImpressionSession();
    expect(advanceImpressionSession(session, 0.6, 0)).toBeNull();
    expect(advanceImpressionSession(session, 0.6, 900)).toBeNull();
    expect(advanceImpressionSession(session, 0.6, 1000)).toEqual({ kind: "view" });
    expect(advanceImpressionSession(session, 0.9, 1500)).toBeNull();
    expect(advanceImpressionSession(session, 0.1, 4000)).toEqual({ kind: "dwell", dwellMs: 4000 });
  });

  it("does not count a fast scroll past", () => {
    const session = createImpressionSession();
    expect(advanceImpressionSession(session, 1, 0)).toBeNull();
    expect(advanceImpressionSession(session, 0.2, 600)).toBeNull();
    expect(advanceImpressionSession(session, 1, 700)).toBeNull();
    expect(endImpressionSession(session, 1200)).toBeNull();
  });

  it("measures how much of a frame is on screen, letting tall posts qualify", () => {
    const viewport = { width: 400, height: 800 };
    expect(visibleFractionOf({ x: 0, y: 0, width: 400, height: 400 }, viewport)).toBe(1);
    expect(visibleFractionOf({ x: 0, y: 600, width: 400, height: 400 }, viewport)).toBe(0.5);
    expect(visibleFractionOf({ x: 400, y: 0, width: 400, height: 400 }, viewport)).toBe(0);
    expect(visibleFractionOf({ x: 0, y: -100, width: 400, height: 2000 }, viewport)).toBe(1);
    expect(visibleFractionOf({ x: 0, y: 0, width: 0, height: 0 }, viewport)).toBe(0);
  });
});

describe("clip watch sessions", () => {
  it("adds natural playback, counts loops and reports a full watch", () => {
    const session = createClipWatchSession();
    for (const second of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9.5, 0.5, 1.5]) advanceClipWatchSession(session, second, 10);
    expect(summarizeClipWatchSession(session, 10)).toEqual({ watchMs: 11_500, durationMs: 10_000, watchFraction: 1, loopCount: 1 });
  });

  it("ignores seeks forward and reports the furthest point reached", () => {
    const session = createClipWatchSession();
    for (const second of [0, 1, 2, 30, 31]) advanceClipWatchSession(session, second, 60);
    expect(summarizeClipWatchSession(session, 60)).toMatchObject({ watchMs: 3000, watchFraction: 0.517, loopCount: 0 });
  });
});

describe("post ownership", () => {
  const post = { author: { id: "me" }, postedAs: { id: "brand" } };
  it("treats the author and the acting brand as owners", () => {
    expect(isContentOwnedBy(post, "me", null)).toBe(true);
    expect(isContentOwnedBy({ author: { id: "teammate" }, postedAs: { id: "brand" } }, "me", "brand")).toBe(true);
    expect(isContentOwnedBy({ author: { id: "teammate" }, postedAs: null }, "me", "brand")).toBe(false);
    expect(isContentOwnedBy(post, null, null)).toBe(false);
  });
});
