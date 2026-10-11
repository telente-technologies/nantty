import { beforeEach, describe, expect, it, vi } from "vitest";

const state = { claimed: false, restoresRecorded: 0, outboxWrites: 0 };
const brokenRow = { conversationId: "c1", count: 0, state: "broken", lastCompletedDay: "2026-10-01", countBeforeBreak: 12, brokenAt: new Date("2026-10-04T00:00:00Z"), restorableUntil: new Date("2026-10-06T00:00:00Z"), updatedAt: new Date("2026-10-04T00:00:00Z") };

vi.mock("../../src/modules/conversations/services/conversationAccess.service.js", () => ({
  requireConversationMember: async () => ({ conversation: { kind: "direct", members: [{ accountId: "viewer" }, { accountId: "peer" }] } }),
  findDirectPeerId: () => "peer",
}));
vi.mock("../../src/modules/streaks/services/streakTracking.service.js", async (original) => ({
  ...(await original<object>()),
  loadStreakParticipants: async () => ({ viewerTimeZone: "UTC", peerTimeZone: "UTC" }),
  buildStreakViewForViewer: async () => ({ state: "active" }),
}));
vi.mock("../../src/events/outbox.event.js", () => ({ appendDomainEventsToOutbox: async () => { state.outboxWrites += 1; } }));
vi.mock("../../src/modules/streaks/repositories/streak.repository.js", () => ({
  streakRepository: {
    find: async () => brokenRow,
    restoresUsedInMonth: async () => state.restoresRecorded,
    saveIfUnchanged: async () => {
      if (state.claimed) return false;
      state.claimed = true;
      return true;
    },
    recordRestore: async () => { state.restoresRecorded += 1; },
  },
}));

const { createRestoreStreakHandler } = await import("../../src/modules/streaks/commands/restoreStreak/restoreStreak.handler.js");

describe("restore streak", () => {
  beforeEach(() => { state.claimed = false; state.restoresRecorded = 0; state.outboxWrites = 0; });

  it("restores a broken streak once when two restores race", async () => {
    const context = {
      database: { client: {}, transaction: async (work: (db: object) => Promise<unknown>) => work({}) },
      clock: { now: () => new Date("2026-10-05T10:00:00Z") },
      premium: { isPremium: async () => true },
    };
    const restore = createRestoreStreakHandler(context as never);
    const results = await Promise.allSettled([restore({ viewerId: "viewer", conversationId: "c1" }), restore({ viewerId: "viewer", conversationId: "c1" })]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { code: "NOTHING_TO_RESTORE" } });
    expect(state.restoresRecorded).toBe(1);
    expect(state.outboxWrites).toBe(1);
  });
});
