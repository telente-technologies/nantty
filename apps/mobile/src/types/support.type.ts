import type { ID, ISODate } from "./models.type";

export type SupportTicketCategory = "order" | "payment" | "account" | "seller" | "safety" | "other";
export type SupportTicketStatus = "open" | "awaiting_you" | "resolved" | "closed";

export interface SupportLinkedReference {
  readonly kind: "order" | "payment";
  readonly id: ID;
  readonly label: string;
}

export interface SupportTicketSummary {
  readonly id: ID;
  readonly subject: string;
  readonly category: SupportTicketCategory;
  readonly status: SupportTicketStatus;
  readonly linkedReference: SupportLinkedReference | null;
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
  readonly agentTyping: boolean;
}

export interface NewSupportTicketInput {
  readonly category: SupportTicketCategory;
  readonly subject: string;
  readonly message: string;
  readonly attachmentUrls: readonly string[];
  readonly linkedReference: SupportLinkedReference | null;
}

export type ContentReportStatus = "received" | "reviewing" | "action_taken" | "no_violation";

export interface ContentReport {
  readonly id: ID;
  readonly targetType: "post" | "user" | "comment" | "live" | "product" | "message" | "conversation" | "group";
  readonly targetLabel: string;
  readonly reason: string;
  readonly status: ContentReportStatus;
  readonly outcomeNote: string | null;
  readonly createdAt: ISODate;
  readonly updatedAt: ISODate;
}
