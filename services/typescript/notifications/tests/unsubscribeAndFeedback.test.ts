import { beforeEach, describe, expect, it } from "vitest";

import { RecordSesFeedbackHandler } from "../src/modules/suppression/commands/recordSesFeedback/recordSesFeedback.handler.js";
import { UnsubscribeFromMarketingHandler } from "../src/modules/unsubscribe/commands/unsubscribeFromMarketing/unsubscribeFromMarketing.handler.js";
import { unwrapQueueMessageBody } from "../src/modules/eventIngestion/validators/domainEvent.validator.js";
import { createTestHarness, type TestHarness } from "./fakes/testHarness.fake.js";

let harness: TestHarness;
beforeEach(() => { harness = createTestHarness(); });

describe("one-click unsubscribe tokens", () => {
  it("round-trips the account id and rejects tampering", () => {
    const token = harness.unsubscribeTokens.sign("u1");
    expect(harness.unsubscribeTokens.verify(token)).toBe("u1");
    const [payload, signature] = token.split(".");
    const forged = `${Buffer.from(JSON.stringify({ a: "u2", p: "marketing" })).toString("base64url")}.${signature}`;
    expect(harness.unsubscribeTokens.verify(forged)).toBeNull();
    expect(harness.unsubscribeTokens.verify(`${payload}.`)).toBeNull();
    expect(harness.unsubscribeTokens.verify("garbage")).toBeNull();
    expect(harness.unsubscribeTokens.verify(`${token}.extra`)).toBeNull();
  });

  it("a token signed with another secret is rejected", () => {
    const other = new (harness.unsubscribeTokens.constructor as new (secret: string, base: string) => typeof harness.unsubscribeTokens)("a-different-signing-secret-0123456789abcdef", "https://api.zudomart.test");
    expect(harness.unsubscribeTokens.verify(other.sign("u1"))).toBeNull();
  });

  it("withdraws marketing consent in goIdentity", async () => {
    const handler = new UnsubscribeFromMarketingHandler(harness.unsubscribeTokens, harness.identity);
    await expect(handler.execute({ token: harness.unsubscribeTokens.sign("u1") })).resolves.toEqual({ unsubscribed: true });
    expect(harness.identity.withdrawn).toEqual(["u1"]);
    await expect(handler.execute({ token: "nope" })).rejects.toMatchObject({ code: "VALIDATION_FAILED" });
    expect(harness.identity.withdrawn).toEqual(["u1"]);
  });

  it("builds a public one-click URL", () => {
    expect(harness.unsubscribeTokens.buildUnsubscribeUrl("u1")).toMatch(/^https:\/\/api\.zudomart\.test\/api\/v1\/email\/unsubscribe\?token=/);
  });
});

describe("SES bounce and complaint feedback", () => {
  it("suppresses permanent bounces and complaints, ignores transient bounces", async () => {
    const handler = new RecordSesFeedbackHandler(harness.suppressions);
    await handler.execute({ feedback: { eventType: "Bounce", bounce: { bounceType: "Permanent", bouncedRecipients: [{ emailAddress: "Gone@Example.com" }] } } });
    await handler.execute({ feedback: { eventType: "Bounce", bounce: { bounceType: "Transient", bouncedRecipients: [{ emailAddress: "full@example.com" }] } } });
    await handler.execute({ feedback: { notificationType: "Complaint", complaint: { complainedRecipients: [{ emailAddress: "angry@example.com" }] } } });
    await handler.execute({ feedback: { eventType: "Delivery" } });
    expect(harness.suppressions.rows.get("gone@example.com")).toBe("hard_bounce");
    expect(harness.suppressions.rows.get("angry@example.com")).toBe("complaint");
    expect(harness.suppressions.rows.has("full@example.com")).toBe(false);
  });

  it("never downgrades a hard bounce to a complaint", async () => {
    const handler = new RecordSesFeedbackHandler(harness.suppressions);
    await handler.execute({ feedback: { eventType: "Bounce", bounce: { bounceType: "Permanent", bouncedRecipients: [{ emailAddress: "a@example.com" }] } } });
    await handler.execute({ feedback: { eventType: "Complaint", complaint: { complainedRecipients: [{ emailAddress: "a@example.com" }] } } });
    expect(harness.suppressions.rows.get("a@example.com")).toBe("hard_bounce");
  });

  it("unwraps SNS notifications from the feedback and domain event queues", () => {
    const wrapped = JSON.stringify({ Type: "Notification", Message: JSON.stringify({ id: "e1" }) });
    expect(unwrapQueueMessageBody(wrapped)).toEqual({ id: "e1" });
    expect(unwrapQueueMessageBody(JSON.stringify({ id: "e2" }))).toEqual({ id: "e2" });
  });
});
