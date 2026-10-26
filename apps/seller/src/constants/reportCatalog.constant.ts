export const reportKinds = [
  "sales-by-day",
  "sales-by-product",
  "sales-by-category",
  "sales-by-location",
  "tax",
  "orders-by-status",
  "order-fulfilment-time",
  "inventory-valuation",
  "low-stock",
  "customers-new-vs-returning",
  "top-customers",
  "best-sellers",
  "slow-sellers",
  "settlements",
  "fees",
  "refunds",
  "payouts",
  "ads-campaigns",
] as const;

export const reportGroups = ["Sales", "Orders", "Inventory", "Customers", "Products", "Financial", "Ads"] as const;
export type ReportGroup = (typeof reportGroups)[number];

export interface ReportCatalogEntry {
  readonly kind: (typeof reportKinds)[number];
  readonly title: string;
  readonly description: string;
  readonly group: ReportGroup;
  readonly usesDateRange: boolean;
  readonly supportsLocationFilter: boolean;
  readonly needsAdvancedReports: boolean;
  readonly chart: "daily-revenue" | "ranked" | null;
}

export const reportCatalog: ReportCatalogEntry[] = [
  { kind: "sales-by-day", title: "Sales by day", description: "Daily orders, items and revenue from the Nantty app.", group: "Sales", usesDateRange: true, supportsLocationFilter: true, needsAdvancedReports: false, chart: "daily-revenue" },
  { kind: "sales-by-product", title: "Sales by product", description: "Units, revenue, cost and margin for each product.", group: "Sales", usesDateRange: true, supportsLocationFilter: true, needsAdvancedReports: false, chart: null },
  { kind: "sales-by-category", title: "Sales by category", description: "Which categories bring in the most money.", group: "Sales", usesDateRange: true, supportsLocationFilter: true, needsAdvancedReports: false, chart: "ranked" },
  { kind: "sales-by-location", title: "Sales by location", description: "Revenue by the state your customers order from.", group: "Sales", usesDateRange: true, supportsLocationFilter: false, needsAdvancedReports: false, chart: "ranked" },
  { kind: "tax", title: "Tax report", description: "Taxable sales, tax collected per rate and exempt sales.", group: "Sales", usesDateRange: true, supportsLocationFilter: false, needsAdvancedReports: false, chart: null },
  { kind: "orders-by-status", title: "Orders by status", description: "How many orders are new, shipped, delivered, cancelled or refunded.", group: "Orders", usesDateRange: true, supportsLocationFilter: false, needsAdvancedReports: true, chart: "ranked" },
  { kind: "order-fulfilment-time", title: "Fulfilment time", description: "Hours from order to shipping and from shipping to delivery, per week.", group: "Orders", usesDateRange: true, supportsLocationFilter: false, needsAdvancedReports: true, chart: null },
  { kind: "inventory-valuation", title: "Inventory valuation", description: "Stock on hand at cost and at selling price, per location.", group: "Inventory", usesDateRange: false, supportsLocationFilter: true, needsAdvancedReports: false, chart: null },
  { kind: "low-stock", title: "Low and out of stock", description: "Variants at or below their reorder level, with suggested reorder quantity.", group: "Inventory", usesDateRange: false, supportsLocationFilter: true, needsAdvancedReports: false, chart: null },
  { kind: "customers-new-vs-returning", title: "New vs returning customers", description: "First-time buyers against repeat buyers, per week.", group: "Customers", usesDateRange: true, supportsLocationFilter: false, needsAdvancedReports: true, chart: null },
  { kind: "top-customers", title: "Top customers", description: "Who spends the most, how often they order and when they last bought.", group: "Customers", usesDateRange: true, supportsLocationFilter: false, needsAdvancedReports: true, chart: "ranked" },
  { kind: "best-sellers", title: "Best sellers", description: "Your top products by units sold.", group: "Products", usesDateRange: true, supportsLocationFilter: false, needsAdvancedReports: true, chart: "ranked" },
  { kind: "slow-sellers", title: "Slow sellers", description: "Active products with few or no sales, and the stock tied up in them.", group: "Products", usesDateRange: true, supportsLocationFilter: false, needsAdvancedReports: true, chart: null },
  { kind: "settlements", title: "Settlements", description: "Escrow released to your wallet, batched by week.", group: "Financial", usesDateRange: true, supportsLocationFilter: false, needsAdvancedReports: true, chart: null },
  { kind: "fees", title: "Fees", description: "Escrow fees, payment processing and withdrawal fees.", group: "Financial", usesDateRange: true, supportsLocationFilter: false, needsAdvancedReports: true, chart: "ranked" },
  { kind: "refunds", title: "Refunds", description: "Cancelled orders, refunded orders and approved returns.", group: "Financial", usesDateRange: true, supportsLocationFilter: false, needsAdvancedReports: true, chart: null },
  { kind: "payouts", title: "Payouts", description: "Withdrawals to your bank, with fees and status.", group: "Financial", usesDateRange: true, supportsLocationFilter: false, needsAdvancedReports: true, chart: null },
  { kind: "ads-campaigns", title: "Ad campaigns", description: "Spend, impressions, clicks, attributed orders and ROAS per campaign.", group: "Ads", usesDateRange: true, supportsLocationFilter: false, needsAdvancedReports: true, chart: "ranked" },
];

export function findReportCatalogEntry(kind: string): ReportCatalogEntry | undefined {
  return reportCatalog.find((entry) => entry.kind === kind);
}
