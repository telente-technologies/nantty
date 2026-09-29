import type { CurrencyCode } from "../../../enums/currency.enum.js";
import type { IntelligenceAdCandidate } from "../../intelligence/models/intelligenceAds.model.js";
import type { ExchangeRateToUsd } from "../../intelligence/models/intelligenceRanking.model.js";
import type { AdAccountRecord } from "../models/adAccounts.model.js";
import type { AdPlacement, DeliverableAd } from "../models/adCampaigns.model.js";
import type { AdsDependencies } from "../models/adsDependencies.model.js";
import { describeAdvertiser } from "./adAccounts.service.js";
import { describeDayPeriod, TOTAL_PERIOD } from "./adBudget.service.js";
import { convertMilliMinorToMinor } from "./adPresenter.service.js";
import { convertPlacementForIntelligence, describeCreativeForIntelligence } from "./adPlacementRules.service.js";
import { describeCounterKey } from "../repositories/adSpend.repository.js";

const AGE_BRACKETS: readonly [string, number, number][] = [["13-17", 13, 17], ["18-24", 18, 24], ["25-34", 25, 34], ["35-44", 35, 44], ["45-54", 45, 54], ["55-64", 55, 64], ["65+", 65, 200]];
const DEFAULT_FREQUENCY_CAP_PER_DAY = 3;
const AUTO_BID_DAILY_BUDGET_DIVISOR = 50;

export interface PreparedCandidate {
  readonly entry: DeliverableAd;
  readonly account: AdAccountRecord;
  readonly candidate: IntelligenceAdCandidate;
}

export function describeAgeBrackets(ageMin: number, ageMax: number): string[] {
  return AGE_BRACKETS.filter(([, low, high]) => high >= ageMin && low <= (ageMax >= 65 ? 200 : ageMax)).map(([bracket]) => bracket);
}

export function describeEffectiveDailyBudgetMinor(entry: DeliverableAd): number {
  const { campaign, adSet } = entry;
  const budgetMinor = campaign.budgetLevel === "campaign" ? campaign.budgetMinor : adSet.budgetMinor;
  const budgetType = campaign.budgetLevel === "campaign" ? campaign.budgetType : adSet.budgetType;
  return budgetType === null ? 1 : Math.max(1, budgetMinor ?? 1);
}

export function describeBid(entry: DeliverableAd): { readonly bidType: "cpc" | "cpm"; readonly bidMinor: number } {
  const { adSet } = entry;
  if (adSet.bidType === "max_cpm" && adSet.bidMinor !== null) return { bidType: "cpm", bidMinor: adSet.bidMinor };
  if ((adSet.bidType === "max_cpc" || adSet.bidType === "target_cost") && adSet.bidMinor !== null) return { bidType: "cpc", bidMinor: adSet.bidMinor };
  return { bidType: "cpc", bidMinor: Math.max(1, Math.floor(describeEffectiveDailyBudgetMinor(entry) / AUTO_BID_DAILY_BUDGET_DIVISOR)) };
}

export function describeMaximumSingleChargeMinor(bidType: "cpc" | "cpm", bidMinor: number): number {
  return bidType === "cpc" ? bidMinor : Math.ceil(bidMinor / 1000);
}

export class AdAuctionCandidates {
  private readonly topicSlugCache = new Map<string, string | undefined>();

  public constructor(private readonly dependencies: AdsDependencies) {}

  public async prepareCandidates(entries: readonly DeliverableAd[], placement: AdPlacement, now: Date): Promise<PreparedCandidate[]> {
    const { accounts, spend } = this.dependencies;
    const accountsById = new Map((await accounts.findAccountsByIds([...new Set(entries.map((entry) => entry.campaign.accountId))])).map((account) => [account.id, account]));
    const day = describeDayPeriod(now);
    const spentMilliMinor = await spend.readSpentMilliMinor(entries.flatMap((entry) => [{ scopeId: `campaign:${entry.campaign.id}`, period: day }, { scopeId: `campaign:${entry.campaign.id}`, period: TOTAL_PERIOD }]));
    const balances = new Map<string, number>();
    const prepared: PreparedCandidate[] = [];
    for (const entry of entries) {
      const account = accountsById.get(entry.campaign.accountId);
      if (account === undefined || account.status !== "active") continue;
      const bid = describeBid(entry);
      if (!entry.campaign.prepaid && !(await this.hasFundsFor(account, describeMaximumSingleChargeMinor(bid.bidType, bid.bidMinor), balances))) continue;
      prepared.push({ entry, account, candidate: await this.describeCandidate(entry, placement, bid, spentMilliMinor, day) });
    }
    return prepared;
  }

