import { randomBytes } from "node:crypto";

import { findRecordInAccount, requireAccountAccess } from "@/mocks/mockAccountAccess.mock";
import { appendMockActivity, readMockDatabase, type MockAdAccountRecord } from "@/mocks/mockDatabase.mock";
import { MockHttpError, createMockId, failValidation, paginateItems, readIsoNow, readJsonObjectBody, respondWithDownload, respondWithJson, respondWithNoContent } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import type { BillingOverview, FundingMode } from "@/types/billing.type";
import { formatMoneyForDisplay } from "@/utils/money.util";

const topUpLimitsMinorByCurrency: Record<string, { minimum: number; maximum: number; suggested: number[]; lowBalance: number }> = {
  NGN: { minimum: 500_000, maximum: 500_000_000, suggested: [2_000_000, 5_000_000, 10_000_000, 25_000_000], lowBalance: 2_000_000 },
  GHS: { minimum: 5_000, maximum: 5_000_000, suggested: [20_000, 50_000, 100_000, 250_000], lowBalance: 20_000 },
};
const fallbackLimits = { minimum: 1_000, maximum: 1_000_000, suggested: [2_000, 5_000, 10_000, 25_000], lowBalance: 2_000 };

function money(amountMinor: number, currency: string) {
  return { amountMinor, currency };
}

function calculateSpendThisMonthMinor(accountId: string): number {
  const database = readMockDatabase();
  const monthPrefix = new Date().toISOString().slice(0, 7);
  const accountAdIds = new Set(database.ads.filter((ad) => ad.accountId === accountId).map((ad) => ad.id));
  return database.dailyStats.filter((stat) => accountAdIds.has(stat.adId) && stat.date.startsWith(monthPrefix)).reduce((total, stat) => total + stat.spendMinor, 0);
}

function presentBillingOverview(account: MockAdAccountRecord): BillingOverview {
  const limits = topUpLimitsMinorByCurrency[account.currency] ?? fallbackLimits;
  const database = readMockDatabase();
  const activeDailyBudgetMinor = database.campaigns.filter((campaign) => campaign.accountId === account.id && campaign.status === "active").reduce((total, campaign) => total + (campaign.budget?.type === "daily" ? campaign.budget.amount.amountMinor : 0), 0);
  const now = new Date();
  return {
    balance: money(account.balanceMinor, account.currency),
    credits: {
      available: money(account.creditsMinor, account.currency),
      monthlyGrant: account.monthlyCreditMinor ? money(account.monthlyCreditMinor, account.currency) : null,
      expiresAt: account.monthlyCreditMinor ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString() : null,
      source: account.monthlyCreditMinor ? "gold_premium" : null,
    },
    spendLimit: { amount: account.spendLimitMinor === null ? null : money(account.spendLimitMinor, account.currency), spent: money(calculateSpendThisMonthMinor(account.id), account.currency) },
    fundingMode: account.fundingMode,
    paymentMethods: account.paymentMethods,
    lowBalanceThreshold: money(limits.lowBalance, account.currency),
    estimatedDaysOfDelivery: activeDailyBudgetMinor > 0 ? Math.floor((account.balanceMinor + account.creditsMinor) / activeDailyBudgetMinor) : null,
    minimumTopUp: money(limits.minimum, account.currency),
    maximumTopUp: money(limits.maximum, account.currency),
    suggestedTopUps: limits.suggested.map((amountMinor) => money(amountMinor, account.currency)),
  };
}

function readSafeReturnPath(value: unknown, accountId: string): string {
  const fallback = `/accounts/${accountId}/billing/return`;
  return typeof value === "string" && value.startsWith(`/accounts/${accountId}/`) && !value.includes("//") ? value : fallback;
}

