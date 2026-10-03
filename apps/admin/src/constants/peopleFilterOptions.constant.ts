import type { SelectOption } from "@/components/ui/formFields";

export const userStatusOptions: readonly SelectOption[] = [
  { value: "", label: "Any status" },
  { value: "ACTIVE", label: "Active" },
  { value: "WARNED", label: "Warned" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "BANNED", label: "Banned" },
  { value: "DEACTIVATED", label: "Deactivated" },
  { value: "DELETED", label: "Deleted" },
];

export const userVerificationOptions: readonly SelectOption[] = [
  { value: "", label: "Any verification" },
  { value: "BLUE", label: "Blue (personal)" },
  { value: "GOLD", label: "Gold (business)" },
  { value: "BLACK", label: "Black (government)" },
  { value: "NONE", label: "Not verified" },
];

export const userRoleOptions: readonly SelectOption[] = [
  { value: "", label: "Everyone" },
  { value: "seller", label: "Sellers" },
  { value: "creator", label: "Creator Program" },
];

export const userRiskOptions: readonly SelectOption[] = [
  { value: "", label: "Any risk" },
  { value: "LOW", label: "Low risk" },
  { value: "MEDIUM", label: "Medium risk" },
  { value: "HIGH", label: "High risk" },
];

export const verificationStatusTabs = [
  { key: "PENDING", label: "Pending" },
  { key: "VERIFIED", label: "Verified" },
  { key: "SUSPENDED", label: "Suspended" },
  { key: "REVOKED", label: "Revoked" },
  { key: "UNVERIFIED", label: "Rejected" },
  { key: "ALL", label: "All" },
] as const;

export const verificationColorOptions: readonly SelectOption[] = [
  { value: "", label: "All badges" },
  { value: "BLUE", label: "Blue · personal" },
  { value: "GOLD", label: "Gold · business" },
  { value: "BLACK", label: "Black · government" },
];

export const applicationStatusTabs = [
  { key: "PENDING", label: "Pending" },
  { key: "APPROVED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
] as const;
