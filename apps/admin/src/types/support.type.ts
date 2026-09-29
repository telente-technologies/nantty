import type { AuditLogEntry } from "@/types/audit.type";
import type { PlatformUserSummary } from "@/types/platformUser.type";

export type SupportTicketStatus = "OPEN" | "PENDING" | "SOLVED" | "CLOSED";
export type SupportTicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type SupportTicketCategory = "ORDERS" | "PAYMENTS" | "ACCOUNT" | "VERIFICATION" | "SAFETY" | "ADS";
export type SupportAssigneeFilter = "me" | "unassigned" | "all";

export interface SupportAgent {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export interface SupportTicketSummary {
  readonly id: string;
  readonly subject: string;
  readonly category: SupportTicketCategory;
  readonly priority: SupportTicketPriority;
  readonly status: SupportTicketStatus;
  readonly requester: PlatformUserSummary;
  readonly assignee: SupportAgent | null;
  readonly linkedOrderId: string | null;
  readonly linkedDisputeId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly firstResponseDueAt: string;
  readonly firstRespondedAt: string | null;
  readonly resolutionDueAt: string;
  readonly solvedAt: string | null;
  readonly lastMessagePreview: string;
  readonly messageCount: number;
  readonly isSlaBreached: boolean;
}

export type SupportMessageAuthorKind = "CUSTOMER" | "AGENT" | "INTERNAL_NOTE";

export interface SupportMessage {
  readonly id: string;
  readonly authorKind: SupportMessageAuthorKind;
  readonly authorName: string;
  readonly body: string;
  readonly createdAt: string;
}

export interface SupportTicketDetail {
  readonly ticket: SupportTicketSummary;
  readonly messages: readonly SupportMessage[];
  readonly history: readonly AuditLogEntry[];
}

export interface SupportMacro {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly category: SupportTicketCategory | null;
  readonly updatedAt: string;
  readonly updatedByName: string;
}
