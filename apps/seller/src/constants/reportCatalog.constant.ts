export const reportKinds = [
  "sales-by-day",
  "sales-by-product",
  "sales-by-category",
  "sales-by-staff",
  "sales-by-payment-method",
  "sales-by-location",
  "tax",
  "inventory-valuation",
  "shifts",
] as const;

export interface ReportCatalogEntry {
  readonly kind: (typeof reportKinds)[number];
  readonly title: string;
  readonly description: string;
  readonly group: "Sales" | "Tax and stock" | "Cash drawer";
  readonly supportsChannelFilter: boolean;
  readonly usesDateRange: boolean;
}

export const reportCatalog: ReportCatalogEntry[] = [
  { kind: "sales-by-day", title: "Sales by day", description: "Daily revenue from the register and online orders.", group: "Sales", supportsChannelFilter: true, usesDateRange: true },
  { kind: "sales-by-product", title: "Sales by product", description: "Units, revenue, cost and margin for each product.", group: "Sales", supportsChannelFilter: true, usesDateRange: true },
  { kind: "sales-by-category", title: "Sales by category", description: "Which categories bring in the most money.", group: "Sales", supportsChannelFilter: true, usesDateRange: true },
  { kind: "sales-by-staff", title: "Sales by staff", description: "Register sales per cashier, with average sale.", group: "Sales", supportsChannelFilter: false, usesDateRange: true },
  { kind: "sales-by-payment-method", title: "Sales by payment method", description: "Cash, card, transfer, wallet and online checkout.", group: "Sales", supportsChannelFilter: true, usesDateRange: true },
  { kind: "sales-by-location", title: "Sales by location", description: "Compare your shops with online sales.", group: "Sales", supportsChannelFilter: true, usesDateRange: true },
  { kind: "tax", title: "Tax report", description: "Taxable sales, tax collected per rate and exempt sales.", group: "Tax and stock", supportsChannelFilter: true, usesDateRange: true },
  { kind: "inventory-valuation", title: "Inventory valuation", description: "Stock on hand at cost and at retail price, per location.", group: "Tax and stock", supportsChannelFilter: false, usesDateRange: false },
  { kind: "shifts", title: "Shift reports", description: "Expected and counted cash, and variance, for each shift.", group: "Cash drawer", supportsChannelFilter: false, usesDateRange: true },
];

export function findReportCatalogEntry(kind: string): ReportCatalogEntry | undefined {
  return reportCatalog.find((entry) => entry.kind === kind);
}
