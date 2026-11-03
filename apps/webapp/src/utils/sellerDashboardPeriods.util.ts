import type { SellerDashboardPeriod } from "@/types/account.type";

export const SELLER_DASHBOARD_PERIODS: readonly {
  readonly key: SellerDashboardPeriod;
  readonly label: string;
}[] = [
  { key: "live", label: "Live" },
  { key: "yesterday", label: "Yesterday" },
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "all", label: "All time" },
];
