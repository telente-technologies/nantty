import type { ID, ISODate } from "./models.type";

export type SupportTicketCategory = "order" | "payment" | "account" | "seller" | "verification" | "creator" | "live" | "ads" | "developer" | "sandbox" | "safety" | "other";
export type SupportTicketStatus = "open" | "awaiting_you" | "awaiting_support" | "resolved" | "closed";

export interface SupportLinkedReference {
  readonly kind: "order" | "payment" | "live" | "report" | "dispute";
  readonly id: ID;
  readonly label: string;
}

export interface SupportTicketSummary {
  readonly id: ID;
  readonly reference?: string;
  readonly subject: string;
  readonly category: SupportTicketCategory;
  readonly status: SupportTicketStatus;
  readonly channel?: "form" | "chat";
  readonly linkedReference: SupportLinkedReference | null;
  readonly lastMessagePreview: string;
  readonly unreadCount?: number;
  readonly satisfactionScore?: number | null;
  readonly canRate?: boolean;
  readonly canReply?: boolean;
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
  readonly channel?: "form" | "chat";
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