const regionalAdPricingRows = [
  { region: "NG", currency: "NGN", cpmFloorMinor: 50_000, cpcFloorMinor: 3_000, minimumDailyBudgetMinor: 100_000, boostMinimumDailyMinor: 100_000 },
  { region: "GH", currency: "GHS", cpmFloorMinor: 600, cpcFloorMinor: 40, minimumDailyBudgetMinor: 1_500, boostMinimumDailyMinor: 1_500 },
  { region: "KE", currency: "KES", cpmFloorMinor: 6_000, cpcFloorMinor: 400, minimumDailyBudgetMinor: 15_000, boostMinimumDailyMinor: 15_000 },
  { region: "ZA", currency: "ZAR", cpmFloorMinor: 1_500, cpcFloorMinor: 120, minimumDailyBudgetMinor: 4_000, boostMinimumDailyMinor: 4_000 },
  { region: "GB", currency: "GBP", cpmFloorMinor: 200, cpcFloorMinor: 15, minimumDailyBudgetMinor: 300, boostMinimumDailyMinor: 300 },
  { region: "EU", currency: "EUR", cpmFloorMinor: 200, cpcFloorMinor: 15, minimumDailyBudgetMinor: 300, boostMinimumDailyMinor: 300 },
  { region: "US", currency: "USD", cpmFloorMinor: 250, cpcFloorMinor: 20, minimumDailyBudgetMinor: 300, boostMinimumDailyMinor: 300 },
];
const unitsPerDollar: Record<string, number> = { USD: 1, NGN: 1550, GHS: 15.5, KES: 129, ZAR: 18.2, GBP: 0.79, EUR: 0.92 };
const eurozoneCountryCodes = new Set(["AT", "BE", "HR", "CY", "EE", "FI", "FR", "DE", "GR", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PT", "SK", "SI", "ES"]);

function presentRegionalAdPricing(countryCodes: readonly string[], currency: string) {
  const regions = [...new Set(countryCodes.map((code) => (eurozoneCountryCodes.has(code) ? "EU" : regionalAdPricingRows.some((row) => row.region === code) ? code : "US")))];
  const targeted = regionalAdPricingRows.filter((row) => (regions.length > 0 ? regions.includes(row.region) : row.currency === currency));
  const strictest = (pick: (row: (typeof regionalAdPricingRows)[number]) => number) =>
    Math.max(...targeted.map((row) => Math.ceil((pick(row) * (unitsPerDollar[currency] ?? 1)) / (unitsPerDollar[row.currency] ?? 1))));
  return {
    billingCurrency: currency, targetedRegions: regions, creatorRevenueSharePercent: 40, regions: regionalAdPricingRows,
    cpmFloor: money(strictest((row) => row.cpmFloorMinor), currency), cpcFloor: money(strictest((row) => row.cpcFloorMinor), currency),
    minimumDailyBudget: money(strictest((row) => row.minimumDailyBudgetMinor), currency), boostMinimumDailyBudget: money(strictest((row) => row.boostMinimumDailyMinor), currency),
  };
}

export function registerBillingMockHandlers(): void {
  registerMockRoute("GET", "/ads/pricing", (request) => {
    const countryCodes = (request.query.get("countries") ?? "").split(",").map((code) => code.trim().toUpperCase()).filter((code) => /^[A-Z]{2}$/.test(code));
    const currency = (request.query.get("currency") ?? "USD").toUpperCase();
    return respondWithJson(200, presentRegionalAdPricing(countryCodes, unitsPerDollar[currency] ? currency : "USD"));
  });
  registerMockRoute("GET", "/ads/accounts/:accountId/billing", (request) => respondWithJson(200, presentBillingOverview(requireAccountAccess(request, "billing:view").account)));

  registerMockRoute("POST", "/ads/accounts/:accountId/billing/top-ups", (request) => {
    const { account } = requireAccountAccess(request, "billing:manage");
    if (!request.headers.get("idempotency-key")) throw new MockHttpError(400, "IDEMPOTENCY_KEY_REQUIRED", "Payments need an Idempotency-Key header.");
    const body = readJsonObjectBody(request);
    const amount = typeof body.amount === "object" && body.amount ? (body.amount as { amountMinor?: unknown; currency?: unknown }) : {};
    const limits = topUpLimitsMinorByCurrency[account.currency] ?? fallbackLimits;
    if (amount.currency !== account.currency) failValidation("amount", `Top-ups must be in ${account.currency}.`);
    if (!Number.isInteger(amount.amountMinor) || (amount.amountMinor as number) < limits.minimum || (amount.amountMinor as number) > limits.maximum) {
      failValidation("amount", `Enter between ${formatMoneyForDisplay(money(limits.minimum, account.currency))} and ${formatMoneyForDisplay(money(limits.maximum, account.currency))}.`);
    }
    const provider = "paystack" as const;
    const reference = `ZDA-${randomBytes(6).toString("hex").toUpperCase()}`;
    const topUpId = createMockId("tup");
    readMockDatabase().topUps.unshift({ id: topUpId, accountId: account.id, reference, amount: money(amount.amountMinor as number, account.currency), status: "pending", provider, createdAt: readIsoNow(), completedAt: null, failureReason: null });
    const returnPath = readSafeReturnPath(body.returnPath, account.id);
    return respondWithJson(201, { topUpId, reference, provider, accessCode: "", authorizationUrl: `${returnPath}?reference=${reference}&demoCheckout=1` });
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/billing/top-ups/:reference", (request) => {
    const { account, userId, actorName } = requireAccountAccess(request, "billing:view");
    const database = readMockDatabase();
    const topUp = database.topUps.find((candidate) => candidate.accountId === account.id && candidate.reference === request.params.reference);
    if (!topUp) throw new MockHttpError(404, "NOT_FOUND", "We could not find that payment.");
    if (topUp.status === "pending") {
      Object.assign(topUp, { status: "succeeded", completedAt: readIsoNow() });
      account.balanceMinor += topUp.amount.amountMinor;
      database.transactions.unshift({ id: createMockId("txn"), accountId: account.id, type: "top_up", amount: topUp.amount, description: "Balance top-up", reference: topUp.reference, createdAt: readIsoNow(), receiptAvailable: true });
      appendMockActivity(account.id, { actor: { id: userId, name: actorName, isSystem: false }, action: "balance_topped_up", objectType: "billing", objectId: topUp.id, objectName: `Top-up ${topUp.reference}`, summary: `Added ${formatMoneyForDisplay(topUp.amount)} to the balance`, changes: [] });
    }
    const { accountId: _accountId, ...publicTopUp } = topUp;
    return respondWithJson(200, publicTopUp);
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/billing/transactions", (request) => {
    const { account } = requireAccountAccess(request, "billing:view");
    const page = paginateItems(readMockDatabase().transactions.filter((transaction) => transaction.accountId === account.id), request, 25);
    return respondWithJson(200, { ...page, items: page.items.map(({ accountId: _accountId, ...transaction }) => transaction) });
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/billing/transactions/:transactionId/receipt", (request) => {
    const { account } = requireAccountAccess(request, "billing:view");
    const transaction = findRecordInAccount(readMockDatabase().transactions, account.id, request.params.transactionId, "transaction");
    if (!transaction.receiptAvailable) throw new MockHttpError(404, "NO_RECEIPT", "This transaction has no receipt.");
    const text = ["Zudomart Ads — payment receipt", `Ad account: ${account.name} (${account.id})`, `Reference: ${transaction.reference}`, `Date: ${transaction.createdAt}`, `Amount: ${formatMoneyForDisplay(transaction.amount)}`, `Description: ${transaction.description}`].join("\n");
    return respondWithDownload(`receipt-${transaction.reference}.txt`, text, "text/plain; charset=utf-8");
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/billing/invoices", (request) => {
    const { account } = requireAccountAccess(request, "billing:view");
    const page = paginateItems(readMockDatabase().invoices.filter((invoice) => invoice.accountId === account.id), request, 24);
    return respondWithJson(200, { ...page, items: page.items.map(({ accountId: _accountId, ...invoice }) => invoice) });
  });

  registerMockRoute("GET", "/ads/accounts/:accountId/billing/invoices/:invoiceId/download", (request) => {
    const { account } = requireAccountAccess(request, "billing:view");
    const invoice = findRecordInAccount(readMockDatabase().invoices, account.id, request.params.invoiceId, "invoice");
    const text = ["Zudomart Ads — tax invoice", `Invoice: ${invoice.number}`, `Ad account: ${account.name} (${account.id})`, `Period: ${invoice.periodStart} to ${invoice.periodEnd}`, `Subtotal: ${formatMoneyForDisplay(invoice.subtotal)}`, `VAT: ${formatMoneyForDisplay(invoice.tax)}`, `Total: ${formatMoneyForDisplay(invoice.total)}`, `Status: ${invoice.status}`].join("\n");
    return respondWithDownload(`${invoice.number}.txt`, text, "text/plain; charset=utf-8");
  });

  registerMockRoute("PUT", "/ads/accounts/:accountId/billing/spend-limit", (request) => {
    const { account } = requireAccountAccess(request, "billing:manage");
    const amount = readJsonObjectBody(request).amount as { amountMinor?: unknown; currency?: unknown } | null;
    if (amount === null) account.spendLimitMinor = null;
    else if (amount && amount.currency === account.currency && Number.isInteger(amount.amountMinor) && (amount.amountMinor as number) > 0) account.spendLimitMinor = amount.amountMinor as number;
    else failValidation("amount", `Enter a monthly limit in ${account.currency}, or remove the limit.`);
    return respondWithJson(200, presentBillingOverview(account));
  });

  registerMockRoute("PUT", "/ads/accounts/:accountId/billing/funding-mode", (request) => {
    const { account } = requireAccountAccess(request, "billing:manage");
    const fundingMode = readJsonObjectBody(request).fundingMode as FundingMode;
    if (!["prepaid", "card", "prepaid_and_card"].includes(fundingMode)) failValidation("fundingMode", "Choose how to pay.");
    if (fundingMode !== "prepaid" && account.paymentMethods.length === 0) failValidation("fundingMode", "Add a card first.");
    account.fundingMode = fundingMode;
    return respondWithJson(200, presentBillingOverview(account));
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/billing/payment-methods", (request) => {
    const { account } = requireAccountAccess(request, "billing:manage");
    if (!request.headers.get("idempotency-key")) throw new MockHttpError(400, "IDEMPOTENCY_KEY_REQUIRED", "Payments need an Idempotency-Key header.");
    const body = readJsonObjectBody(request);
    const reference = `ZDC-${randomBytes(6).toString("hex").toUpperCase()}`;
    account.paymentMethods.push({ id: createMockId("pm"), brand: "Verve", last4: String(1000 + Math.floor(Math.random() * 8999)), expMonth: 12, expYear: new Date().getUTCFullYear() + 3, isDefault: account.paymentMethods.length === 0, provider: "paystack" });
    return respondWithJson(201, { topUpId: "", reference, provider: "paystack", accessCode: "", authorizationUrl: `${readSafeReturnPath(body.returnPath, account.id)}?cardReference=${reference}&demoCheckout=1` });
  });

  registerMockRoute("POST", "/ads/accounts/:accountId/billing/payment-methods/:paymentMethodId/default", (request) => {
    const { account } = requireAccountAccess(request, "billing:manage");
    if (!account.paymentMethods.some((method) => method.id === request.params.paymentMethodId)) throw new MockHttpError(404, "NOT_FOUND", "Card not found.");
    account.paymentMethods = account.paymentMethods.map((method) => ({ ...method, isDefault: method.id === request.params.paymentMethodId }));
    return respondWithJson(200, presentBillingOverview(account));
  });

  registerMockRoute("DELETE", "/ads/accounts/:accountId/billing/payment-methods/:paymentMethodId", (request) => {
    const { account } = requireAccountAccess(request, "billing:manage");
    const remaining = account.paymentMethods.filter((method) => method.id !== request.params.paymentMethodId);
    if (remaining.length === account.paymentMethods.length) throw new MockHttpError(404, "NOT_FOUND", "Card not found.");
    if (remaining.length === 0 && account.fundingMode !== "prepaid") throw new MockHttpError(409, "CARD_REQUIRED", "Switch to prepaid balance before removing your only card.");
    account.paymentMethods = remaining.map((method, index) => ({ ...method, isDefault: index === 0 ? true : method.isDefault && index === 0 }));
    return respondWithNoContent();
  });
}
