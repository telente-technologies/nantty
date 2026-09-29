import type { CommandBus } from "@zudojs/cqrs";

import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { PaymentProvider } from "../../../enums/paymentStatus.enum.js";
import { adsError, adsNotFound, throwIfValidationIssues } from "../../../errors/ads.error.js";
import { Money } from "../../../utils/money.util.js";
import type { StartedWalletTopUp } from "../../wallets/services/walletTopUps.service.js";
import type { WalletTopUpRecord } from "../../wallets/models/wallets.model.js";
import { StartWalletTopUpCommand } from "../../wallets/commands/startWalletTopUp/startWalletTopUp.command.js";
import { VerifyWalletTopUpCommand } from "../../wallets/commands/verifyWalletTopUp/verifyWalletTopUp.command.js";
import type { AdAccountRecord } from "../models/adAccounts.model.js";
import { FALLBACK_TOP_UP_LIMITS, TOP_UP_LIMITS_BY_CURRENCY, type AdPaymentProvider, type AdTopUpRecord, type FundingMode } from "../models/adBilling.model.js";
import type { AdBillingTransactionRecord } from "../models/adDelivery.model.js";
import type { AdsDependencies } from "../models/adsDependencies.model.js";
import type { AdsToolsRepositories } from "../models/adsToolsDependencies.model.js";
import { paginateAdsItems, type AdAccountAccess } from "./adAccountAccess.service.js";
import { describeAdvertiser } from "./adAccounts.service.js";
import type { AdPaymentMethodsService } from "./adPaymentMethods.service.js";

const SPENDING_TRANSACTION_TYPES = new Set(["ad_spend", "credit_spend", "card_charge"]);

export function readMonthPrefix(date: Date): string {
  return date.toISOString().slice(0, 7);
}

export function presentBillingTransaction(transaction: AdBillingTransactionRecord) {
  const signedAmount = SPENDING_TRANSACTION_TYPES.has(transaction.type) ? -Math.abs(transaction.amountMinor) : transaction.amountMinor;
  return {
    id: transaction.id,
    type: transaction.type,
    amount: Money.of(signedAmount, transaction.currency).toDto(),
    description: transaction.description,
    reference: transaction.reference,
    createdAt: transaction.createdAt.toISOString(),
    receiptAvailable: transaction.type === "top_up" || transaction.type === "refund" || transaction.type === "card_charge",
  };
}

export class AdBillingAccountService {
  public constructor(
    private readonly dependencies: AdsDependencies,
    private readonly repositories: AdsToolsRepositories,
    private readonly access: AdAccountAccess,
    private readonly commands: CommandBus,
    private readonly paymentMethods: AdPaymentMethodsService,
    private readonly billingReturnBaseUrl: string | undefined,
  ) {}

  public async readOverview(userId: string, accountId: string) {
    const { account } = await this.access.requirePermission(userId, accountId, "billing:view");
    return this.presentOverview(account);
  }

