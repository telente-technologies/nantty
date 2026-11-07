import { describe, expect, it, vi } from "vitest";

import type { HandlerContext } from "../../src/types/handlerContext.type.js";
import { deterministicDomainEventId } from "../../src/events/outbox.event.js";
import { runStreakExpiryReminders } from "../../src/jobs/streakExpiryReminders.job.js";

const conversationId = "0192f0a1-7c3e-7000-8000-00000000c1a4";
const now = new Date("2026-11-07T20:30:00.000Z");

function context(options: {
  readonly reminderEnabled?: Readonly<Record<string, boolean>>;
  readonly timeZones?: Readonly<Record<string, string>>;
  readonly sent?: readonly { conversationId: string; accountId: string; localDay: string }[];
} = {}) {
  const inserted = new Map<string, Record<string, unknown>>();
  const activeRows = [{
    conversationId,
    count: 7,
    lastCompletedDay: "2026-11-06",
    conversation: { members: [{ accountId: "u1" }, { accountId: "u2" }] },
  }];
  const findManyStreaks = vi.fn(async () => activeRows);
  const fake = {
    database: {
      client: {
        chatStreak: { findMany: findManyStreaks },
        chatSettings: {
          findMany: async () => ["u1", "u2"].map((accountId) => ({
            accountId,
            timezone: options.timeZones?.[accountId] ?? "UTC",
            notifyStreakReminders: options.reminderEnabled?.[accountId] ?? true,
          })),
        },
        streakSenderDay: { findMany: async () => [...(options.sent ?? [])] },
      },
      transaction: async (work: (transaction: unknown) => Promise<void>) => work({
        outboxEvent: {
          createMany: async ({ data }: { readonly data: readonly Record<string, unknown>[] }) => {
            for (const row of data) inserted.set(String(row.id), row);
            return { count: data.length };
          },
        },
      }),
    },
    clock: { now: () => now },
  } as unknown as HandlerContext;
  return { context: fake, inserted, findManyStreaks };
}

describe("streak expiry reminder sweep", () => {
  it("queues one reminder per opted-in participant who has not messaged on their local day", async () => {
    const fixture = context({
      timeZones: { u1: "UTC", u2: "Africa/Lagos" },
      sent: [{ conversationId, accountId: "u2", localDay: "2026-11-07" }],
    });

    expect(await runStreakExpiryReminders(fixture.context, now)).toBe(1);
    const rows = [...fixture.inserted.values()];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ eventType: "streak.reminderDue", subject: conversationId });
    expect(rows[0]?.payload).toMatchObject({ data: { accountId: "u1", conversationId, count: 7, localDay: "2026-11-07" } });
  });

  it("honors the participant reminder preference and stable outbox IDs make repeat sweeps idempotent", async () => {
    const fixture = context({ reminderEnabled: { u1: false, u2: false } });
    expect(await runStreakExpiryReminders(fixture.context, now)).toBe(1);
    expect(fixture.inserted.size).toBe(0);

    const enabled = context({ timeZones: { u1: "UTC", u2: "UTC" } });
    await runStreakExpiryReminders(enabled.context, now);
    const firstIds = [...enabled.inserted.keys()].sort();
    expect(firstIds).toHaveLength(2);
    expect(await runStreakExpiryReminders(enabled.context, now)).toBe(1);
    expect([...enabled.inserted.keys()].sort()).toEqual(firstIds);
    expect(enabled.findManyStreaks).toHaveBeenCalledTimes(2);
  });

  it("does not alert before the existing four-hour hourglass window or after the streak day was already missed", async () => {
    const fixture = context({ timeZones: { u1: "UTC", u2: "UTC" } });
    expect(await runStreakExpiryReminders(fixture.context, new Date("2026-11-07T19:59:00.000Z"))).toBe(1);
    expect(fixture.inserted.size).toBe(0);

    const missed = context({ timeZones: { u1: "UTC", u2: "UTC" } });
    const row = (missed.context.database.client as unknown as { chatStreak: { findMany: () => Promise<unknown[]> } }).chatStreak;
    vi.mocked(row.findMany).mockResolvedValueOnce([{
      conversationId,
      count: 7,
      lastCompletedDay: "2026-11-05",
      conversation: { members: [{ accountId: "u1" }, { accountId: "u2" }] },
    }]);
    expect(await runStreakExpiryReminders(missed.context, now)).toBe(1);
    expect(missed.inserted.size).toBe(0);
  });

  it("generates stable UUID-form event IDs from the logical reminder key", () => {
    const key = `streak.reminderDue:${conversationId}:u1:2026-11-07`;
    const id = deterministicDomainEventId(key);
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(deterministicDomainEventId(key)).toBe(id);
    expect(deterministicDomainEventId(`${key}:different`)).not.toBe(id);
  });
});
