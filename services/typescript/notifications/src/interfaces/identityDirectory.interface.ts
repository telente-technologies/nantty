import type { Recipient } from "../types/notification.type.js";

export interface AudienceSegment {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly recipientCount: number;
  readonly marketingConsentCount: number;
}

export interface AudiencePage {
  readonly data: readonly Recipient[];
  readonly nextCursor: string | null;
}

export interface AdminAuditEntry {
  readonly action: string;
  readonly actorId: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly reason?: string;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export interface IdentityDirectory {
  getRecipient(accountId: string): Promise<Recipient | null>;
  findRecipientByUsername(username: string): Promise<Recipient | null>;
  getStaffEmail(staffId: string): Promise<string | null>;
  listSegments(): Promise<readonly AudienceSegment[]>;
  listAudiencePage(segmentId: string, cursor: string | null, limit: number): Promise<AudiencePage>;
  countAudience(segmentId: string): Promise<{ readonly total: number; readonly marketingConsentCount: number }>;
  withdrawMarketingConsent(accountId: string): Promise<void>;
  recordAdminAudit(entry: AdminAuditEntry): Promise<void>;
}