  public async quoteExchangeRates(currencies: readonly CurrencyCode[]): Promise<ExchangeRateToUsd[]> {
    const rates: ExchangeRateToUsd[] = [];
    for (const currency of new Set(currencies)) {
      if (currency === "USD") {
        rates.push({ currency, usdPerMajorUnit: "1" });
        continue;
      }
      const quote = await this.dependencies.currencyConverter.quoteExchangeRate(currency, "USD").catch(() => undefined);
      const rate = quote === undefined ? Number.NaN : Number(quote.rateText);
      if (Number.isFinite(rate) && rate > 0) rates.push({ currency, usdPerMajorUnit: rate.toFixed(12).replace(/0+$/, "").replace(/\.$/, "") });
    }
    return rates;
  }

  private async hasFundsFor(account: AdAccountRecord, requiredMinor: number, balances: Map<string, number>): Promise<boolean> {
    if (!balances.has(account.id)) {
      const balance = await this.dependencies.advertiserBilling.findAdvertiserWalletBalance(describeAdvertiser(account), account.currency).catch(() => undefined);
      balances.set(account.id, balance?.amountMinor ?? 0);
    }
    return (balances.get(account.id) ?? 0) >= requiredMinor;
  }

  private async describeCandidate(
    entry: DeliverableAd,
    placement: AdPlacement,
    bid: { readonly bidType: "cpc" | "cpm"; readonly bidMinor: number },
    spentMilliMinor: ReadonlyMap<string, number>,
    day: string,
  ): Promise<IntelligenceAdCandidate> {
    const { campaign, adSet, ad } = entry;
    const money = (amountMinor: number) => ({ amountMinor, currency: campaign.currency });
    const lifetimeMinor = campaign.budgetLevel === "campaign" && campaign.budgetType === "lifetime" ? campaign.budgetMinor : campaign.budgetLevel === "ad_set" && adSet.budgetType === "lifetime" ? adSet.budgetMinor : null;
    const frequencyPerDay = adSet.frequencyImpressions === null || adSet.frequencyDays === null ? DEFAULT_FREQUENCY_CAP_PER_DAY : Math.min(50, Math.max(1, Math.ceil(adSet.frequencyImpressions / adSet.frequencyDays)));
    const audience = adSet.audience;
    return {
      adId: ad.id,
      campaignId: campaign.id,
      advertiserId: campaign.accountId,
      status: "active",
      startsAt: (adSet.startAt > campaign.startAt ? adSet.startAt : campaign.startAt).toISOString(),
      endsAt: [campaign.endAt, adSet.endAt].filter((value): value is Date => value !== null).sort((left, right) => left.getTime() - right.getTime())[0]?.toISOString() ?? null,
      bidType: bid.bidType,
      bid: money(bid.bidMinor),
      dailyBudget: money(describeEffectiveDailyBudgetMinor(entry)),
      totalBudget: lifetimeMinor === null ? null : money(lifetimeMinor),
      spentToday: money(convertMilliMinorToMinor(spentMilliMinor.get(describeCounterKey({ scopeId: `campaign:${campaign.id}`, period: day })) ?? 0)),
      spentTotal: money(convertMilliMinorToMinor(spentMilliMinor.get(describeCounterKey({ scopeId: `campaign:${campaign.id}`, period: TOTAL_PERIOD })) ?? 0)),
      frequencyCapPerDay: frequencyPerDay,
      placements: ad.deliverablePlacements.map(convertPlacementForIntelligence),
      targeting: {
        countries: [...new Set(audience.locations.map((location) => location.countryCode.toUpperCase()))].filter((code) => /^[A-Z]{2}$/.test(code)),
        regions: audience.locations.filter((location) => location.type === "state" && /^[A-Z0-9-]{1,12}$/.test(location.code)).map((location) => location.code),
        topics: await this.resolveTopicSlugs(audience.topicIds),
        ageBrackets: describeAgeBrackets(audience.ageMin, audience.ageMax),
      },
      creative: describeCreativeForIntelligence(ad.creative, placement),
      creativeTopics: ad.creative.topics.filter((topic) => /^[a-z0-9_-]{1,64}$/.test(topic)).slice(0, 20),
      lifetimeImpressions: 0,
      lifetimeClicks: 0,
    };
  }

  private async resolveTopicSlugs(topicIds: readonly string[]): Promise<string[]> {
    const slugs: string[] = [];
    for (const topicId of topicIds) {
      if (!this.topicSlugCache.has(topicId)) this.topicSlugCache.set(topicId, await this.dependencies.userDirectory.findTopicSlugById(topicId).catch(() => undefined));
      const slug = this.topicSlugCache.get(topicId);
      if (slug !== undefined && /^[a-z0-9_-]{1,64}$/.test(slug)) slugs.push(slug);
    }
    return slugs;
  }
}
