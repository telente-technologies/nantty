import type { SupportAssigneeFilter } from "@/types/support.type";

export const supportStatusOptions = [
  { value: "", label: "Any status" },
  { value: "OPEN", label: "Open" },
  { value: "OPEN,AWAITING_SUPPORT,AWAITING_USER", label: "All active" },
  { value: "AWAITING_SUPPORT", label: "Waiting for support" },
  { value: "AWAITING_USER", label: "Waiting for customer" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "CLOSED", label: "Closed" },
];

export const supportPriorityOptions = [
  { value: "", label: "Any priority" },
  { value: "URGENT", label: "Urgent" },
  { value: "HIGH", label: "High" },
  { value: "NORMAL", label: "Normal" },
  { value: "LOW", label: "Low" },
];

export const supportCategoryOptions = [
  { value: "", label: "Any category" },
  { value: "ORDER", label: "Orders" },
  { value: "PAYMENT", label: "Payments" },
  { value: "ACCOUNT", label: "Account" },
  { value: "SELLER", label: "Selling" },
  { value: "VERIFICATION", label: "Verification" },
  { value: "CREATOR", label: "Creators" },
  { value: "LIVE", label: "Live" },
  { value: "ADS", label: "Ads" },
  { value: "SAFETY", label: "Safety" },
  { value: "OTHER", label: "Other" },
];

export const supportAssigneeTabs: readonly { readonly key: SupportAssigneeFilter; readonly label: string }[] = [
  { key: "me", label: "Mine" },
  { key: "unassigned", label: "Unassigned" },
  { key: "all", label: "All tickets" },
];
