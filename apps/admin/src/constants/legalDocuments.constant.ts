import type { LegalDocumentKey } from "@/types/legal.type";

export const legalDocumentDefinitions: readonly { readonly key: LegalDocumentKey; readonly title: string; readonly publicPath: string }[] = [
  { key: "terms", title: "Terms of Service", publicPath: "/terms" },
  { key: "privacy", title: "Privacy Policy", publicPath: "/privacy" },
  { key: "cookies", title: "Cookie Policy", publicPath: "/cookies" },
  { key: "community-guidelines", title: "Community Guidelines", publicPath: "/community-guidelines" },
  { key: "seller-terms", title: "Seller Terms", publicPath: "/seller-terms" },
  { key: "creator-terms", title: "Creator Program Terms", publicPath: "/creator-terms" },
  { key: "ads-policy", title: "Ads Policy", publicPath: "/ads-policy" },
  { key: "refund-escrow-policy", title: "Refund and Escrow Policy", publicPath: "/refund-escrow-policy" },
  { key: "copyright-policy", title: "Copyright and IP Policy", publicPath: "/copyright-policy" },
  { key: "data-rights", title: "Data Rights Requests", publicPath: "/data-rights" },
];

export const documentsThatAlwaysNotifyUsers: readonly LegalDocumentKey[] = ["terms", "privacy"];
export const materialChangeNoticeDays = 30;
export const totalMockRegisteredUsers = 48_250;
export const mockHardBouncedAddresses = 312;
export const mockSuppressedAddresses = 1_074;
export const sesBatchSize = 50;
export const sesRatePerSecond = 14;
export const mockSendSpeedMultiplier = 40;
