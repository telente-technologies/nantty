import type { EmailSender, OutgoingEmail } from "../../src/interfaces/emailSender.interface.js";
import type { AudiencePage, AudienceSegment, IdentityDirectory, AdminAuditEntry } from "../../src/interfaces/identityDirectory.interface.js";
import type { JobQueue } from "../../src/interfaces/jobQueue.interface.js";
import type { PushSender } from "../../src/interfaces/pushSender.interface.js";
import type { PushContent, Recipient } from "../../src/types/notification.type.js";

export class RecordingEmailSender implements EmailSender {
  public readonly sent: OutgoingEmail[] = [];
  public failNext = false;
  public async send(email: OutgoingEmail) {
    if (this.failNext) { this.failNext = false; throw new Error("SES unavailable"); }
    this.sent.push(email);
    return { messageId: `msg-${this.sent.length}` };
  }
}

export class RecordingPushSender implements PushSender {
  public readonly sent: { tokens: readonly string[]; content: PushContent }[] = [];
  public readonly silent: { tokens: readonly string[]; data: Readonly<Record<string, unknown>> }[] = [];
  public async send(tokens: readonly string[], content: PushContent) { this.sent.push({ tokens, content }); }
  public async sendSilent(tokens: readonly string[], data: Readonly<Record<string, unknown>>) { this.silent.push({ tokens, data }); }
}

export class RecordingJobQueue implements JobQueue {
  public readonly jobs: { queueUrl: string; body: Record<string, unknown>; delaySeconds: number }[] = [];
  public failNext = false;
  public async send(queueUrl: string, body: unknown, delaySeconds = 0) {
    if (this.failNext) { this.failNext = false; throw new Error("queue unavailable"); }
    this.jobs.push({ queueUrl, body: body as Record<string, unknown>, delaySeconds });
  }
  public takeAll() { return this.jobs.splice(0, this.jobs.length); }
}

export function makeRecipient(overrides: Partial<Recipient> = {}): Recipient {
  return { accountId: "u1", email: "amaka@example.com", emailVerified: true, firstName: "Amaka", username: "amaka", marketingConsent: false, status: "active", ...overrides };
}

export class FakeIdentityDirectory implements IdentityDirectory {
  public readonly accounts = new Map<string, Recipient>();
  public readonly staffEmails = new Map<string, string>();
  public segments: AudienceSegment[] = [];
  public audience: Recipient[] = [];
  public readonly withdrawn: string[] = [];
  public readonly audits: AdminAuditEntry[] = [];

  public add(recipient: Recipient) { this.accounts.set(recipient.accountId, recipient); return recipient; }
  public async getRecipient(accountId: string) { return this.accounts.get(accountId) ?? null; }
  public async findRecipientByUsername(username: string) { return [...this.accounts.values()].find((account) => account.username === username) ?? null; }
  public async getStaffEmail(staffId: string) { return this.staffEmails.get(staffId) ?? null; }
  public async listSegments() { return this.segments; }
  public async listAudiencePage(_segmentId: string, cursor: string | null, limit: number): Promise<AudiencePage> {
    const start = cursor === null ? 0 : Number(cursor);
    const data = this.audience.slice(start, start + limit);
    return { data, nextCursor: start + limit < this.audience.length ? String(start + limit) : null };
  }
  public async countAudience() { return { total: this.audience.length, marketingConsentCount: this.audience.filter((recipient) => recipient.marketingConsent).length }; }
  public async withdrawMarketingConsent(accountId: string) { this.withdrawn.push(accountId); }
  public async recordAdminAudit(entry: AdminAuditEntry) { this.audits.push(entry); }
}