  public async presentOverview(account: AdAccountRecord) {
    const { advertiserBilling, delivery, entitlements, campaigns, clock } = this.dependencies;
    const currency = account.currency;
    const limits = TOP_UP_LIMITS_BY_CURRENCY[currency] ?? FALLBACK_TOP_UP_LIMITS;
    const now = clock.now();
    const month = readMonthPrefix(now);
    const transactions = (await delivery.listBillingTransactions(account.id)).filter((transaction) => readMonthPrefix(transaction.createdAt) === month);
    const spentThisMonth = transactions.filter((transaction) => transaction.type === "ad_spend" || transaction.type === "credit_spend").reduce((total, transaction) => total + Math.abs(transaction.amountMinor), 0);
    const creditsUsed = transactions.filter((transaction) => transaction.type === "credit_spend").reduce((total, transaction) => total + Math.abs(transaction.amountMinor), 0);
    const profile = account.storeId === null ? await entitlements.findEntitlementsForUser(account.ownerId) : await entitlements.findEntitlementsForStore(account.storeId);
    const grant = profile.entitlements["ads.monthly_credit_minor"];
    const monthlyGrant = typeof grant === "number" && grant > 0 ? grant : 0;
    let balance = Money.zero(currency);
    try {
      balance = await advertiserBilling.findAdvertiserWalletBalance(describeAdvertiser(account), currency);
    } catch {
      balance = Money.zero(currency);
    }
    const availableCredits = Math.max(0, monthlyGrant - creditsUsed);
    const dailyBudgets = (await campaigns.listCampaigns(account.id))
      .filter((campaign) => campaign.status === "active" && campaign.budgetType === "daily")
      .reduce((total, campaign) => total + (campaign.budgetMinor ?? 0), 0);
    return {
      balance: balance.toDto(),
      credits: {
        available: Money.of(availableCredits, currency).toDto(),
        monthlyGrant: monthlyGrant > 0 ? Money.of(monthlyGrant, currency).toDto() : null,
        expiresAt: monthlyGrant > 0 ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString() : null,
        source: monthlyGrant > 0 ? ("gold_premium" as const) : null,
      },
      spendLimit: {
        amount: account.monthlySpendLimitMinor === null ? null : Money.of(account.monthlySpendLimitMinor, currency).toDto(),
        spent: Money.of(spentThisMonth, currency).toDto(),
      },
      fundingMode: await this.repositories.billingSettings.findFundingMode(account.id),
      paymentMethods: await this.paymentMethods.listActivePaymentMethods(account),
      lowBalanceThreshold: Money.of(limits.lowBalance, currency).toDto(),
      estimatedDaysOfDelivery: dailyBudgets > 0 ? Math.floor((Math.max(0, balance.amountMinor) + availableCredits) / dailyBudgets) : null,
      minimumTopUp: Money.of(limits.minimum, currency).toDto(),
      maximumTopUp: Money.of(limits.maximum, currency).toDto(),
      suggestedTopUps: limits.suggested.map((amountMinor) => Money.of(amountMinor, currency).toDto()),
    };
  }

  public async startTopUp(userId: string, accountId: string, amount: { readonly amountMinor: number; readonly currency: string }, provider: AdPaymentProvider, returnPath: string) {
    const { account, member } = await this.access.requirePermission(userId, accountId, "billing:manage");
    const limits = TOP_UP_LIMITS_BY_CURRENCY[account.currency] ?? FALLBACK_TOP_UP_LIMITS;
    if (amount.currency !== account.currency) throwIfValidationIssues([{ path: "amount", message: `Top-ups must be in ${account.currency}.` }]);
    if (amount.amountMinor < limits.minimum || amount.amountMinor > limits.maximum) throwIfValidationIssues([{ path: "amount", message: "The amount is outside the allowed top-up range." }]);
    if (account.storeId !== null || account.ownerId !== member.userId) {
      throw adsError(409, "TOP_UP_NOT_SUPPORTED", "Business ad accounts spend from the store wallet; only the owner of a personal ad account can top up here.");
    }
    const returnTo = this.billingReturnBaseUrl === undefined ? undefined : `${this.billingReturnBaseUrl}${this.readSafeReturnPath(returnPath, accountId)}`;
    const started = await this.commands.execute<StartWalletTopUpCommand, StartedWalletTopUp>(
      new StartWalletTopUpCommand({ userId, roles: [], sessionId: "" }, amount.amountMinor, account.currency as CurrencyCode, provider as PaymentProvider, returnTo),
    );
    const topUp = await this.repositories.billingSettings.createTopUp({
      accountId,
      requestedById: userId,
      reference: started.topUp.reference,
      walletReference: started.topUp.reference,
      amountMinor: amount.amountMinor,
      currency: account.currency,
      provider,
      createdAt: this.dependencies.clock.now(),
    });
    return { topUpId: topUp.id, reference: topUp.reference, provider, authorizationUrl: started.authorizationUrl };
  }

  public async readTopUp(userId: string, accountId: string, reference: string) {
    await this.access.requirePermission(userId, accountId, "billing:view");
    const topUp = await this.repositories.billingSettings.findTopUpByReference(reference);
    if (topUp === undefined || topUp.accountId !== accountId) throw adsNotFound("Top-up");
    return this.presentTopUp(topUp.status === "pending" ? await this.settleTopUp(topUp) : topUp);
  }

  public async listTransactions(userId: string, accountId: string, cursor: string | undefined, limit: number) {
    await this.access.requirePermission(userId, accountId, "billing:view");
    return paginateAdsItems((await this.dependencies.delivery.listBillingTransactions(accountId)).map(presentBillingTransaction), cursor, limit);
  }

