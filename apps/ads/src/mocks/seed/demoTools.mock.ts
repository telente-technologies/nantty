import type { MockAdSetRecord, MockCampaignRecord } from "@/mocks/mockDatabase.mock";
import { shiftTimestampByDays } from "@/mocks/seed/seededRandom.mock";
import type { ScheduledReport } from "@/types/report.type";
import type { ActivityEntry, AutomatedRule, ConversionEvent, Experiment } from "@/types/tools.type";

const storeByAccount: Record<string, { storeId: string; storeName: string }> = {
  act_ifelifestyle: { storeId: "st_ifelifestyle", storeName: "Ife Lifestyle" },
  act_kelechikicks: { storeId: "st_kelechikicks", storeName: "Kelechi Kicks" },
  act_kenteheritage: { storeId: "st_kenteheritage", storeName: "Kente Heritage" },
};

function buildBuiltInConversionEvents(): (ConversionEvent & { accountId: string })[] {
  const events: (ConversionEvent & { accountId: string })[] = [];
  for (const [accountId, store] of Object.entries(storeByAccount)) {
    const builtIns: [ConversionEvent["eventType"], string, number][] = [
      ["purchase", "Purchase", accountId === "act_ifelifestyle" ? 412 : 96],
      ["add_to_cart", "Add to cart", accountId === "act_ifelifestyle" ? 2310 : 540],
      ["checkout_started", "Checkout started", accountId === "act_ifelifestyle" ? 880 : 190],
      ["store_visit", "Store visit", accountId === "act_ifelifestyle" ? 15_400 : 3_900],
    ];
    for (const [eventType, name, count] of builtIns) {
      events.push({ id: `cev_${accountId}_${eventType}`, accountId, name, eventType, storeId: store.storeId, storeName: store.storeName, isBuiltIn: true, status: "active", lastReceivedAt: shiftTimestampByDays(0, 7), countLast7Days: count, tracksValue: eventType === "purchase" || eventType === "add_to_cart" });
    }
  }
  events.push({ id: "cev_ife_tailoring_dm", accountId: "act_ifelifestyle", name: "Tailoring enquiry (message)", eventType: "message_started", storeId: "st_ifelifestyle", storeName: "Ife Lifestyle", isBuiltIn: false, status: "no_recent_activity", lastReceivedAt: shiftTimestampByDays(-5, 18), countLast7Days: 0, tracksValue: false });
  return events;
}

