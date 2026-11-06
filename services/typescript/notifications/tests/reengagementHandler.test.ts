import { describe, expect, it } from "vitest";

import type { ReengagementRepository, ReengagementWorkItem } from "../src/interfaces/reengagementRepository.interface.js";
import type { NotificationDispatcherService } from "../src/modules/delivery/services/notificationDispatcher.service.js";
import { ProcessReengagementHandler } from "../src/modules/reengagement/commands/processReengagement/processReengagement.handler.js";
import { createTestHarness } from "./fakes/testHarness.fake.js";
import { makeRecipient } from "./fakes/inMemoryServices.fake.js";

class ReengagementRepositoryFake implements ReengagementRepository {
  public item: ReengagementWorkItem;
  public claimed = false;
  public readonly outcomes: { status: string; reason?: string }[] = [];

  public constructor(lastActivityAt: Date, timeZone = "Africa/Lagos") {
    this.item = {
      id: "delivery-1", accountId: "u1", campaignId: "inactive-user-v1", contentKey: "generic-return-v1",
      dedupeKey: "u1:inactive-user-v1:generic-return-v1", activityAt: lastActivityAt, status: "pending",
      activity: { accountId: "u1", lastActivityAt, timeZone, lastReengagementAttemptAt: null },
    };
  }

  public async recordActivity() {}
  public async createDueDeliveries() { return 0; }
  public async listPending() { return [this.item]; }
  public async leaseForQueue() { return true; }
  public async releaseQueueLease() {}
  public async findWorkItem() { return this.item; }
  public async skipPending(_id: string, reason: string) { this.outcomes.push({ status: "skipped", reason }); this.item = { ...this.item, status: "skipped" }; }
  public async claimDispatch() {
    if (this.claimed || this.item.status !== "pending") return "already_claimed" as const;
    this.claimed = true;
    this.item = { ...this.item, status: "dispatching" };
    return "claimed" as const;
  }
  public async finish(_id: string, status: "sent" | "skipped" | "failed", reason?: string) {
    this.outcomes.push({ status, ...(reason === undefined ? {} : { reason }) });
    this.item = { ...this.item, status };
  }
}

describe("ProcessReengagementHandler", () => {
  it("requires explicit marketing consent and marketing push preference", async () => {
    const harness = createTestHarness();
    const repository = new ReengagementRepositoryFake(new Date("2026-10-01T12:00:00.000Z"));
    harness.clock.current = new Date("2026-11-06T12:00:00.000Z");
    harness.identity.add(makeRecipient({ accountId: "u1", marketingConsent: false, pushEnabled: true }));
    const handler = new ProcessReengagementHandler({ repository, identity: harness.identity, preferences: harness.preferences, dispatcher: harness.dispatcher, quietHours: { quietHoursStart: "21:00", quietHoursEnd: "08:00" }, now: harness.now });
    await handler.execute({ deliveryId: "delivery-1" });
    expect(repository.outcomes).toEqual([{ status: "skipped", reason: "marketing_consent_or_account_ineligible" }]);
    expect(harness.pushSender.sent).toHaveLength(0);

    repository.item = { ...repository.item, status: "pending" };
    harness.identity.accounts.set("u1", makeRecipient({ accountId: "u1", marketingConsent: true, pushEnabled: true }));
    await handler.execute({ deliveryId: "delivery-1" });
    expect(repository.outcomes.at(-1)).toEqual({ status: "skipped", reason: "marketing_push_preference_disabled" });
    expect(harness.pushSender.sent).toHaveLength(0);
  });

  it("sends one generic push outside quiet hours and does not replay a processed item", async () => {
    const harness = createTestHarness();
    const repository = new ReengagementRepositoryFake(new Date("2026-10-01T12:00:00.000Z"));
    harness.clock.current = new Date("2026-11-06T12:00:00.000Z");
    harness.identity.add(makeRecipient({ accountId: "u1", marketingConsent: true, pushEnabled: true }));
    await harness.preferences.upsert("u1", "marketing", { push: true });
    await harness.deviceTokens.register("u1", "ExponentPushToken[valid-token]", "ios");
    const handler = new ProcessReengagementHandler({ repository, identity: harness.identity, preferences: harness.preferences, dispatcher: harness.dispatcher, quietHours: { quietHoursStart: "21:00", quietHoursEnd: "08:00" }, now: harness.now });
    await handler.execute({ deliveryId: "delivery-1" });
    await handler.execute({ deliveryId: "delivery-1" });
    expect(harness.pushSender.sent).toHaveLength(1);
    expect(harness.pushSender.sent[0]?.content.body).toBe("There’s more to explore on Nantty whenever you’re ready.");
    expect(repository.item.status).toBe("sent");
  });

  it("leaves a due candidate pending during recipient-local quiet hours", async () => {
    const harness = createTestHarness();
    const repository = new ReengagementRepositoryFake(new Date("2026-10-01T12:00:00.000Z"));
    harness.clock.current = new Date("2026-11-06T21:30:00.000Z");
    harness.identity.add(makeRecipient({ accountId: "u1", marketingConsent: true, pushEnabled: true }));
    await harness.preferences.upsert("u1", "marketing", { push: true });
    const handler = new ProcessReengagementHandler({ repository, identity: harness.identity, preferences: harness.preferences, dispatcher: harness.dispatcher, quietHours: { quietHoursStart: "21:00", quietHoursEnd: "08:00" }, now: harness.now });
    await handler.execute({ deliveryId: "delivery-1" });
    expect(repository.claimed).toBe(false);
    expect(repository.item.status).toBe("pending");
    expect(harness.pushSender.sent).toHaveLength(0);
  });

  it("does not replay an uncertain provider result after dispatch has been claimed", async () => {
    const harness = createTestHarness();
    const repository = new ReengagementRepositoryFake(new Date("2026-10-01T12:00:00.000Z"));
    harness.clock.current = new Date("2026-11-06T12:00:00.000Z");
    harness.identity.add(makeRecipient({ accountId: "u1", marketingConsent: true, pushEnabled: true }));
    await harness.preferences.upsert("u1", "marketing", { push: true });
    let sends = 0;
    const dispatcher = { dispatch: async () => { sends += 1; throw new Error("provider outcome uncertain"); } } as unknown as NotificationDispatcherService;
    const handler = new ProcessReengagementHandler({ repository, identity: harness.identity, preferences: harness.preferences, dispatcher, quietHours: { quietHoursStart: "21:00", quietHoursEnd: "08:00" }, now: harness.now });
    await handler.execute({ deliveryId: "delivery-1" });
    await handler.execute({ deliveryId: "delivery-1" });
    expect(sends).toBe(1);
    expect(repository.item.status).toBe("failed");
    expect(repository.outcomes.at(-1)).toEqual({ status: "failed", reason: "provider_outcome_uncertain" });
  });
});