  public async updateSpendLimit(userId: string, accountId: string, amount: { readonly amountMinor: number; readonly currency: string } | null) {
    const { account } = await this.access.requirePermission(userId, accountId, "billing:manage");
    if (amount !== null && (amount.currency !== account.currency || amount.amountMinor <= 0)) {
      throwIfValidationIssues([{ path: "amount", message: `Enter a monthly limit in ${account.currency}, or remove the limit.` }]);
    }
    const updated = await this.dependencies.accounts.updateAccount(accountId, { monthlySpendLimitMinor: amount?.amountMinor ?? null }, this.dependencies.clock.now());
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "billing", objectId: accountId, summary: "Changed the monthly spending limit", changes: [{ field: "spendLimit", from: account.monthlySpendLimitMinor, to: amount?.amountMinor ?? null }] });
    await this.dependencies.audit.record({ actorId: userId, action: "ads.spend_limit_changed", entityType: "ad_account", entityId: accountId, metadata: { amountMinor: amount?.amountMinor ?? null } });
    return this.presentOverview(updated);
  }

  public async updateFundingMode(userId: string, accountId: string, fundingMode: FundingMode) {
    const { account } = await this.access.requirePermission(userId, accountId, "billing:manage");
    if (fundingMode !== "prepaid" && (await this.paymentMethods.listActivePaymentMethods(account)).length === 0) throwIfValidationIssues([{ path: "fundingMode", message: "Add a card first." }]);
    await this.repositories.billingSettings.saveFundingMode(accountId, fundingMode);
    await this.access.recordActivity({ accountId, actorId: userId, objectType: "billing", objectId: accountId, summary: `Changed the funding mode to ${fundingMode}`, changes: [] });
    return this.presentOverview(account);
  }

  public startCardAuthorization(userId: string, accountId: string, provider: AdPaymentProvider, returnPath: string) {
    return this.paymentMethods.startCardAuthorization(userId, accountId, provider, returnPath);
  }

  public async makeDefaultPaymentMethod(userId: string, accountId: string, paymentMethodId: string) {
    return this.presentOverview(await this.paymentMethods.makeDefault(userId, accountId, paymentMethodId));
  }

  public removePaymentMethod(userId: string, accountId: string, paymentMethodId: string): Promise<void> {
    return this.paymentMethods.removePaymentMethod(userId, accountId, paymentMethodId);
  }

  private async settleTopUp(topUp: AdTopUpRecord): Promise<AdTopUpRecord> {
    const { billingSettings } = this.repositories;
    const wallet = await this.commands.execute<VerifyWalletTopUpCommand, WalletTopUpRecord>(new VerifyWalletTopUpCommand({ userId: topUp.requestedById, roles: [], sessionId: "" }, topUp.walletReference));
    if (wallet.status === "pending") return topUp;
    const now = this.dependencies.clock.now();
    if (wallet.status === "failed") {
      await billingSettings.completeTopUp(topUp.id, "failed", now, "The payment was not completed.");
    } else if (await billingSettings.completeTopUp(topUp.id, "succeeded", wallet.creditedAt ?? now, null)) {
      await this.dependencies.delivery.recordBillingTransaction({
        accountId: topUp.accountId, type: "top_up", amountMinor: topUp.amountMinor, currency: topUp.currency, description: "Balance top-up", reference: `top-up:${topUp.reference}`, createdAt: now,
      });
      await this.access.recordActivity({ accountId: topUp.accountId, actorId: topUp.requestedById, objectType: "billing", objectId: topUp.id, summary: `Topped up ${topUp.currency} ${(topUp.amountMinor / 100).toFixed(2)}`, changes: [] });
    }
    return (await billingSettings.findTopUpByReference(topUp.reference)) ?? topUp;
  }

  private presentTopUp(topUp: AdTopUpRecord) {
    return {
      id: topUp.id,
      reference: topUp.reference,
      amount: Money.of(topUp.amountMinor, topUp.currency).toDto(),
      status: topUp.status,
      provider: topUp.provider,
      createdAt: topUp.createdAt.toISOString(),
      completedAt: topUp.completedAt?.toISOString() ?? null,
      failureReason: topUp.failureReason,
    };
  }

  private readSafeReturnPath(value: string, accountId: string): string {
    return value.startsWith(`/accounts/${accountId}/`) && !value.includes("//") ? value : `/accounts/${accountId}/billing/return`;
  }
}
