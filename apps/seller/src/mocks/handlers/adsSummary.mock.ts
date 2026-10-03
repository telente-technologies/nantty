import { readMockStorePlanFeatureDenial } from "@/mocks/handlers/growthPlanGate.mock";
import { readMockDatabase, readStoreScopedMockSlice } from "@/mocks/mockDatabase.mock";
import { MockHttpError, readDateRangeFromQuery, requireMockStorePrincipal, respondWithJson } from "@/mocks/mockResponses.mock";
import { registerMockRoute } from "@/mocks/mockRouter.mock";
import { buildDemoAdCampaigns, type DemoAdCampaignDay } from "@/mocks/seed/demoAds.mock";
import { readAdsManagerUrl } from "@/config/siteMetadata.config";
import type { AdDailyPoint, AdPerformanceTotals, AdsSummary } from "@/types/ads.type";
import type { CurrencyCode } from "@/types/money.type";

function summariseAdDays(days: readonly DemoAdCampaignDay[], currency: CurrencyCode): AdPerformanceTotals {
  const spendMinor = days.reduce((sum, day) => sum + day.spendMinor, 0);
  const impressions = days.reduce((sum, day) => sum + day.impressions, 0);
  const clicks = days.reduce((sum, day) => sum + day.clicks, 0);
  const revenueMinor = days.reduce((sum, day) => sum + day.attributedRevenueMinor, 0);
  return {
    spend: { amountMinor: spendMinor, currency },
    impressions,
    clicks,
    clickThroughRateBasisPoints: impressions > 0 ? Math.round((clicks * 10_000) / impressions) : 0,
    attributedOrders: days.reduce((sum, day) => sum + day.attributedOrders, 0),
    attributedRevenue: { amountMinor: revenueMinor, currency },
    returnOnAdSpendHundredths: spendMinor > 0 ? Math.round((revenueMinor * 100) / spendMinor) : 0,
  };
}

function convertTextToSeedNumber(text: string): number {
  return [...text].reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) >>> 0, 7);
}

export function registerAdsSummaryMockRoutes(): void {
  registerMockRoute("GET", "/seller/ads/summary", (request) => {
    const principal = requireMockStorePrincipal(request);
    const denial = readMockStorePlanFeatureDenial(principal.storeId, "ads_tools");
    if (denial) throw new MockHttpError(402, "PLAN_FEATURE_REQUIRED", "Ad results in the dashboard are part of Pro. You can still create ads in Ads Manager.");
    const { from, to } = readDateRangeFromQuery(request.query, 30);
    const fromKey = from.toISOString().slice(0, 10);
    const toKey = to.toISOString().slice(0, 10);
    const currency = readMockDatabase().settings.currency;
    const campaigns = readStoreScopedMockSlice("adCampaigns", (storeId) => buildDemoAdCampaigns(convertTextToSeedNumber(storeId)));
    const adsManagerUrl = readAdsManagerUrl();
    const inRange = (day: DemoAdCampaignDay) => day.dateKey >= fromKey && day.dateKey <= toKey;
    const everyDayInRange = campaigns.flatMap((campaign) => campaign.days.filter(inRange));
    const daily: AdDailyPoint[] = [];
    for (let cursor = new Date(`${fromKey}T12:00:00.000Z`); cursor.toISOString().slice(0, 10) <= toKey && daily.length < 400; cursor.setUTCDate(cursor.getUTCDate() + 1)) {
      const dateKey = cursor.toISOString().slice(0, 10);
      const sameDay = everyDayInRange.filter((day) => day.dateKey === dateKey);
      daily.push({ date: dateKey, spend: { amountMinor: sameDay.reduce((sum, day) => sum + day.spendMinor, 0), currency }, attributedRevenue: { amountMinor: sameDay.reduce((sum, day) => sum + day.attributedRevenueMinor, 0), currency }, clicks: sameDay.reduce((sum, day) => sum + day.clicks, 0), impressions: sameDay.reduce((sum, day) => sum + day.impressions, 0) });
    }
    const summary: AdsSummary = {
      from: fromKey,
      to: toKey,
      hasAdsAccount: true,
      adCreditBalance: { amountMinor: 1_250_000, currency },
      totals: summariseAdDays(everyDayInRange, currency),
      daily,
      campaigns: campaigns.map((campaign) => ({
        ...summariseAdDays(campaign.days.filter(inRange), currency),
        id: campaign.id,
        name: campaign.name,
        objective: campaign.objective,
        placement: campaign.placement,
        status: campaign.status,
        dailyBudget: { amountMinor: campaign.dailyBudgetMinor, currency },
        startsAt: new Date(Date.now() - campaign.startsDaysAgo * 86_400_000).toISOString(),
        endsAt: campaign.endsDaysAgo === null ? null : new Date(Date.now() - campaign.endsDaysAgo * 86_400_000).toISOString(),
        manageUrl: `${adsManagerUrl}/campaigns/${campaign.id}`,
      })),
    };
    return respondWithJson(200, summary);
  });
}
