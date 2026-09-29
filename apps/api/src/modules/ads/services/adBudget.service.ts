import type { CurrencyCode } from "../../../enums/currency.enum.js";
import { Money } from "../../../utils/money.util.js";
import type { AdAccountRecord } from "../models/adAccounts.model.js";
import type { AdCampaignRecord, AdSetRecord } from "../models/adCampaigns.model.js";
import { MILLI_MINOR_UNITS_PER_MINOR_UNIT, type AdServingRecord, type SpendReservation } from "../models/adDelivery.model.js";
import type { AdsDependencies } from "../models/adsDependencies.model.js";
import { describeAdvertiser } from "./adAccounts.service.js";

export type ChargeOutcome = { readonly billed: true; readonly chargeMilliMinor: number } | { readonly billed: false; readonly reason: "budget_exhausted" | "insufficient_funds" };

export function describeDayPeriod(moment: Date): string {
  return `day:${moment.toISOString().slice(0, 10)}`;
}

export function describeMonthPeriod(moment: Date): string {
  return `month:${moment.toISOString().slice(0, 7)}`;
}

export const TOTAL_PERIOD = "total";

export function countWholeUnitsCrossed(totalAfterAddingMilliMinor: number, addedMilliMinor: number): number {
  const before = totalAfterAddingMilliMinor - addedMilliMinor;
  return Math.floor(totalAfterAddingMilliMinor / MILLI_MINOR_UNITS_PER_MINOR_UNIT) - Math.floor(before / MILLI_MINOR_UNITS_PER_MINOR_UNIT);
}
const UNBILLED_PERIOD = "unbilled";

export function toMilliMinor(minor: number): number {
  return minor * MILLI_MINOR_UNITS_PER_MINOR_UNIT;
}

export function buildSpendReservations(account: AdAccountRecord, campaign: AdCampaignRecord, adSet: AdSetRecord, amountMilliMinor: number, now: Date): SpendReservation[] {
  const day = describeDayPeriod(now);
  const campaignDaily = campaign.budgetLevel === "campaign" && campaign.budgetType === "daily" ? campaign.budgetMinor : null;
  const lifetimeLimits = [campaign.budgetLevel === "campaign" && campaign.budgetType === "lifetime" ? campaign.budgetMinor : null, campaign.spendCapMinor].filter((value): value is number => value !== null);
  const reservations: SpendReservation[] = [
    { scopeId: `campaign:${campaign.id}`, period: day, amountMilliMinor, limitMilliMinor: campaignDaily === null ? null : toMilliMinor(campaignDaily) },
    { scopeId: `campaign:${campaign.id}`, period: TOTAL_PERIOD, amountMilliMinor, limitMilliMinor: lifetimeLimits.length === 0 ? null : toMilliMinor(Math.min(...lifetimeLimits)) },
  ];
  if (campaign.budgetLevel === "ad_set" && adSet.budgetMinor !== null) {
    const period = adSet.budgetType === "daily" ? day : TOTAL_PERIOD;
    reservations.push({ scopeId: `adset:${adSet.id}`, period, amountMilliMinor, limitMilliMinor: toMilliMinor(adSet.budgetMinor) });
  }
  if (account.monthlySpendLimitMinor !== null) {
    reservations.push({ scopeId: `account:${account.id}`, period: describeMonthPeriod(now), amountMilliMinor, limitMilliMinor: toMilliMinor(account.monthlySpendLimitMinor) });
  }
  return reservations;
}

export class AdBudgetService {
  public constructor(private readonly dependencies: AdsDependencies) {}

  public async chargeServedAd(serving: AdServingRecord, eventId: string, amountMilliMinor: number): Promise<ChargeOutcome> {
    const { campaigns, accounts, spend, clock } = this.dependencies;
    const [campaign, adSet, account] = await Promise.all([campaigns.findCampaign(serving.campaignId), campaigns.findAdSet(serving.adSetId), accounts.findAccountById(serving.accountId)]);
    if (campaign === undefined || adSet === undefined || account === undefined) return { billed: false, reason: "budget_exhausted" };
    const now = clock.now();
    const reservations = buildSpendReservations(account, campaign, adSet, amountMilliMinor, now);
    if (!(await spend.reserveAll(reservations))) return { billed: false, reason: "budget_exhausted" };
    if (!campaign.prepaid) {
      const settled = await this.settleWithAdvertiser(account, campaign, eventId, amountMilliMinor);
      if (!settled) {
        await spend.release(reservations);
        return { billed: false, reason: "insufficient_funds" };
      }
    }
    await this.shareRevenueWithHostCreator(serving, account, eventId, amountMilliMinor);
    return { billed: true, chargeMilliMinor: amountMilliMinor };
  }

