import { describe, expect, it } from "vitest";

import { parseDomainEventEnvelope } from "../src/modules/eventIngestion/validators/domainEvent.validator.js";

const envelope = (type: string) => ({ id: "01a1047b-9c1d-718d-b306-ebb2412688f0", type, source: "nantty.users", subject: "s", occurredAt: "2026-10-04T01:16:12Z", data: { accountId: "a" } });

describe("domain event envelope", () => {
  it.each(["account.registered", "creatorApplication.submitted", "payoutAccount.created", "dataExport.completed", "orderGroup.refundRequested"])("accepts %s", (type) => {
    expect(parseDomainEventEnvelope(envelope(type))?.type).toBe(type);
  });

  it.each(["Account.registered", "account", "account.registered.v2", "account-registered"])("rejects %s", (type) => {
    expect(parseDomainEventEnvelope(envelope(type))).toBeNull();
  });
});
