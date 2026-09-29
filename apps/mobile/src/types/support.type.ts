import type { ID, ISODate } from "./models.type";

export type SupportTicketCategory = "order" | "payment" | "account" | "seller" | "safety" | "other";
export type SupportTicketStatus = "open" | "awaiting_you" | "resolved" | "closed";

export interface SupportTicketSummary {
  readonly id: ID;
  readonly subject: string;
  readonly category: SupportTicketCategory;
  readonly status: SupportTicketStatus;
  readonly lastMessagePreview: string;
  readonly createdAt: ISODate;
  readonly updatedAt: ISODate;
}

export interface SupportTicketMessage {
  readonly id: ID;
  readonly fromSupport: boolean;
  readonly authorName: string;
  readonly text: string;
  readonly attachmentUrls: readonly string[];
  readonly createdAt: ISODate;
}

export interface SupportTicketDetail extends SupportTicketSummary {
  readonly messages: readonly SupportTicketMessage[];
}

export interface NewSupportTicketInput {
  readonly category: SupportTicketCategory;
  readonly subject: string;
  readonly message: string;
  readonly attachmentUrls: readonly string[];
}

export type ContentReportStatus = "received" | "reviewing" | "action_taken" | "no_violation";

export interface ContentReport {
  readonly id: ID;
  readonly targetType: "post" | "user" | "comment" | "live" | "product" | "message";
  readonly targetLabel: string;
  readonly reason: string;
  readonly status: ContentReportStatus;
  readonly outcomeNote: string | null;
  readonly createdAt: ISODate;
  readonly updatedAt: ISODate;
}