export function buildDemoToolRecords(campaigns: readonly MockCampaignRecord[], adSets: readonly MockAdSetRecord[]) {
  const harmattan = campaigns.find((campaign) => campaign.id === "cmp_ife_harmattan");
  const lagosWomen = adSets.find((adSet) => adSet.id === "ads_ife_lagos_women");
  const lookalike = adSets.find((adSet) => adSet.id === "ads_ife_lookalike");
  const experiments: (Experiment & { accountId: string })[] =
    harmattan && lagosWomen && lookalike
      ? [
          {
            id: "exp_ife_audience",
            accountId: "act_ifelifestyle",
            name: "Interests vs lookalike — Harmattan drop",
            campaignId: harmattan.id,
            campaignName: harmattan.name,
            variable: "audience",
            metric: "cost_per_result",
            status: "running",
            arms: [
              { adSetId: lagosWomen.id, adSetName: lagosWomen.name, trafficPercent: 50, note: "Interest targeting" },
              { adSetId: lookalike.id, adSetName: lookalike.name, trafficPercent: 50, note: "Lookalike of buyers" },
            ],
            startAt: shiftTimestampByDays(-12, 6),
            endAt: shiftTimestampByDays(9, 22),
            result: { winnerAdSetId: lookalike.id, confidencePercent: 81, summary: "The lookalike ad set is getting purchases 18% cheaper so far. Keep the test running to reach 90% confidence." },
            createdAt: shiftTimestampByDays(-13, 10),
          },
        ]
      : [];

  const rules: (AutomatedRule & { accountId: string })[] = [
    { id: "rul_ife_cpc", accountId: "act_ifelifestyle", name: "Pause ads when CPC is too high", status: "active", level: "ad", targetIds: [], conditions: [{ metric: "cpc", operator: "greater_than", value: 180, window: "last_3_days" }, { metric: "impressions", operator: "greater_than", value: 2000, window: "last_3_days" }], action: { type: "pause", percent: null }, checkEveryMinutes: 60, lastRunAt: shiftTimestampByDays(0, 7), lastTriggeredAt: shiftTimestampByDays(-6, 14), triggerCount: 2, createdAt: shiftTimestampByDays(-40) },
    { id: "rul_ife_roas", accountId: "act_ifelifestyle", name: "Scale winners: raise budget 15% when ROAS > 4", status: "active", level: "campaign", targetIds: ["cmp_ife_harmattan"], conditions: [{ metric: "roas", operator: "greater_than", value: 4, window: "last_7_days" }], action: { type: "increase_budget", percent: 15 }, checkEveryMinutes: 1440, lastRunAt: shiftTimestampByDays(0, 1), lastTriggeredAt: null, triggerCount: 0, createdAt: shiftTimestampByDays(-20) },
    { id: "rul_ife_freq", accountId: "act_ifelifestyle", name: "Tell me when frequency passes 3", status: "paused", level: "ad_set", targetIds: [], conditions: [{ metric: "frequency", operator: "greater_than", value: 3, window: "last_7_days" }], action: { type: "notify", percent: null }, checkEveryMinutes: 1440, lastRunAt: shiftTimestampByDays(-8, 1), lastTriggeredAt: shiftTimestampByDays(-9, 1), triggerCount: 1, createdAt: shiftTimestampByDays(-50) },
  ];

  const scheduledReports: (ScheduledReport & { accountId: string })[] = [
    { id: "srp_ife_weekly", accountId: "act_ifelifestyle", name: "Weekly performance by campaign", recipients: ["adaeze@ifelifestyle.ng", "tunde@ifelifestyle.ng"], frequency: "weekly", breakdown: "campaign", metrics: ["spend", "impressions", "clicks", "conversions", "roas"], nextSendAt: shiftTimestampByDays(6, 7), createdAt: shiftTimestampByDays(-35) },
  ];

  const activity: (ActivityEntry & { accountId: string })[] = [
    { id: "act_seed_1", accountId: "act_ifelifestyle", actor: { id: "system", name: "Nantty review", isSystem: true }, action: "ad_rejected", objectType: "ad", objectId: "ad_ife_payday_bags", objectName: "Payday — first copy bags", summary: "Ad rejected: counterfeit goods policy", changes: [{ field: "Review", from: "Pending", to: "Rejected" }], createdAt: shiftTimestampByDays(-1, 15) },
    { id: "act_seed_2", accountId: "act_ifelifestyle", actor: { id: "usr_tunde", name: "Tunde Bakare", isSystem: false }, action: "campaign_created", objectType: "campaign", objectId: "cmp_ife_payday", objectName: "Payday flash sale — bags", summary: "Created campaign and sent 1 ad for review", changes: [], createdAt: shiftTimestampByDays(-1, 12) },
    { id: "act_seed_3", accountId: "act_ifelifestyle", actor: { id: "system", name: "Automated rule", isSystem: true }, action: "ad_paused_by_rule", objectType: "ad", objectId: "ad_ife_tailoring", objectName: "Custom tailoring — DM", summary: "Paused by rule \"Pause ads when CPC is too high\"", changes: [{ field: "Status", from: "Active", to: "Paused" }], createdAt: shiftTimestampByDays(-6, 14) },
    { id: "act_seed_4", accountId: "act_ifelifestyle", actor: { id: "usr_ibrahim", name: "Ibrahim Musa", isSystem: false }, action: "balance_topped_up", objectType: "billing", objectId: "tup_act_ifelifestyle_0", objectName: "Top-up ZDA-IFEL-1000", summary: "Added ₦500,000 to the balance", changes: [], createdAt: shiftTimestampByDays(-3, 11) },
    { id: "act_seed_5", accountId: "act_ifelifestyle", actor: { id: "usr_adaeze", name: "Adaeze Okafor", isSystem: false }, action: "budget_changed", objectType: "campaign", objectId: "cmp_ife_harmattan", objectName: "Harmattan Drop — Adire collection", summary: "Raised the daily budget", changes: [{ field: "Daily budget", from: "₦20,000", to: "₦25,000" }], createdAt: shiftTimestampByDays(-8, 9) },
    { id: "act_seed_6", accountId: "act_ifelifestyle", actor: { id: "usr_adaeze", name: "Adaeze Okafor", isSystem: false }, action: "member_invited", objectType: "member", objectId: "inv_chioma", objectName: "chioma@ifelifestyle.ng", summary: "Invited as Advertiser", changes: [], createdAt: shiftTimestampByDays(-2, 10) },
  ];

  return { conversionEvents: buildBuiltInConversionEvents(), experiments, rules, scheduledReports, activity };
}
