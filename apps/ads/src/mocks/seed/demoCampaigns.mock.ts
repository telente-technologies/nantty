import type { MockAdRecord, MockAdSetRecord, MockCampaignRecord } from "@/mocks/mockDatabase.mock";
import { buildDemoAd, buildDemoAdSet, buildDemoAudience, buildDemoCampaign, buildMinorMoney } from "@/mocks/seed/demoCampaignBuilders.mock";
import { buildDemoContentSources } from "@/mocks/seed/demoContent.mock";
import { buildDemoCustomAudiences } from "@/mocks/seed/demoAudiences.mock";
import { shiftTimestampByDays } from "@/mocks/seed/seededRandom.mock";
import type { CustomAudience } from "@/types/audience.type";
import type { ContentSource } from "@/types/creative.type";

function findSource(sources: readonly ContentSource[], id: string): ContentSource {
  const source = sources.find((candidate) => candidate.id === id);
  if (!source) throw new Error(`Unknown demo source ${id}`);
  return source;
}

export function buildDemoCampaignRecords(): { campaigns: MockCampaignRecord[]; adSets: MockAdSetRecord[]; ads: MockAdRecord[]; audiences: CustomAudience[] } {
  const sources = buildDemoContentSources();
  const source = (id: string) => findSource(sources, id);

  const harmattan = buildDemoCampaign({ id: "cmp_ife_harmattan", accountId: "act_ifelifestyle", name: "Harmattan Drop — Adire collection", objective: "sales", status: "active", currency: "NGN", dailyBudgetMajor: 25_000, startDaysAgo: 34, endDaysFromNow: null });
  const serum = buildDemoCampaign({ id: "cmp_ife_serum", accountId: "act_ifelifestyle", name: "Glow Serum clips", objective: "engagement", status: "active", currency: "NGN", dailyBudgetMajor: null, startDaysAgo: 21, endDaysFromNow: 9 });
  const detty = buildDemoCampaign({ id: "cmp_ife_awareness", accountId: "act_ifelifestyle", name: "Ife Lifestyle — brand reach (August)", objective: "awareness", status: "completed", currency: "NGN", dailyBudgetMajor: null, lifetimeBudgetMajor: 450_000, startDaysAgo: 58, endDaysFromNow: -29 });
  const tailoring = buildDemoCampaign({ id: "cmp_ife_messages", accountId: "act_ifelifestyle", name: "DM to order — custom tailoring", objective: "messages", status: "paused", currency: "NGN", dailyBudgetMajor: 8_000, startDaysAgo: 26, endDaysFromNow: null });
  const followers = buildDemoCampaign({ id: "cmp_ife_followers", accountId: "act_ifelifestyle", name: "Grow followers — style tips", objective: "followers", status: "in_review", currency: "NGN", dailyBudgetMajor: 6_000, startDaysAgo: 0, endDaysFromNow: 30 });
  const payday = buildDemoCampaign({ id: "cmp_ife_payday", accountId: "act_ifelifestyle", name: "Payday flash sale — bags", objective: "sales", status: "rejected", currency: "NGN", dailyBudgetMajor: 15_000, startDaysAgo: 1, endDaysFromNow: 4 });
  const storeWeek = buildDemoCampaign({ id: "cmp_ife_store", accountId: "act_ifelifestyle", name: "Store week — visit Ife Lifestyle", objective: "store_promotion", status: "draft", currency: "NGN", dailyBudgetMajor: 10_000, startDaysAgo: -3, endDaysFromNow: 10 });
  const adaezeBoost = buildDemoCampaign({ id: "cmp_adaeze_lekki", accountId: "act_adaeze", name: "Boost: Saturday at Lekki market", objective: "engagement", status: "active", currency: "NGN", dailyBudgetMajor: 2_500, startDaysAgo: 4, endDaysFromNow: 3 });
  const kkSales = buildDemoCampaign({ id: "cmp_kk_sales", accountId: "act_kelechikicks", name: "New drop — sneakers sales", objective: "sales", status: "active", currency: "NGN", dailyBudgetMajor: 12_000, startDaysAgo: 18, endDaysFromNow: null });
  const kkTraffic = buildDemoCampaign({ id: "cmp_kk_traffic", accountId: "act_kelechikicks", name: "Unboxing clip — store visits", objective: "store_promotion", status: "active", currency: "NGN", dailyBudgetMajor: 5_000, startDaysAgo: 5, endDaysFromNow: 20 });
  const kenteSales = buildDemoCampaign({ id: "cmp_kente_sales", accountId: "act_kenteheritage", name: "Jewellery — Accra & Kumasi buyers", objective: "sales", status: "active", currency: "GHS", dailyBudgetMajor: 180, startDaysAgo: 16, endDaysFromNow: null });

  const campaigns = [harmattan, serum, detty, tailoring, followers, payday, storeWeek, adaezeBoost, kkSales, kkTraffic, kenteSales];

  const lagosWomen = buildDemoAdSet({ id: "ads_ife_lagos_women", campaign: harmattan, name: "Lagos women 22–40 · fashion", audience: buildDemoAudience({ locationCodes: ["NG-LA"], ageMin: 22, ageMax: 40, gender: "female", topicIds: ["top_fashion", "top_owambe"], behaviourIds: ["beh_recent_buyers"] }), placements: ["feed", "clips", "mart"], frequencyCap: { impressions: 3, perDays: 7 } });
  const lookalike = buildDemoAdSet({ id: "ads_ife_lookalike", campaign: harmattan, name: "Abuja + PH · 3% lookalike of buyers", audience: buildDemoAudience({ locationCodes: ["NG-FC", "NG-RI"], ageMin: 20, ageMax: 45, customAudienceIds: ["aud_ife_lookalike"], excludedCustomAudienceIds: ["aud_ife_customers"] }), placements: "automatic", bidStrategy: { type: "target_cost", amount: buildMinorMoney(1_800, "NGN") } });
  const serumSet = buildDemoAdSet({ id: "ads_ife_serum", campaign: serum, name: "Nigeria 18–34 · beauty", audience: buildDemoAudience({ locationCodes: ["NG"], ageMin: 18, ageMax: 34, topicIds: ["top_beauty"], behaviourIds: ["beh_clip_watchers"] }), placements: ["clips", "stories"], dailyBudgetMajor: 9_000, bidStrategy: { type: "max_cpm", amount: buildMinorMoney(950, "NGN") } });
  const awarenessSet = buildDemoAdSet({ id: "ads_ife_awareness", campaign: detty, name: "Nigeria 18+ · broad", audience: buildDemoAudience({ locationCodes: ["NG"] }), placements: "automatic", frequencyCap: { impressions: 2, perDays: 7 } });
  const tailoringSet = buildDemoAdSet({ id: "ads_ife_tailoring", campaign: tailoring, name: "Lagos + Abuja · owambe", audience: buildDemoAudience({ locationCodes: ["NG-LA", "NG-FC"], ageMin: 25, ageMax: 50, topicIds: ["top_owambe", "top_fashion"] }), placements: ["feed", "stories"] });
  const followersSet = buildDemoAdSet({ id: "ads_ife_followers", campaign: followers, name: "Nigeria 18–30 · style", audience: buildDemoAudience({ locationCodes: ["NG"], ageMin: 18, ageMax: 30, topicIds: ["top_fashion"] }), placements: ["feed", "clips"] });
  const paydaySet = buildDemoAdSet({ id: "ads_ife_payday", campaign: payday, name: "Lagos · bag buyers", audience: buildDemoAudience({ locationCodes: ["NG-LA"], ageMin: 21, ageMax: 45, gender: "female", topicIds: ["top_fashion"], behaviourIds: ["beh_cart_abandoners"] }), placements: ["feed", "mart", "search"] });
  const storeSet = buildDemoAdSet({ id: "ads_ife_store", campaign: storeWeek, name: "Returning visitors", audience: buildDemoAudience({ locationCodes: ["NG"], customAudienceIds: ["aud_ife_engagers"] }), placements: ["feed", "mart"] });
  const adaezeSet = buildDemoAdSet({ id: "ads_adaeze_lekki", campaign: adaezeBoost, name: "Lagos 18–35", audience: buildDemoAudience({ locationCodes: ["NG-LA"], ageMin: 18, ageMax: 35 }), placements: ["clips"] });
  const kkSet = buildDemoAdSet({ id: "ads_kk_sneakers", campaign: kkSales, name: "Sneaker heads · Lagos, Abuja, PH", audience: buildDemoAudience({ locationCodes: ["NG-LA", "NG-FC", "NG-RI"], ageMin: 18, ageMax: 35, gender: "male", topicIds: ["top_sneakers", "top_football"] }), placements: ["feed", "mart", "search"], bidStrategy: { type: "max_cpc", amount: buildMinorMoney(120, "NGN") } });
  const kkTrafficSet = buildDemoAdSet({ id: "ads_kk_unbox", campaign: kkTraffic, name: "Aba + Enugu + PH", audience: buildDemoAudience({ locationCodes: ["NG-AB", "NG-EN", "NG-RI"], ageMin: 18, ageMax: 40, topicIds: ["top_sneakers"] }), placements: ["clips", "stories"] });
  const kenteSet = buildDemoAdSet({ id: "ads_kente_jewellery", campaign: kenteSales, name: "Accra + Kumasi women 25–45", audience: buildDemoAudience({ locationCodes: ["GH-AA", "GH-AH"], ageMin: 25, ageMax: 45, gender: "female", topicIds: ["top_jewellery"] }), placements: ["feed", "mart"] });

  const adSets = [lagosWomen, lookalike, serumSet, awarenessSet, tailoringSet, followersSet, paydaySet, storeSet, adaezeSet, kkSet, kkTrafficSet, kenteSet];

  const ads = [
    buildDemoAd({ id: "ad_ife_adire_tile", adSet: lagosWomen, name: "Adire Oxford — product tile", source: source("prd_ife_adire"), format: "product", headline: "Adire Oxford Shirt", primaryText: "Hand-dyed in Abeokuta. Free delivery in Lagos this week.", callToAction: "shop_now" }),
    buildDemoAd({ id: "ad_ife_adire_post", adSet: lagosWomen, name: "Adire carousel — feed", source: source("pst_ife_adire"), format: "feed_post", headline: "The Adire Oxford is back", callToAction: "shop_now" }),
    buildDemoAd({ id: "ad_ife_styling_clip", adSet: lookalike, name: "3 ways to style adire — clip", source: source("clp_ife_styling"), format: "clip", headline: "One shirt, three looks", callToAction: "shop_now" }),
    buildDemoAd({ id: "ad_ife_bag_lookalike", adSet: lookalike, name: "Top-handle bag — product tile", source: source("prd_ife_bag"), format: "product", headline: "Leather Top-Handle Bag", primaryText: "Structured, roomy and made to last. Pay on delivery available.", callToAction: "shop_now" }),
    buildDemoAd({ id: "ad_ife_serum_clip", adSet: serumSet, name: "Glow routine — clip", source: source("clp_ife_serum"), format: "clip", headline: "Your 30-second glow routine", callToAction: "watch_more" }),
    buildDemoAd({ id: "ad_ife_serum_story", adSet: serumSet, name: "Glow serum — story", source: source("prd_ife_serum"), format: "story", headline: "Glow Face Serum", primaryText: "3 drops. Morning and night.", callToAction: "shop_now" }),
    buildDemoAd({ id: "ad_ife_brand_post", adSet: awarenessSet, name: "Brand reach — bomber", source: source("pst_ife_bomber"), format: "feed_post", headline: "Made in Lagos", callToAction: "learn_more" }),
    buildDemoAd({ id: "ad_ife_tailoring", adSet: tailoringSet, name: "Custom tailoring — DM", source: source("pst_ife_adire"), format: "feed_post", headline: "Your owambe fit, made to measure", primaryText: "Send us a message with your measurements and date. We deliver in 10 days.", callToAction: "send_message" }),
    buildDemoAd({ id: "ad_ife_followers", adSet: followersSet, name: "Style tips — follow", source: source("clp_ife_styling"), format: "clip", headline: "Weekly style tips", primaryText: "Follow Ife Lifestyle for a new look every Friday.", callToAction: "follow" }),
    buildDemoAd({
      id: "ad_ife_payday_bags",
      adSet: paydaySet,
      name: "Payday — first copy bags",
      source: source("prd_ife_bag"),
      format: "product",
      headline: "First copy designer bags — 70% off",
      primaryText: "Designer first copy bags at payday prices. Looks exactly like the original!",
      callToAction: "shop_now",
      review: { status: "rejected", policyCode: "counterfeit", policyReason: "The ad describes products as \"first copy\", which presents them as replicas of a branded product. Remove the replica wording, or show only products you have the right to sell.", reviewedAt: shiftTimestampByDays(-1, 15), appeal: null },
    }),
    buildDemoAd({ id: "ad_ife_store_draft", adSet: storeSet, name: "Store card — draft", source: source("st_ifelifestyle"), format: "store", headline: "Visit Ife Lifestyle", callToAction: "visit_store" }),
    buildDemoAd({ id: "ad_adaeze_lekki", adSet: adaezeSet, name: "Lekki market clip", source: source("clp_adaeze_lekki"), format: "clip", headline: "Thrift with me", callToAction: "watch_more" }),
    buildDemoAd({ id: "ad_kk_runner", adSet: kkSet, name: "Trail runner — product tile", source: source("prd_kk_runner"), format: "product", headline: "Trail Runner Sneakers", primaryText: "Grippy, cushioned and ready for Lagos traffic. Pay on delivery.", callToAction: "shop_now" }),
    buildDemoAd({ id: "ad_kk_street", adSet: kkSet, name: "Street sneakers — product tile", source: source("prd_kk_street"), format: "product", headline: "Street Sneakers", callToAction: "shop_now" }),
    buildDemoAd({ id: "ad_kk_unbox", adSet: kkTrafficSet, name: "Unboxing clip", source: source("clp_kk_unbox"), format: "clip", headline: "The new drop is here", callToAction: "visit_store" }),
    buildDemoAd({ id: "ad_kente_pendant", adSet: kenteSet, name: "Gold pendant — product tile", source: source("prd_kente_pendant"), format: "product", headline: "Gold Pendant Necklace", primaryText: "Crescent pendant, gold-plated. Delivered in Accra in 24 hours.", callToAction: "shop_now" }),
  ];

  return { campaigns, adSets, ads, audiences: buildDemoCustomAudiences() };
}
