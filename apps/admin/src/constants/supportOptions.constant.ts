import type { SupportAssigneeFilter } from "@/types/support.type";

export const supportStatusOptions = [
  { value: "", label: "Any status" },
  { value: "OPEN", label: "Open" },
  { value: "PENDING", label: "Pending customer" },
  { value: "SOLVED", label: "Solved" },
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
  { value: "ORDERS", label: "Orders" },
  { value: "PAYMENTS", label: "Payments" },
  { value: "ACCOUNT", label: "Account" },
  { value: "VERIFICATION", label: "Verification" },
  { value: "SAFETY", label: "Safety" },
  { value: "ADS", label: "Ads" },
];

export const supportAssigneeTabs: readonly { readonly key: SupportAssigneeFilter; readonly label: string }[] = [
  { key: "me", label: "Mine" },
  { key: "unassigned", label: "Unassigned" },
  { key: "all", label: "All tickets" },
];
