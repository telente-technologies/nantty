import type { StatusTone } from "@/components/escrow/statusPill";
import type { ContentReportStatus, SupportTicketCategory, SupportTicketStatus } from "@/types/support.type";

export const TICKET_STATUS_APPEARANCE: Record<SupportTicketStatus, { label: string; tone: StatusTone }> = {
  open: { label: "Open", tone: "primary" },
  awaiting_you: { label: "Needs your reply", tone: "caution" },
  awaiting_support: { label: "Waiting for support", tone: "primary" },
  resolved: { label: "Resolved", tone: "success" },
  closed: { label: "Closed", tone: "neutral" },
};

export const REPORT_STATUS_APPEARANCE: Record<ContentReportStatus, { label: string; tone: StatusTone }> = {
  received: { label: "Received", tone: "neutral" },
  reviewing: { label: "Reviewing", tone: "caution" },
  action_taken: { label: "Action taken", tone: "success" },
  no_violation: { label: "No violation", tone: "primary" },
};

export const TICKET_CATEGORY_OPTIONS: readonly { readonly id: SupportTicketCategory; readonly label: string }[] = [
  { id: "order", label: "An order" },
  { id: "payment", label: "Payments & wallet" },
  { id: "account", label: "My account" },
  { id: "seller", label: "Selling" },
  { id: "verification", label: "Checkmarks" },
  { id: "creator", label: "Creator and earnings" },
  { id: "live", label: "Live" },
  { id: "ads", label: "Ads and boosts" },
  { id: "safety", label: "Safety" },
  { id: "other", label: "Something else" },
];
