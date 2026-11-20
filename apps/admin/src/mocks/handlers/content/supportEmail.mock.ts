import { recordMockAuditEntry } from "@/mocks/mockAudit.mock";
import { readMockAreaStore, readMockDatabase } from "@/mocks/mockDatabase.mock";
import { requireMockPermission, requireMockStepUp } from "@/mocks/mockGuards.mock";
import { createMockId, failValidation, readEnumValue, readIsoNow, readJsonObjectBody, readRequiredReason, readRequiredTrimmedString, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute, type MockRequest } from "@/mocks/mockRouter.mock";
import type { MockPlatformUserRecord } from "@/mocks/seed/demoPlatformUsers.mock";
import { buildDemoEmailSends, buildDemoEmailTemplates } from "@/mocks/seed/supportOutreachSeed.mock";
import type { EmailAudience, EmailKind, EmailPreview, EmailSegment, EmailSendRecord } from "@/types/supportOutreach.type";

interface SegmentDefinition {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly includes: (user: MockPlatformUserRecord) => boolean;
}

const unsubscribeFooter = "\n\n--\nYou get this because you agreed to Nantty updates. Unsubscribe: {{unsubscribeUrl}}";
const segments: readonly SegmentDefinition[] = [
  { id: "all-users", label: "All users", description: "Every active account.", includes: (user) => user.status === "ACTIVE" },
  { id: "creators", label: "Creators", description: "Creator Program members.", includes: (user) => user.isCreator && user.status === "ACTIVE" },
  { id: "verified", label: "Verified", description: "Accounts with a checkmark.", includes: (user) => Boolean(user.verification) && user.status === "ACTIVE" },
  { id: "business-owners", label: "Business owners", description: "Everyone with a store.", includes: (user) => user.isSeller && user.status === "ACTIVE" },
];

function hasMarketingConsent(user: MockPlatformUserRecord): boolean {
  return Number(user.id.slice(-2)) % 3 !== 0;
}

function readSends(): EmailSendRecord[] {
  return readMockAreaStore("support:emailSends", buildDemoEmailSends);
}

function resolveAudience(audience: unknown): { users: MockPlatformUserRecord[]; label: string } {
  const value = audience as EmailAudience | undefined;
  const platformUsers = readMockDatabase().platformUsers;
  if (value?.type === "USER") {
    const user = platformUsers.find((candidate) => candidate.username === String(value.username ?? "").replace(/^@/, "").toLowerCase());
    if (!user) failValidation("audience.username", "No account uses that username.");
    return { users: [user], label: `@${user.username}` };
  }
  const segment = segments.find((candidate) => candidate.id === (value as { segmentId?: string } | undefined)?.segmentId);
  if (!segment) failValidation("audience.segmentId", "Choose a segment.");
  return { users: platformUsers.filter(segment.includes), label: `Segment: ${segment.label}` };
}

function buildPlan(request: MockRequest) {
  const body = readJsonObjectBody(request);
  const kind = readEnumValue(body, "kind", ["TRANSACTIONAL", "MARKETING"] as const satisfies readonly EmailKind[]);
  const subject = readRequiredTrimmedString(body, "subject", 150, 3);
  const text = readRequiredTrimmedString(body, "body", 8000, 10);
  const audience = resolveAudience(body.audience);
  const recipients = kind === "MARKETING" ? audience.users.filter(hasMarketingConsent) : audience.users;
  const skipped = audience.users.length - recipients.length;
  const renderedBody = kind === "MARKETING" && !text.includes("{{unsubscribeUrl}}") ? `${text}${unsubscribeFooter}` : text;
  const isSegment = (body.audience as EmailAudience).type === "SEGMENT";
  return { body, kind, subject, renderedBody, audience, recipients, skipped, isSegment };
}

export function registerSupportEmailMockHandlers(): void {
  registerMockRoute("GET", "/admin/support/email/templates", (request) => {
    requireMockPermission(request, "support:email");
    return respondWithJson(200, { items: readMockAreaStore("support:emailTemplates", buildDemoEmailTemplates) });
  });

  registerMockRoute("GET", "/admin/support/email/segments", (request) => {
    requireMockPermission(request, "support:email");
    const items: EmailSegment[] = segments.map((segment) => {
      const users = readMockDatabase().platformUsers.filter(segment.includes);
      return { id: segment.id, label: segment.label, description: segment.description, recipientCount: users.length, marketingConsentCount: users.filter(hasMarketingConsent).length };
    });
    return respondWithJson(200, { items });
  });

  registerMockRoute("GET", "/admin/support/email/sends", (request) => {
    requireMockPermission(request, "support:email");
    return respondWithJson(200, { items: readSends() });
  });

  registerMockRoute("POST", "/admin/support/email/preview", (request) => {
    requireMockPermission(request, "support:email");
    const plan = buildPlan(request);
    const preview: EmailPreview = { recipientCount: plan.recipients.length, skippedNoMarketingConsent: plan.skipped, includesUnsubscribeLink: plan.kind === "MARKETING", renderedSubject: plan.subject, renderedBody: plan.renderedBody, provider: "AWS_SES" };
    return respondWithJson(200, preview);
  });

  registerMockRoute("POST", "/admin/support/email/send", (request) => {
    const principal = requireMockPermission(request, "support:email");
    const plan = buildPlan(request);
    if (plan.isSegment || plan.kind === "MARKETING") requireMockStepUp(request);
    const reason = readRequiredReason(plan.body);
    if (plan.recipients.length === 0) failValidation("audience", "Nobody in this audience can receive this email. Marketing needs consent.");
    const record: EmailSendRecord = { id: createMockId("esnd"), kind: plan.kind, subject: plan.subject, audienceLabel: plan.audience.label, recipientCount: plan.recipients.length, skippedNoMarketingConsent: plan.skipped, sentByName: principal.name, sentAt: readIsoNow(), provider: "AWS_SES" };
    readSends().unshift(record);
    recordMockAuditEntry(request, { action: "support.email_sent", area: "support", target: { type: "emailSend", id: record.id, label: plan.audience.label }, reason, after: { kind: plan.kind, subject: plan.subject, recipientCount: record.recipientCount, skippedNoMarketingConsent: plan.skipped, unsubscribeIncluded: plan.kind === "MARKETING", provider: "AWS_SES" } });
    return respondWithJson(201, record);
  });

  registerMockRoute("GET", "/admin/support/email/deliveries/failed", (request) => {
    requireMockPermission(request, "support:email");
    return respondWithJson(200, {
      deliveries: [{ id: "del_email_1", templateKey: "payout_failed", eventId: "evt_email_1", attemptCount: 4, failedAt: "2026-11-15T18:10:00Z", reason: "Mailbox unavailable" }],
    });
  });

  registerMockRoute("GET", "/admin/support/notifications/push/deliveries/failed", (request) => {
    requireMockPermission(request, "support:email");
    return respondWithJson(200, {
      deliveries: [{ id: "del_push_1", templateKey: "order_shipped", eventId: "evt_push_1", attemptCount: 3, failedAt: "2026-11-15T19:45:00Z", reason: "APNs device token expired" }],
    });
  });
}
