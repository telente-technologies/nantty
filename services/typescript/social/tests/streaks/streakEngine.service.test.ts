import { describe, expect, it } from "vitest";

import { buildStreakView, completeStreakDay, emptyStreak, evaluateStreakAt, restoreBrokenStreak, restoresAllowedPerMonth, type StreakParticipants, type StreakSnapshot } from "../../src/modules/streaks/services/streakEngine.service.js";

const utc: StreakParticipants = { viewerTimeZone: "UTC", peerTimeZone: "UTC" };
const lagosAndLa: StreakParticipants = { viewerTimeZone: "Africa/Lagos", peerTimeZone: "America/Los_Angeles" };
const at = (iso: string) => new Date(iso);

function active(count: number, lastCompletedDay: string): StreakSnapshot {
  return { ...emptyStreak, count, state: "active", lastCompletedDay };
}

describe("completeStreakDay", () => {
  it("starts at 1 and continues on consecutive days", () => {
    const first = completeStreakDay(emptyStreak, "2026-10-01", at("2026-10-01T12:00:00Z"), utc);
    expect(first.snapshot.count).toBe(1);
    const second = completeStreakDay(first.snapshot, "2026-10-02", at("2026-10-02T12:00:00Z"), utc);
    expect(second.snapshot.count).toBe(2);
  });
  it("does not double count the same day", () => {
    const again = completeStreakDay(active(5, "2026-10-02"), "2026-10-02", at("2026-10-02T20:00:00Z"), utc);
    expect(again.snapshot.count).toBe(5);
  });
  it("reports a milestone every 100 days", () => {
    expect(completeStreakDay(active(99, "2026-10-02"), "2026-10-03", at("2026-10-03T09:00:00Z"), utc).milestoneReached).toBe(100);
    expect(completeStreakDay(active(100, "2026-10-02"), "2026-10-03", at("2026-10-03T09:00:00Z"), utc).milestoneReached).toBeNull();
    expect(completeStreakDay(active(199, "2026-10-02"), "2026-10-03", at("2026-10-03T09:00:00Z"), utc).milestoneReached).toBe(200);
  });
  it("starts over after a missed day", () => {
    const result = completeStreakDay(active(7, "2026-10-01"), "2026-10-04", at("2026-10-04T09:00:00Z"), utc);
    expect(result.snapshot.count).toBe(1);
  });
});

describe("evaluateStreakAt", () => {
  it("stays active while the slowest zone is still inside the next day", () => {
    const state = evaluateStreakAt(active(4, "2026-10-01"), at("2026-10-03T05:00:00Z"), lagosAndLa);
    expect(state.state).toBe("active");
  });
  it("breaks once the slowest zone has finished the missed day", () => {
    const state = evaluateStreakAt(active(4, "2026-10-01"), at("2026-10-03T08:00:00Z"), lagosAndLa);
    expect(state.state).toBe("broken");
    expect(state.countBeforeBreak).toBe(4);
    expect(state.brokenAt?.toISOString()).toBe("2026-10-03T07:00:00.000Z");
    expect(state.restorableUntil?.toISOString()).toBe("2026-10-05T07:00:00.000Z");
  });
  it("forgets a broken streak after the restore window", () => {
    const broken = evaluateStreakAt(active(4, "2026-10-01"), at("2026-10-03T08:00:00Z"), lagosAndLa);
    const expired = evaluateStreakAt(broken, at("2026-10-05T08:00:00Z"), lagosAndLa);
    expect(expired.state).toBe("none");
    expect(expired.count).toBe(0);
  });
});

describe("restoring", () => {
  it("brings the old count back and lets today still complete", () => {
    const now = at("2026-10-03T08:00:00Z");
    const broken = evaluateStreakAt(active(12, "2026-10-01"), now, utc);
    expect(broken.state).toBe("broken");
    const restored = restoreBrokenStreak(broken, now, utc);
    expect(restored).toMatchObject({ count: 12, state: "active", lastCompletedDay: "2026-10-02" });
    expect(completeStreakDay(restored, "2026-10-03", now, utc).snapshot.count).toBe(13);
  });
  it("allows 3 restores a month, or 6 for Premium", () => {
    expect(restoresAllowedPerMonth(false)).toBe(3);
    expect(restoresAllowedPerMonth(true)).toBe(6);
  });
});

describe("buildStreakView", () => {
  const view = (now: string, used: number, premium = false) =>
    buildStreakView({ snapshot: active(9, "2026-10-02"), now: at(now), participants: utc, viewerSentToday: false, peerSentToday: true, restoresUsedThisMonth: used, viewerIsPremium: premium, pendingCelebrationDays: null });
  it("shows the hourglass in the last four hours of the day", () => {
    expect(view("2026-10-03T19:00:00Z", 0).hourglass).toBe(false);
    expect(view("2026-10-03T20:30:00Z", 0).hourglass).toBe(true);
  });
  it("counts remaining restores", () => {
    expect(view("2026-10-03T10:00:00Z", 2)).toMatchObject({ restoresRemaining: 1, restoresPerMonth: 3 });
    expect(view("2026-10-03T10:00:00Z", 6, true).restoresRemaining).toBe(0);
  });
  it("exposes the broken state with its restore window", () => {
    const result = buildStreakView({ snapshot: active(30, "2026-10-01"), now: at("2026-10-03T08:00:00Z"), participants: utc, viewerSentToday: false, peerSentToday: false, restoresUsedThisMonth: 0, viewerIsPremium: false, pendingCelebrationDays: 100 });
    expect(result).toMatchObject({ state: "broken", count: 0, countBeforeBreak: 30, milestoneCelebrationPending: true, milestoneDays: 100 });
    expect(result.restorableUntil).toBe("2026-10-05T00:00:00.000Z");
  });
});
