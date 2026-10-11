import type { MockAdAccountRecord } from "@/mocks/mockDatabase.mock";
import { shiftIsoDateByDays, shiftTimestampByDays } from "@/mocks/seed/seededRandom.mock";
import type { BillingTransaction, Invoice, TopUp } from "@/types/billing.type";

export function buildDemoBillingRecords(accounts: readonly MockAdAccountRecord[]) {
  const topUps: (TopUp & { accountId: string })[] = [];
  const transactions: (BillingTransaction & { accountId: string })[] = [];
  const invoices: (Invoice & { accountId: string })[] = [];
  for (const account of accounts) {
    const topUpAmounts = account.currency === "NGN" ? [500_000, 250_000, 150_000, 300_000] : [1_500, 800, 1_200];
    topUpAmounts.forEach((amountMajor, index) => {
      const reference = `ZDA-${account.id.slice(4, 8).toUpperCase()}-${1000 + index}`;
      const createdAt = shiftTimestampByDays(-(index * 13 + 3), 11);
      topUps.push({ id: `tup_${account.id}_${index}`, accountId: account.id, reference, amount: { amountMinor: amountMajor * 100, currency: account.currency }, status: "succeeded", provider: index === 0 ? "flutterwave" : "paystack", createdAt, completedAt: createdAt, failureReason: null });
      transactions.push({ id: `txn_${account.id}_top_${index}`, accountId: account.id, type: "top_up", amount: { amountMinor: amountMajor * 100, currency: account.currency }, description: "Balance top-up", reference, createdAt, receiptAvailable: true });
    });
    for (let dayOffset = 1; dayOffset <= 20; dayOffset += 1) {
      const dailySpend = account.currency === "NGN" ? (account.id === "act_ifelifestyle" ? 3_450_000 : 1_100_000) : 16_500;
      transactions.push({ id: `txn_${account.id}_spend_${dayOffset}`, accountId: account.id, type: "ad_spend", amount: { amountMinor: -Math.round(dailySpend * (0.85 + ((dayOffset * 7) % 10) / 60)), currency: account.currency }, description: `Ad delivery on ${shiftIsoDateByDays(-dayOffset)}`, reference: `SPD-${shiftIsoDateByDays(-dayOffset).replace(/-/g, "")}`, createdAt: shiftTimestampByDays(-dayOffset + 1, 1), receiptAvailable: false });
    }
    if (account.monthlyCreditMinor) {
      transactions.push({ id: `txn_${account.id}_credit`, accountId: account.id, type: "credit_grant", amount: { amountMinor: account.monthlyCreditMinor, currency: account.currency }, description: "Gold Premium monthly ad credit", reference: `CRD-${shiftIsoDateByDays(-28).slice(0, 7)}`, createdAt: shiftTimestampByDays(-28, 0), receiptAvailable: false });
    }
    for (let monthOffset = 1; monthOffset <= 3; monthOffset += 1) {
      const now = new Date();
      const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthOffset, 1)).toISOString().slice(0, 10);
      const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthOffset + 1, 0)).toISOString().slice(0, 10);
      const subtotalMinor = (account.currency === "NGN" ? 72_000_000 : 420_000) / (monthOffset + 0.5);
      const taxMinor = Math.round(subtotalMinor * 0.075);
      invoices.push({
        id: `inv_${account.id}_${monthOffset}`,
        accountId: account.id,
        number: `ZDA-${periodStart.slice(0, 7).replace("-", "")}-${account.id.slice(4, 7).toUpperCase()}`,
        periodStart,
        periodEnd,
        subtotal: { amountMinor: Math.round(subtotalMinor), currency: account.currency },
        tax: { amountMinor: taxMinor, currency: account.currency },
        total: { amountMinor: Math.round(subtotalMinor) + taxMinor, currency: account.currency },
        status: "paid",
        issuedAt: `${shiftIsoDateByDays(1, new Date(`${periodEnd}T00:00:00Z`))}T08:00:00.000Z`,
      });
    }
  }
  transactions.sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  return { topUps, transactions, invoices };
}
