import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { buildFinanceFeeBreakdown, isIsoWithinDateKeys, listRefundEntries, listSettlements } from "@/mocks/handlers/financeLedger.mock";
import { createStoreMoney, type BuiltReportTable } from "@/mocks/handlers/reportSalesBuilders.mock";
import { calculateBasisPointsShare, type ReportFilters } from "@/mocks/handlers/reportSalesRecords.mock";
import { createSeededRandomNumberGenerator, pickRandomIntegerInclusive } from "@/mocks/seed/seededRandom.mock";

const refundKindLabels = { cancelled_before_shipping: "Cancelled before shipping", refunded_order: "Refunded order", approved_return: "Approved return" } as const;

export function buildSettlementsReport(filters: ReportFilters): BuiltReportTable {
  const settlements = listSettlements().filter((settlement) => isIsoWithinDateKeys(settlement.settledAt, filters.fromKey, filters.toKey));
  const sum = (key: "gross" | "fees" | "net") => createStoreMoney(settlements.reduce((total, settlement) => total + settlement[key].amountMinor, 0));
  return {
    columns: [
      { key: "reference", label: "Reference", kind: "text" },
      { key: "settledAt", label: "Settled", kind: "date" },
      { key: "orders", label: "Orders", kind: "number" },
      { key: "gross", label: "Gross", kind: "money" },
      { key: "fees", label: "Fees", kind: "money" },
      { key: "net", label: "Net to wallet", kind: "money" },
      { key: "status", label: "Status", kind: "text" },
    ],
    rows: settlements.map((settlement) => ({ reference: settlement.reference, settledAt: settlement.settledAt, orders: settlement.ordersCount, gross: settlement.gross, fees: settlement.fees, net: settlement.net, status: settlement.status === "settled" ? "Settled" : "Clearing" })),
    totals: { reference: "Total", settledAt: null, orders: settlements.reduce((total, settlement) => total + settlement.ordersCount, 0), gross: sum("gross"), fees: sum("fees"), net: sum("net"), status: null },
  };
}

export function buildFeesReport(filters: ReportFilters): BuiltReportTable {
  const breakdown = buildFinanceFeeBreakdown(filters.fromKey, filters.toKey);
  return {
    columns: [
      { key: "fee", label: "Fee", kind: "text" },
      { key: "rate", label: "Rate", kind: "percent" },
      { key: "count", label: "Charges", kind: "number" },
      { key: "amount", label: "Amount", kind: "money" },
      { key: "shareOfSales", label: "Share of sales", kind: "percent" },
    ],
    rows: breakdown.lines.map((line) => ({ fee: line.label, rate: line.rateBasisPoints, count: line.count, amount: line.amount, shareOfSales: calculateBasisPointsShare(line.amount.amountMinor, breakdown.grossSales.amountMinor) })),
    totals: { fee: "Total", rate: null, count: breakdown.lines.reduce((total, line) => total + line.count, 0), amount: breakdown.totalFees, shareOfSales: calculateBasisPointsShare(breakdown.totalFees.amountMinor, breakdown.grossSales.amountMinor) },
  };
}

export function buildRefundsReport(filters: ReportFilters): BuiltReportTable {
  const refunds = listRefundEntries().filter((refund) => isIsoWithinDateKeys(refund.createdAt, filters.fromKey, filters.toKey));
  return {
    columns: [
      { key: "date", label: "Date", kind: "date" },
      { key: "order", label: "Order", kind: "text" },
      { key: "customer", label: "Customer", kind: "text" },
      { key: "kind", label: "Type", kind: "text" },
      { key: "reason", label: "Reason", kind: "text" },
      { key: "amount", label: "Refunded", kind: "money" },
    ],
    rows: refunds.map((refund) => ({ date: refund.createdAt, order: refund.orderNumber, customer: refund.buyerName, kind: refundKindLabels[refund.kind], reason: refund.reason, amount: refund.amount })),
    totals: { date: "Total", order: `${refunds.length} refunds`, customer: null, kind: null, reason: null, amount: createStoreMoney(refunds.reduce((total, refund) => total + refund.amount.amountMinor, 0)) },
  };
}

