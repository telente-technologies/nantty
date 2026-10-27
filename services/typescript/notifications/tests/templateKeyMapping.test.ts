import { testOtpKey } from "./fixtures/eventFixtures.fixture.js";
import { isEmailTemplateKey, renderEmail } from "@nantty/email-templates";
import { describe, expect, it } from "vitest";

import { eventMappings, domainEventTypesConsumed } from "../src/modules/eventIngestion/mappings/eventMappingRegistry.js";
import { EventDataReader } from "../src/utils/eventDataReader.util.js";
import { eventFixtures } from "./fixtures/eventFixtures.fixture.js";
import { makeEvent } from "./fakes/testHarness.fake.js";
import { makeRecipient } from "./fakes/inMemoryServices.fake.js";

const context = { webBaseUrl: "https://nantty.com", sellerDashboardUrl: "https://dashboard.nantty.com", otpEnvelopeKeys: { "otp-1": testOtpKey } };

describe("event type to notification and template mapping", () => {
  it("has a fixture for every mapped event type", () => {
    expect(Object.keys(eventFixtures).sort()).toEqual(Object.keys(eventMappings).sort());
  });

  it("consumes the policy publication event as well", () => {
    expect(domainEventTypesConsumed).toContain("policyVersion.published");
  });

  it.each(Object.entries(eventFixtures))("%s", async (type, fixture) => {
    const mapping = eventMappings[type];
    expect(mapping).toBeDefined();
    const intents = mapping!(makeEvent(type, fixture.data), new EventDataReader(fixture.data), context);
    expect(intents.filter((intent) => intent.inApp !== undefined).map((intent) => intent.recipientUserId)).toEqual(fixture.inAppRecipients);
    const plans = intents.flatMap((intent) => (intent.email === undefined ? [] : [intent.email(makeRecipient({ accountId: intent.recipientUserId }))]));
    expect(plans.map((plan) => plan.templateKey)).toEqual(fixture.templates);
    for (const plan of plans) {
      expect(isEmailTemplateKey(plan.templateKey)).toBe(true);
      const rendered = await renderEmail(plan.templateKey, plan.props as never);
      expect(rendered.subject.length).toBeGreaterThan(0);
      expect(rendered.text.length).toBeGreaterThan(0);
    }
  });

  it("gives every intent a unique variant per recipient so one event never collides with itself", () => {
    for (const [type, fixture] of Object.entries(eventFixtures)) {
      const intents = eventMappings[type]!(makeEvent(type, fixture.data), new EventDataReader(fixture.data), context);
      const keys = intents.map((intent) => `${intent.recipientUserId}:${intent.variant ?? "main"}`);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });
});

describe("otp.issued envelope", () => {
  it("drops the event when the key is unknown, the code expired or the payload is tampered with", async () => {
    const { otpIssued } = await import("../src/modules/eventIngestion/mappings/identity.mapping.js");
    const { EventDataReader } = await import("../src/utils/eventDataReader.util.js");
    const base = eventFixtures["otp.issued"]!.data as Record<string, unknown>;
    const run = (data: Record<string, unknown>, keys: Record<string, Buffer>) => otpIssued({ id: "e", type: "otp.issued", occurredAt: new Date().toISOString() } as never, new EventDataReader(data), { ...context, otpEnvelopeKeys: keys });
    expect(run(base, { "otp-1": testOtpKey })).toHaveLength(1);
    expect(run(base, {})).toHaveLength(0);
    expect(run({ ...base, expiresAt: "2000-01-01T00:00:00.000Z" }, { "otp-1": testOtpKey })).toHaveLength(0);
    expect(run({ ...base, codeSealed: Buffer.from("tampered-tampered-tampered-tampered-tampered").toString("base64") }, { "otp-1": testOtpKey })).toHaveLength(0);
  });
});