  private async settleWithAdvertiser(account: AdAccountRecord, campaign: AdCampaignRecord, eventId: string, amountMilliMinor: number): Promise<boolean> {
    const { spend } = this.dependencies;
    const unbilledKey = { scopeId: `campaign:${campaign.id}`, period: UNBILLED_PERIOD };
    const settleMinor = countWholeUnitsCrossed(await spend.addToCounter(unbilledKey, amountMilliMinor), amountMilliMinor);
    if (settleMinor === 0) return true;
    try {
      await this.chargeCreditsOrWallet(account, campaign, eventId, Money.of(settleMinor, campaign.currency));
      return true;
    } catch (error) {
      this.dependencies.logger.warn("Advertiser charge was refused", { accountId: account.id, error: String(error) });
      await spend.addToCounter(unbilledKey, -amountMilliMinor);
      return false;
    }
  }

  private async chargeCreditsOrWallet(account: AdAccountRecord, campaign: AdCampaignRecord, eventId: string, amount: Money): Promise<void> {
    const { delivery, advertiserBilling, clock } = this.dependencies;
    const now = clock.now();
    const availableCredit = await this.readAvailableMonthlyCredit(account, now);
    if (availableCredit >= amount.amountMinor) {
      await delivery.recordBillingTransaction({ accountId: account.id, type: "credit_spend", amountMinor: -amount.amountMinor, currency: amount.currency, description: `Ad credits: ${campaign.name}`, reference: `ad-credit:${eventId}`, createdAt: now });
      return;
    }
    const reference = `ad-spend:${eventId}`;
    await advertiserBilling.chargeAdvertiserWallet({ reference, advertiser: describeAdvertiser(account), amount, description: `Ad delivery: ${campaign.name}` });
    await delivery.recordBillingTransaction({ accountId: account.id, type: "ad_spend", amountMinor: -amount.amountMinor, currency: amount.currency, description: `Ad delivery: ${campaign.name}`, reference, createdAt: now });
  }

  public async readAvailableMonthlyCredit(account: AdAccountRecord, now: Date): Promise<number> {
    const { entitlements, delivery } = this.dependencies;
    const profile = await (account.storeId === null ? entitlements.findEntitlementsForUser(account.ownerId) : entitlements.findEntitlementsForStore(account.storeId)).catch(() => undefined);
    const grant = profile?.entitlements["ads.monthly_credit_minor"];
    if (typeof grant !== "number" || grant <= 0) return 0;
    const month = now.toISOString().slice(0, 7);
    const used = (await delivery.listBillingTransactions(account.id))
      .filter((transaction) => transaction.type === "credit_spend" && transaction.createdAt.toISOString().slice(0, 7) === month)
      .reduce((total, transaction) => total + Math.abs(transaction.amountMinor), 0);
    return Math.max(0, grant - used);
  }

  private async shareRevenueWithHostCreator(serving: AdServingRecord, account: AdAccountRecord, eventId: string, amountMilliMinor: number): Promise<void> {
    const { settings, spend, advertiserBilling, logger } = this.dependencies;
    if (serving.hostCreatorId === null || serving.hostCreatorId === account.ownerId || settings.creatorRevenueShareBps === 0) return;
    const shareMilliMinor = Math.floor((amountMilliMinor * settings.creatorRevenueShareBps) / 10_000);
    const key = { scopeId: `creator-share:${serving.hostCreatorId}:${serving.currency}`, period: UNBILLED_PERIOD };
    const creditMinor = countWholeUnitsCrossed(await spend.addToCounter(key, shareMilliMinor), shareMilliMinor);
    if (creditMinor === 0) return;
    try {
      await advertiserBilling.creditCreatorAdRevenueShare({ reference: `ad-share:${eventId}`, creatorUserId: serving.hostCreatorId, amount: Money.of(creditMinor, serving.currency as CurrencyCode) });
    } catch (error) {
      await spend.addToCounter(key, -shareMilliMinor);
      logger.warn("Creator ad revenue share could not be credited yet", { error: String(error) });
    }
  }
}
