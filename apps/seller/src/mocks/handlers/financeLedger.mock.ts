import { readMockDatabase } from "@/mocks/mockDatabase.mock";
import { convertIsoToStoreDateKey, readWeekStartDateKey } from "@/mocks/handlers/reportSalesRecords.mock";
import type { EscrowEntry, FinanceFeeBreakdown, RefundEntry, Settlement } from "@/types/finance.type";
import type { Money } from "@/types/money.type";
import type { OnlineOrder } from "@/types/order.type";

export const escrowFeeBasisPoints = 150;
export const businessPlanEscrowFeeBasisPoints = 100;
export const paymentProcessingBasisPoints = 150;

function toStoreMoney(amountMinor: number): Money {
  return { amountMinor, currency: readMockDatabase().settings.currency };
}

export function splitOrderFeesIntoEscrowAndProcessing(order: OnlineOrder): { escrowFeeMinor: number; processingMinor: number } {
  const totalFeesMinor = Math.max(0, order.total.amountMinor - order.sellerPayout.amountMinor);
  const escrowFeeMinor = Math.min(totalFeesMinor, Math.round((order.total.amountMinor * escrowFeeBasisPoints) / 10_000));
  return { escrowFeeMinor, processingMinor: totalFeesMinor - escrowFeeMinor };
}

function readEscrowReleasedAt(order: OnlineOrder): string | null {
  if (order.escrowStatus !== "released") return null;
  const base = new Date(order.deliveredAt ?? order.createdAt).getTime();
  return new Date(base + 2 * 86_400_000).toISOString();
}

function readSettlementIdForWeek(weekStartKey: string): string {
  return `stl_${weekStartKey.replace(/-/g, "")}`;
}

export function convertOrderToEscrowEntry(order: OnlineOrder): EscrowEntry {
  const releasedAt = readEscrowReleasedAt(order);
  const timezone = readMockDatabase().settings.timezone;
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    buyerName: order.buyer.name,
    buyerUsername: order.buyer.username,
    gross: order.subtotal,
    fees: toStoreMoney(order.total.amountMinor - order.sellerPayout.amountMinor),
    net: order.sellerPayout,
    status: order.escrowStatus,
    heldAt: order.createdAt,
    releaseExpectedAt: order.escrowStatus === "held" ? order.escrowReleaseAt ?? new Date(new Date(order.createdAt).getTime() + 7 * 86_400_000).toISOString() : null,
    releasedAt,
    settlementId: releasedAt ? readSettlementIdForWeek(readWeekStartDateKey(convertIsoToStoreDateKey(releasedAt, timezone))) : null,
  };
}

export function listEscrowEntries(): EscrowEntry[] {
  return readMockDatabase().onlineOrders.map(convertOrderToEscrowEntry).sort((first, second) => second.heldAt.localeCompare(first.heldAt));
}

export function listSettlements(): Settlement[] {
  const timezone = readMockDatabase().settings.timezone;
  const currentWeekKey = readWeekStartDateKey(convertIsoToStoreDateKey(new Date().toISOString(), timezone));
  const releasedEntries = listEscrowEntries().filter((entry) => entry.releasedAt && entry.settlementId);
  const entriesBySettlement = new Map<string, EscrowEntry[]>();
  for (const entry of releasedEntries) entriesBySettlement.set(entry.settlementId as string, [...(entriesBySettlement.get(entry.settlementId as string) ?? []), entry]);
  return [...entriesBySettlement.entries()]
    .map(([settlementId, entries]) => {
      const weekStartKey = `${settlementId.slice(4, 8)}-${settlementId.slice(8, 10)}-${settlementId.slice(10, 12)}`;
      const weekEnd = new Date(`${weekStartKey}T23:00:00.000Z`);
      weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
      const isCurrentWeek = weekStartKey === currentWeekKey;
      const sumMinor = (readAmount: (entry: EscrowEntry) => Money) => entries.reduce((sum, entry) => sum + readAmount(entry).amountMinor, 0);
      return {
        id: settlementId,
        reference: `STL-${weekStartKey.replace(/-/g, "")}`,
        periodStart: `${weekStartKey}T00:00:00.000Z`,
        periodEnd: weekEnd.toISOString(),
        ordersCount: entries.length,
        gross: toStoreMoney(sumMinor((entry) => entry.gross)),
        fees: toStoreMoney(sumMinor((entry) => entry.fees)),
        net: toStoreMoney(sumMinor((entry) => entry.net)),
        status: isCurrentWeek ? ("clearing" as const) : ("settled" as const),
        settledAt: isCurrentWeek ? new Date().toISOString() : weekEnd.toISOString(),
      };
    })
    .sort((first, second) => second.periodStart.localeCompare(first.periodStart));
}