export function buildPayoutsReport(filters: ReportFilters): BuiltReportTable {
  const payouts = readMockDatabase().wallet.payouts.filter((payout) => isIsoWithinDateKeys(payout.requestedAt, filters.fromKey, filters.toKey));
  return {
    columns: [
      { key: "requestedAt", label: "Requested", kind: "date" },
      { key: "reference", label: "Reference", kind: "text" },
      { key: "account", label: "Account", kind: "text" },
      { key: "status", label: "Status", kind: "text" },
      { key: "amount", label: "Amount", kind: "money" },
      { key: "fee", label: "Fee", kind: "money" },
    ],
    rows: payouts.map((payout) => ({ requestedAt: payout.requestedAt, reference: payout.reference, account: payout.accountSummary, status: payout.status === "paid" ? "Paid" : payout.status === "failed" ? "Failed" : "Processing", amount: payout.amount, fee: payout.fee })),
    totals: { requestedAt: "Total", reference: null, account: null, status: `${payouts.length} payouts`, amount: createStoreMoney(payouts.reduce((total, payout) => total + payout.amount.amountMinor, 0)), fee: createStoreMoney(payouts.reduce((total, payout) => total + payout.fee.amountMinor, 0)) },
  };
}

const demoCampaignNames = ["Detty December teaser", "New arrivals boost", "Weekend flash sale", "Lagos retargeting", "Abuja lookalike", "Bestsellers carousel"];

export function buildAdsCampaignsReport(filters: ReportFilters): BuiltReportTable {
  const database = readMockDatabase();
  const days = Math.max(1, Math.round((new Date(filters.toKey).getTime() - new Date(filters.fromKey).getTime()) / 86_400_000) + 1);
  const random = createSeededRandomNumberGenerator(database.storeId.length * 7919 + days);
  const averageOrderMinor = database.onlineOrders.length > 0 ? Math.round(database.onlineOrders.reduce((sum, order) => sum + order.subtotal.amountMinor, 0) / database.onlineOrders.length) : 2_000_000;
  const rows = demoCampaignNames.map((campaignName, index) => {
    const spendMinor = pickRandomIntegerInclusive(15_000, 60_000, random) * days * (index < 3 ? 2 : 1);
    const impressions = Math.round(spendMinor / pickRandomIntegerInclusive(180, 420, random)) * 10;
    const clicks = Math.round(impressions * (pickRandomIntegerInclusive(8, 32, random) / 1000));
    const orders = Math.round(clicks * (pickRandomIntegerInclusive(15, 45, random) / 1000));
    const revenueMinor = orders * averageOrderMinor;
    return { campaign: campaignName, status: index === 4 ? "Paused" : "Active", spend: createStoreMoney(spendMinor), impressions, clicks, clickThroughRate: calculateBasisPointsShare(clicks, impressions), orders, revenue: createStoreMoney(revenueMinor), roas: spendMinor === 0 ? 0 : Math.round((revenueMinor / spendMinor) * 100) / 100 };
  });
  const totalSpendMinor = rows.reduce((sum, row) => sum + row.spend.amountMinor, 0);
  const totalRevenueMinor = rows.reduce((sum, row) => sum + row.revenue.amountMinor, 0);
  const totalImpressions = rows.reduce((sum, row) => sum + row.impressions, 0);
  const totalClicks = rows.reduce((sum, row) => sum + row.clicks, 0);
  return {
    columns: [
      { key: "campaign", label: "Campaign", kind: "text" },
      { key: "status", label: "Status", kind: "text" },
      { key: "spend", label: "Spend", kind: "money" },
      { key: "impressions", label: "Impressions", kind: "number" },
      { key: "clicks", label: "Clicks", kind: "number" },
      { key: "clickThroughRate", label: "CTR", kind: "percent" },
      { key: "orders", label: "Attributed orders", kind: "number" },
      { key: "revenue", label: "Attributed revenue", kind: "money" },
      { key: "roas", label: "ROAS (x)", kind: "number" },
    ],
    rows,
    totals: { campaign: "Total", status: null, spend: createStoreMoney(totalSpendMinor), impressions: totalImpressions, clicks: totalClicks, clickThroughRate: calculateBasisPointsShare(totalClicks, totalImpressions), orders: rows.reduce((sum, row) => sum + row.orders, 0), revenue: createStoreMoney(totalRevenueMinor), roas: totalSpendMinor === 0 ? 0 : Math.round((totalRevenueMinor / totalSpendMinor) * 100) / 100 },
  };
}
