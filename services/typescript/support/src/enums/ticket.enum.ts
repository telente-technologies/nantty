export const ticketStatuses = ["open", "awaiting_user", "awaiting_support", "resolved", "closed"] as const;
export type TicketStatus = (typeof ticketStatuses)[number];

export const ticketCategories = ["order", "payment", "account", "seller", "verification", "creator", "live", "ads", "safety", "other"] as const;
export type TicketCategory = (typeof ticketCategories)[number];

export const ticketPriorities = ["urgent", "high", "normal", "low"] as const;
export type TicketPriority = (typeof ticketPriorities)[number];

export const ticketChannels = ["form", "chat"] as const;
export type TicketChannel = (typeof ticketChannels)[number];

export const linkedReferenceKinds = ["order", "payment", "live", "report", "dispute"] as const;
export type LinkedReferenceKind = (typeof linkedReferenceKinds)[number];

export const messageAuthorKinds = ["customer", "agent", "internal_note", "system"] as const;
export type MessageAuthorKind = (typeof messageAuthorKinds)[number];

export const autoFaqStatuses = ["none", "queued", "published", "appended", "pending_review", "skipped"] as const;
export type AutoFaqStatus = (typeof autoFaqStatuses)[number];

export const openTicketStatuses: readonly TicketStatus[] = ["open", "awaiting_user", "awaiting_support"];

export function isTicketStatusStopped(status: TicketStatus): boolean {
  return status === "resolved" || status === "closed";
}