export function isIsoWithinDateKeys(isoDate: string, fromKey: string, toKey: string): boolean {
  const dateKey = convertIsoToStoreDateKey(isoDate, readMockDatabase().settings.timezone);
  return dateKey >= fromKey && dateKey <= toKey;
}

export function listRefundEntries(): RefundEntry[] {
  const database = readMockDatabase();
  const orderRefunds: RefundEntry[] = database.onlineOrders
    .filter((order) => order.escrowStatus === "refunded")
    .map((order) => ({
      id: `rfd_${order.id}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      buyerName: order.buyer.name,
      kind: order.status === "cancelled" ? ("cancelled_before_shipping" as const) : ("refunded_order" as const),
      reason: order.status === "cancelled" ? "Cancelled before it was shipped" : "Refunded after a problem with the order",
      amount: order.total,
      feesReturned: toStoreMoney(order.total.amountMinor - order.sellerPayout.amountMinor),
      createdAt: new Date(new Date(order.createdAt).getTime() + 86_400_000).toISOString(),
    }));
  const returnRefunds: RefundEntry[] = database.returnRequests
    .filter((returnRequest) => returnRequest.status === "refunded")
    .map((returnRequest) => ({ id: `rfd_${returnRequest.id}`, orderId: returnRequest.orderId, orderNumber: returnRequest.orderNumber, buyerName: returnRequest.buyerName, kind: "approved_return" as const, reason: returnRequest.reason, amount: returnRequest.refundAmount, feesReturned: toStoreMoney(0), createdAt: returnRequest.createdAt }));
  return [...orderRefunds, ...returnRefunds].sort((first, second) => second.createdAt.localeCompare(first.createdAt));
}

export function buildFinanceFeeBreakdown(fromKey: string, toKey: string): FinanceFeeBreakdown {
  const database = readMockDatabase();
  const orders = database.onlineOrders.filter((order) => order.escrowStatus !== "refunded" && isIsoWithinDateKeys(order.createdAt, fromKey, toKey));
  const payouts = database.wallet.payouts.filter((payout) => isIsoWithinDateKeys(payout.requestedAt, fromKey, toKey));
  const walletCharges = database.wallet.transactions.filter((transaction) => isIsoWithinDateKeys(transaction.createdAt, fromKey, toKey));
  const feeSplits = orders.map(splitOrderFeesIntoEscrowAndProcessing);
  const sumCharges = (kind: "ads_charge" | "subscription_charge") => walletCharges.filter((transaction) => transaction.kind === kind);
  const lines = [
    { kind: "escrow_fee" as const, label: "Escrow fee", description: "1.5% of each escrow order including shipping (1% on Business), deducted at payout. Direct payments carry no escrow fee.", rateBasisPoints: escrowFeeBasisPoints, count: orders.length, amount: toStoreMoney(feeSplits.reduce((sum, split) => sum + split.escrowFeeMinor, 0)) },
    { kind: "payment_processing" as const, label: "Payment processing fee", description: "Our payment partner's fee on every order, deducted from your payout.", rateBasisPoints: paymentProcessingBasisPoints, count: orders.length, amount: toStoreMoney(feeSplits.reduce((sum, split) => sum + split.processingMinor, 0)) },
    { kind: "withdrawal" as const, label: "Withdrawal fees", description: "The payment provider's fee for each payout to your bank.", rateBasisPoints: null, count: payouts.length, amount: toStoreMoney(payouts.reduce((sum, payout) => sum + payout.fee.amountMinor, 0)) },
    { kind: "ads" as const, label: "Ads", description: "Spend charged from your wallet by Ads Manager.", rateBasisPoints: null, count: sumCharges("ads_charge").length, amount: toStoreMoney(sumCharges("ads_charge").reduce((sum, transaction) => sum + transaction.amount.amountMinor, 0)) },
    { kind: "subscription" as const, label: "Plan subscription", description: "Pro or Business plan charges paid from your wallet.", rateBasisPoints: null, count: sumCharges("subscription_charge").length, amount: toStoreMoney(sumCharges("subscription_charge").reduce((sum, transaction) => sum + transaction.amount.amountMinor, 0)) },
  ];
  const grossMinor = orders.reduce((sum, order) => sum + order.subtotal.amountMinor, 0);
  const totalFeesMinor = lines.reduce((sum, line) => sum + line.amount.amountMinor, 0);
  return { from: fromKey, to: toKey, grossSales: toStoreMoney(grossMinor), totalFees: toStoreMoney(totalFeesMinor), netEarnings: toStoreMoney(grossMinor - totalFeesMinor), lines };
}
