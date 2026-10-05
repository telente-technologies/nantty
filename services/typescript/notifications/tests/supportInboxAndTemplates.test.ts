import { describe, expect, it } from "vitest";

import { HandleDomainEventHandler } from "../src/modules/eventIngestion/commands/handleDomainEvent/handleDomainEvent.handler.js";
import { SupportInboxAlertService } from "../src/modules/delivery/services/supportInboxAlert.service.js";
import { PreviewEmailTemplateHandler } from "../src/modules/emailTemplates/queries/previewEmailTemplate/previewEmailTemplate.handler.js";
import { policyUpdatedPreviewBodySchema } from "../src/modules/emailTemplates/validators/emailTemplates.validator.js";
import { createTestHarness, makeEvent, silentLogger } from "./fakes/testHarness.fake.js";
import { makeRecipient } from "./fakes/inMemoryServices.fake.js";

const ticket = { ticketId: "7b9e2f3a-1111-4222-8333-123456789abc", reference: "SUP-10421", accountId: "u1", subject: "Refund <b>missing</b>", category: "payment", channel: "web", priority: "high", firstResponseHours: 4 };
const context = { webBaseUrl: "https://zudomart.com", sellerDashboardUrl: "https://dashboard.zudomart.com" };

describe("support team inbox email", () => {
  it("emails every support address once per ticket with an admin link, and the requester still gets their receipt", async () => {
    const harness = createTestHarness();
    harness.identity.accounts.set("u1", makeRecipient({ accountId: "u1", email: "amaka@example.com" }));
    const inbox = new SupportInboxAlertService({ emailDelivery: harness.emailDelivery, recipients: ["support@zudomart.com", "lead@zudomart.com"], adminBaseUrl: "https://admin.zudomart.com/" });
    const handler = new HandleDomainEventHandler(harness.dispatcher, { handlePolicyPublished: async () => undefined }, context, silentLogger, inbox);
    const event = makeEvent("ticket.created", ticket);
    await handler.execute({ event });
    await handler.execute({ event });
    const staffMail = harness.sender.sent.filter((mail) => mail.to !== "amaka@example.com");
    expect(staffMail.map((mail) => mail.to)).toEqual(["support@zudomart.com", "lead@zudomart.com"]);
    expect(staffMail[0]?.subject).toBe("[Zudomart Support] SUP-10421 Refund <b>missing</b>");
    expect(staffMail[0]?.html).toContain("https://admin.zudomart.com/support/7b9e2f3a-1111-4222-8333-123456789abc");
    expect(staffMail[0]?.html).not.toContain("<b>missing</b>");
    expect(staffMail[0]?.text).toContain("Priority: high");
    expect(harness.sender.sent.filter((mail) => mail.to === "amaka@example.com")).toHaveLength(1);
  });

  it("does nothing for other events", async () => {
    const harness = createTestHarness();
    const inbox = new SupportInboxAlertService({ emailDelivery: harness.emailDelivery, recipients: ["support@zudomart.com"], adminBaseUrl: "https://admin.zudomart.com" });
    const handler = new HandleDomainEventHandler(harness.dispatcher, { handlePolicyPublished: async () => undefined }, context, silentLogger, inbox);
    await handler.execute({ event: makeEvent("ticket.resolved", { ...ticket, resolution: "Done", reopenDays: 7, resolvedAt: "2026-10-05T10:00:00.000Z" }) });
    expect(harness.sender.sent.filter((mail) => mail.to === "support@zudomart.com")).toEqual([]);
  });
});

describe("admin email template previews", () => {
  const previews = new PreviewEmailTemplateHandler(undefined, "https://zudomart.com");

  it("lists the catalogue and renders a sample in the requested theme", async () => {
    const { items } = previews.listCatalogue();
    expect(items.some((item) => item.key === "supportTicketReceived")).toBe(true);
    const rendered = await previews.previewSample("supportTicketReceived", "dark");
    expect(rendered.key).toBe("supportTicketReceived");
    expect(rendered.subject).toContain("SUP-20419");
    expect(rendered.html.length).toBeGreaterThan(100);
    await expect(previews.previewSample("nope", "light")).rejects.toMatchObject({ status: 404 });
  });

  it("renders the policy notice from an unsaved draft and validates the body strictly", async () => {
    const body = policyUpdatedPreviewBodySchema.parse({
      theme: "light", documentTitle: "Privacy Policy", subject: "We're updating our Privacy Policy", summaryText: "We explain how long we keep chat media.",
      whatChanged: ["Chat media retention", "  ", "Ads choices"], effectiveAt: "2026-11-01T00:00:00.000Z", reacceptNote: null, documentUrl: "https://zudomart.com/privacy",
    });
    expect(body.whatChanged).toEqual(["Chat media retention", "Ads choices"]);
    const rendered = await previews.previewPolicyUpdated(body);
    expect(rendered).toMatchObject({ key: "policyUpdated", subject: "We're updating our Privacy Policy" });
    expect(rendered.text).toContain("Chat media retention");
    expect(policyUpdatedPreviewBodySchema.safeParse({ ...body, documentUrl: "http://zudomart.com/privacy" }).success).toBe(false);
    expect(policyUpdatedPreviewBodySchema.safeParse({ ...body, extra: true }).success).toBe(false);
  });
});
