import type { AdCampaignObjective, AdCampaignStatus } from "@/types/ads.type";
import { createSeededRandomNumberGenerator } from "@/mocks/seed/seededRandom.mock";

export interface DemoAdCampaignDay {
  readonly dateKey: string;
  readonly spendMinor: number;
  readonly impressions: number;
  readonly clicks: number;
  readonly attributedOrders: number;
  readonly attributedRevenueMinor: number;
}

export interface DemoAdCampaign {
  readonly id: string;
  readonly name: string;
  readonly objective: AdCampaignObjective;
  readonly placement: string;
  readonly status: AdCampaignStatus;
  readonly dailyBudgetMinor: number;
  readonly startsDaysAgo: number;
  readonly endsDaysAgo: number | null;
  readonly days: DemoAdCampaignDay[];
}

const campaignPlans: readonly Omit<DemoAdCampaign, "days" | "id">[] = [
  { name: "Detty December teaser — reels", objective: "sales", placement: "Reels", status: "active", dailyBudgetMinor: 1_500_000, startsDaysAgo: 21, endsDaysAgo: null },
  { name: "Mart tiles — bestsellers", objective: "sales", placement: "Mart tiles", status: "active", dailyBudgetMinor: 800_000, startsDaysAgo: 64, endsDaysAgo: null },
  { name: "Follow us in Lagos", objective: "followers", placement: "Feed posts", status: "paused", dailyBudgetMinor: 500_000, startsDaysAgo: 40, endsDaysAgo: null },
  { name: "Owambe weekend live promo", objective: "traffic", placement: "Promoted lives", status: "ended", dailyBudgetMinor: 2_000_000, startsDaysAgo: 34, endsDaysAgo: 30 },
  { name: "Back to school bags", objective: "sales", placement: "Feed posts", status: "ended", dailyBudgetMinor: 1_000_000, startsDaysAgo: 120, endsDaysAgo: 90 },
  { name: "Independence Day flash", objective: "awareness", placement: "Reels", status: "scheduled", dailyBudgetMinor: 1_200_000, startsDaysAgo: -2, endsDaysAgo: -5 },
];

function convertDaysAgoToDateKey(daysAgo: number): string {
  return new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);
}

export function buildDemoAdCampaigns(seed: number): DemoAdCampaign[] {
  return campaignPlans.map((plan, campaignIndex) => {
    const random = createSeededRandomNumberGenerator(seed + campaignIndex * 7_919);
    const days: DemoAdCampaignDay[] = [];
    const lastDaysAgo = Math.max(0, plan.endsDaysAgo ?? 0);
    if (plan.status !== "scheduled") {
      for (let daysAgo = plan.startsDaysAgo; daysAgo >= lastDaysAgo; daysAgo -= 1) {
        const isPausedDay = plan.status === "paused" && daysAgo < 9;
        if (isPausedDay) continue;
        const spendMinor = Math.round(plan.dailyBudgetMinor * (0.7 + random() * 0.3));
        const impressions = Math.round((spendMinor / 100) * (2.6 + random() * 1.4));
        const clicks = Math.round(impressions * (0.011 + random() * 0.019));
        const conversionRate = plan.objective === "sales" ? 0.03 + random() * 0.03 : 0.006 + random() * 0.01;
        const attributedOrders = Math.round(clicks * conversionRate);
        days.push({ dateKey: convertDaysAgoToDateKey(daysAgo), spendMinor, impressions, clicks, attributedOrders, attributedRevenueMinor: attributedOrders * Math.round(2_400_000 + random() * 3_600_000) });
      }
    }
    return { ...plan, id: `adc_${seed}_${campaignIndex + 1}`, days };
  });
}
