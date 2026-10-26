import { buildAccountApiPath, sendAdsApiRequest } from "@/services/adsApiClient.service";
import type { Page } from "@/types/api.type";
import type { BillingOverview, BillingTransaction, CampaignCostEstimate, CampaignCostEstimateRequest, FundingMode, Invoice, PaymentProvider, RegionalAdPricing, TopUp, TopUpCheckout } from "@/types/billing.type";
import type { Money } from "@/types/money.type";
import type { EarningsFunding } from "@/types/nanttyWallet.type";

export const billingApi = {
  estimateCampaignCost: (request: CampaignCostEstimateRequest) => sendAdsApiRequest<CampaignCostEstimate>("/ads/pricing/estimate", { method: "POST", body: request }),
  fetchRegionalPricing: (countryCodes: readonly string[], currency: string) => sendAdsApiRequest<RegionalAdPricing>("/ads/pricing", { query: { countries: countryCodes.join(","), currency } }),
  fetchBillingOverview: (accountId: string) => sendAdsApiRequest<BillingOverview>(buildAccountApiPath(accountId, "/billing")),
  startTopUpCheckout: (accountId: string, amount: Money, provider: PaymentProvider, idempotencyKey: string) =>
    sendAdsApiRequest<TopUpCheckout>(buildAccountApiPath(accountId, "/billing/top-ups"), { method: "POST", body: { amount, provider, returnPath: `/accounts/${accountId}/billing/return` }, idempotencyKey }),
  fundFromEarnings: (accountId: string, amount: Money, idempotencyKey: string, stepUpToken?: string) =>
    sendAdsApiRequest<EarningsFunding>(buildAccountApiPath(accountId, "/billing/fund-from-earnings"), { method: "POST", body: { amount }, idempotencyKey, ...(stepUpToken ? { stepUpToken } : {}) }),
  fetchTopUpByReference: (accountId: string, reference: string) => sendAdsApiRequest<TopUp>(buildAccountApiPath(accountId, `/billing/top-ups/${encodeURIComponent(reference)}`)),
  listTransactions: (accountId: string, cursor: string | null = null) =>
    sendAdsApiRequest<Page<BillingTransaction>>(buildAccountApiPath(accountId, "/billing/transactions"), { query: { cursor, limit: 25 } }),
  listInvoices: (accountId: string) => sendAdsApiRequest<Page<Invoice>>(buildAccountApiPath(accountId, "/billing/invoices"), { query: { limit: 24 } }),
  downloadInvoice: (accountId: string, invoiceId: string) =>
    sendAdsApiRequest<Blob>(buildAccountApiPath(accountId, `/billing/invoices/${encodeURIComponent(invoiceId)}/download`), { expect: "blob" }),
  downloadReceipt: (accountId: string, transactionId: string) =>
    sendAdsApiRequest<Blob>(buildAccountApiPath(accountId, `/billing/transactions/${encodeURIComponent(transactionId)}/receipt`), { expect: "blob" }),
  updateSpendLimit: (accountId: string, amount: Money | null) => sendAdsApiRequest<BillingOverview>(buildAccountApiPath(accountId, "/billing/spend-limit"), { method: "PUT", body: { amount } }),
  updateFundingMode: (accountId: string, fundingMode: FundingMode) => sendAdsApiRequest<BillingOverview>(buildAccountApiPath(accountId, "/billing/funding-mode"), { method: "PUT", body: { fundingMode } }),
  startAddingCard: (accountId: string, provider: PaymentProvider, idempotencyKey: string) =>
    sendAdsApiRequest<TopUpCheckout>(buildAccountApiPath(accountId, "/billing/payment-methods"), { method: "POST", body: { provider, returnPath: `/accounts/${accountId}/billing/return` }, idempotencyKey }),
  makeCardDefault: (accountId: string, paymentMethodId: string) =>
    sendAdsApiRequest<BillingOverview>(buildAccountApiPath(accountId, `/billing/payment-methods/${encodeURIComponent(paymentMethodId)}/default`), { method: "POST" }),
  removeCard: (accountId: string, paymentMethodId: string) =>
    sendAdsApiRequest<void>(buildAccountApiPath(accountId, `/billing/payment-methods/${encodeURIComponent(paymentMethodId)}`), { method: "DELETE" }),
};
