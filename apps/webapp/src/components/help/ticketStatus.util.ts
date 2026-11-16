import type { SupportTicketCategory, SupportTicketStatus } from "@/types/support.type";

export const ticketStatusLabels: Readonly<Record<SupportTicketStatus, string>> = {
  open: "Open",
  awaiting_you: "Needs your reply",
  awaiting_support: "Waiting for support",
  resolved: "Resolved",
  closed: "Closed",
};

export const ticketCategoryOptions: readonly { readonly value: SupportTicketCategory; readonly label: string }[] = [
  { value: "order", label: "An order" },
  { value: "payment", label: "Payments and wallet" },
  { value: "account", label: "My account" },
  { value: "seller", label: "Selling" },
  { value: "verification", label: "Checkmarks" },
  { value: "creator", label: "Creator and earnings" },
  { value: "live", label: "Live" },
  { value: "ads", label: "Ads and boosts" },
  { value: "developer", label: "Developer integrations" },
  { value: "sandbox", label: "API sandbox" },
  { value: "safety", label: "Safety" },
  { value: "other", label: "Something else" },
];

const ticketDateFormatter = new Intl.DateTimeFormat("en-NG", { dateStyle: "medium", timeStyle: "short" });

export function formatTicketDate(isoDate: string): string {
  const date = new Date(isoDate);
  return Number.isNaN(date.getTime()) ? "" : ticketDateFormatter.format(date);
}
