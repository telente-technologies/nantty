export const SUPPORT_TICKET_CATEGORIES = ["order", "payment", "account", "seller", "safety", "other"] as const;
export type SupportTicketCategory = (typeof SUPPORT_TICKET_CATEGORIES)[number];
export const SUPPORT_TICKET_STATUSES = ["open", "awaiting_you", "resolved", "closed"] as const;
export type SupportTicketStatus = (typeof SUPPORT_TICKET_STATUSES)[number];
export const CONTACT_REQUEST_KINDS = ["contact", "legal", "copyright"] as const;
export type ContactRequestKind = (typeof CONTACT_REQUEST_KINDS)[number];

export interface SupportTicketRecord {
  readonly id: string;
  readonly requesterId: string;
  readonly category: SupportTicketCategory;
  readonly subject: string;
  readonly status: SupportTicketStatus;
  readonly assigneeId: string | null;
  readonly lastMessagePreview: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export type NewSupportTicket = Pick<SupportTicketRecord, "requesterId" | "category" | "subject">;
export type SupportTicketChanges = Partial<Pick<SupportTicketRecord, "status" | "assigneeId" | "lastMessagePreview">>;

export interface SupportMessageRecord {
  readonly id: string;
  readonly ticketId: string;
  readonly authorId: string;
  readonly fromSupport: boolean;
  readonly text: string;
  readonly attachmentMediaIds: readonly string[];
  readonly createdAt: Date;
}

export type NewSupportMessage = Omit<SupportMessageRecord, "id" | "createdAt">;

export interface ContactRequestRecord {
  readonly id: string;
  readonly kind: ContactRequestKind;
  readonly name: string;
  readonly emailCiphertext: string;
  readonly subject: string;
  readonly message: string;
  readonly requesterId: string | null;
  readonly createdAt: Date;
}

export type NewContactRequest = Omit<ContactRequestRecord, "id" | "createdAt">;

export const MESSAGE_PREVIEW_LENGTH = 140;
