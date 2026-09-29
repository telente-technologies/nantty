import type { SupportTicketCategory, SupportTicketRecord, SupportTicketStatus } from "../models/support.model.js";

export interface SupportTicketSummaryDto {
  readonly id: string;
  readonly subject: string;
  readonly category: SupportTicketCategory;
  readonly status: SupportTicketStatus;
  readonly lastMessagePreview: string;
  readonly requesterId: string;
  readonly assigneeId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SupportTicketMessageDto {
  readonly id: string;
  readonly fromSupport: boolean;
  readonly authorName: string;
  readonly text: string;
  readonly attachments: readonly { readonly id: string; readonly url: string | null }[];
  readonly attachmentUrls: readonly string[];
  readonly createdAt: string;
}

export interface SupportTicketDetailDto extends SupportTicketSummaryDto {
  readonly messages: readonly SupportTicketMessageDto[];
}

export function convertTicketToSummary(ticket: SupportTicketRecord): SupportTicketSummaryDto {
  return {
    id: ticket.id,
    subject: ticket.subject,
    category: ticket.category,
    status: ticket.status,
    lastMessagePreview: ticket.lastMessagePreview,
    requesterId: ticket.requesterId,
    assigneeId: ticket.assigneeId,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  };
}
