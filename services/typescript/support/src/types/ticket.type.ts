import type { AutoFaqStatus, LinkedReferenceKind, MessageAuthorKind, TicketCategory, TicketChannel, TicketPriority, TicketStatus } from "../enums/ticket.enum.js";

export interface TicketAttachment {
  readonly url: string;
  readonly contentType: string | null;
}

export interface TicketMessageRecord {
  readonly id: string;
  readonly ticketId: string;
  readonly authorKind: MessageAuthorKind;
  readonly authorId: string | null;
  readonly authorName: string;
  readonly body: string;
  readonly attachments: readonly TicketAttachment[];
  readonly createdAt: Date;
}

export interface TicketHistoryRecord {
  readonly id: string;
  readonly action: string;
  readonly actorId: string;
  readonly actorName: string;
  readonly reason: string | null;
  readonly detail: Readonly<Record<string, unknown>>;
  readonly createdAt: Date;
}

export interface LinkedReference {
  readonly kind: LinkedReferenceKind;
  readonly id: string;
  readonly label: string;
}

export interface TicketRecord {
  readonly id: string;
  readonly number: number;
  readonly requesterAccountId: string;
  readonly requesterName: string;
  readonly requesterUsername: string;
  readonly subject: string;
  readonly category: TicketCategory;
  readonly priority: TicketPriority;
  readonly status: TicketStatus;
  readonly channel: TicketChannel;
  readonly linkedReference: LinkedReference | null;
  readonly assigneeStaffId: string | null;
  readonly assigneeName: string | null;
  readonly firstResponseDueAt: Date;
  readonly firstRespondedAt: Date | null;
  readonly resolutionDueAt: Date;
  readonly resolvedAt: Date | null;
  readonly closedAt: Date | null;
  readonly satisfactionScore: number | null;
  readonly satisfactionComment: string | null;
  readonly lastMessageAt: Date;
  readonly lastMessagePreview: string;
  readonly requesterUnread: number;
  readonly messageCount: number;
  readonly autoFaqStatus: AutoFaqStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TicketWithThread extends TicketRecord {
  readonly messages: readonly TicketMessageRecord[];
  readonly history: readonly TicketHistoryRecord[];
}

export type TicketUpdate = Partial<Pick<TicketRecord,
  "status" | "priority" | "assigneeStaffId" | "assigneeName" | "firstRespondedAt" | "resolvedAt" | "closedAt" | "satisfactionScore" | "satisfactionComment"
  | "lastMessageAt" | "lastMessagePreview" | "autoFaqStatus" | "requesterName" | "requesterUsername" | "subject">> & {
  readonly requesterUnreadIncrement?: number;
  readonly resetRequesterUnread?: boolean;
  readonly messageCountIncrement?: number;
};

export interface NewTicketMessage {
  readonly authorKind: MessageAuthorKind;
  readonly authorId: string | null;
  readonly authorName: string;
  readonly body: string;
  readonly attachments: readonly TicketAttachment[];
}

export interface NewHistoryEntry {
  readonly action: string;
  readonly actorId: string;
  readonly actorName: string;
  readonly reason?: string | null;
  readonly detail?: Readonly<Record<string, unknown>>;
}

export interface NewTicket {
  readonly requesterAccountId: string;
  readonly requesterName: string;
  readonly requesterUsername: string;
  readonly subject: string;
  readonly category: TicketCategory;
  readonly priority: TicketPriority;
  readonly channel: TicketChannel;
  readonly linkedReference: LinkedReference | null;
  readonly firstResponseDueAt: Date;
  readonly resolutionDueAt: Date;
  readonly idempotencyKey: string | null;
}

export interface TicketQueueFilter {
  readonly statuses: readonly TicketStatus[] | undefined;
  readonly priority: TicketPriority | undefined;
  readonly category: TicketCategory | undefined;
  readonly channel: TicketChannel | undefined;
  readonly assignee: { readonly kind: "all" } | { readonly kind: "unassigned" } | { readonly kind: "staff"; readonly staffId: string };
  readonly search: string | undefined;
  readonly page: number;
  readonly pageSize: number;
}

export interface MacroRecord {
  readonly id: string;
  readonly title: string;
  readonly body: string;
  readonly category: TicketCategory | null;
  readonly updatedAt: Date;
  readonly updatedByName: string;
}

export interface AgentRecord {
  readonly staffId: string;
  readonly name: string;
}
