import { buildUnsplashImageUrl, unsplashPhotoIds } from "@/mocks/seed/unsplashPhotoIds.mock";
import { isoMinutesAgo, isoMinutesFromNow, type WritableRecord } from "@/mocks/seed/trustTime.mock";
import type { AdForReview, AdPolicyCategory, AdvertiserAccount } from "@/types/adsReview.type";

export interface MockAdRecord extends Omit<AdForReview, "advertiser" | "status" | "decision"> {
  advertiserId: string;
  status: AdForReview["status"];
  decision: AdForReview["decision"];
}

export type MockAdvertiserRecord = WritableRecord<Omit<AdvertiserAccount, "owner">> & {
  ownerUserId: string;
};

export type MockAdPolicyRecord = WritableRecord<AdPolicyCategory>;

const image = (photoId: string) => buildUnsplashImageUrl(photoId, 640);
const money = (amountMinor: number, currency: string) => ({ amountMinor, currency });

export function buildDemoAdPolicies(): MockAdPolicyRecord[] {
  return [
    { id: "pol_misleading", name: "Misleading claims", description: "Exaggerated results, fake scarcity, before/after claims that can't be verified.", severity: "MEDIUM", isActive: true, rejectionCount: 214 },
    { id: "pol_prohibited", name: "Prohibited products", description: "Weapons, drugs, tobacco, prescription medicine, human hair sold as organs, wildlife.", severity: "CRITICAL", isActive: true, rejectionCount: 58 },
    { id: "pol_counterfeit", name: "Counterfeit goods", description: "Replicas, 'first copy', 'master copy' or unauthorised use of brand trademarks.", severity: "HIGH", isActive: true, rejectionCount: 390 },
    { id: "pol_financial", name: "Financial scams", description: "Get-rich-quick, guaranteed returns, unlicensed investment or forex schemes.", severity: "CRITICAL", isActive: true, rejectionCount: 172 },
    { id: "pol_adult", name: "Adult content", description: "Sexually suggestive creative or adult services.", severity: "HIGH", isActive: true, rejectionCount: 41 },
    { id: "pol_health", name: "Health claims", description: "Cures, weight loss guarantees, unapproved supplements (NAFDAC number required).", severity: "HIGH", isActive: true, rejectionCount: 133 },
    { id: "pol_landing", name: "Broken or mismatched landing page", description: "Landing page doesn't load, redirects elsewhere, or sells something different.", severity: "LOW", isActive: true, rejectionCount: 97 },
    { id: "pol_political", name: "Political ads", description: "Election and political issue ads are not accepted.", severity: "MEDIUM", isActive: false, rejectionCount: 12 },
  ];
}

export function buildDemoAdvertisers(): MockAdvertiserRecord[] {
  return [
    { id: "adv_0001", name: "Adaeze Styles", ownerUserId: "usr_0001", status: "ACTIVE", country: "NG", currency: "NGN", spendByCurrency: [money(4_820_000_00, "NGN")], activeCampaigns: 6, violationCount: 0, lastViolationAt: null, createdAt: isoMinutesAgo(400_000) },
    { id: "adv_0002", name: "Funke Naturals", ownerUserId: "usr_0013", status: "ACTIVE", country: "NG", currency: "NGN", spendByCurrency: [money(1_265_500_00, "NGN")], activeCampaigns: 3, violationCount: 2, lastViolationAt: isoMinutesAgo(20_000), createdAt: isoMinutesAgo(300_000) },
    { id: "adv_0003", name: "Kwame Beats Music", ownerUserId: "usr_0007", status: "ACTIVE", country: "GH", currency: "GHS", spendByCurrency: [money(18_400_00, "GHS")], activeCampaigns: 2, violationCount: 0, lastViolationAt: null, createdAt: isoMinutesAgo(150_000) },
    { id: "adv_0004", name: "Tomi Travels", ownerUserId: "usr_0022", status: "ACTIVE", country: "GB", currency: "GBP", spendByCurrency: [money(2_950_00, "GBP"), money(310_000_00, "NGN")], activeCampaigns: 1, violationCount: 1, lastViolationAt: isoMinutesAgo(90_000), createdAt: isoMinutesAgo(200_000) },
    { id: "adv_0005", name: "Dayo Deals Wholesale", ownerUserId: "usr_0012", status: "SUSPENDED", country: "NG", currency: "NGN", spendByCurrency: [money(640_000_00, "NGN")], activeCampaigns: 0, violationCount: 5, lastViolationAt: isoMinutesAgo(3000), createdAt: isoMinutesAgo(90_000) },
    { id: "adv_0006", name: "Musa Motors", ownerUserId: "usr_0014", status: "ACTIVE", country: "NG", currency: "NGN", spendByCurrency: [money(212_000_00, "NGN")], activeCampaigns: 1, violationCount: 0, lastViolationAt: null, createdAt: isoMinutesAgo(40_000) },
  ];
}

const placements = ["Home feed", "Clips", "Mart home"];

export function buildDemoAdsForReview(): MockAdRecord[] {
  const base = { totalBudget: null, schedule: { startsAt: isoMinutesFromNow(120), endsAt: isoMinutesFromNow(14 * 1440) }, status: "PENDING" as const, decision: null, isBoostedPost: false };
  return [
    { ...base, id: "ad_0001", advertiserId: "adv_0001", campaignName: "Owambe season — aso-ebi drop", submittedAt: isoMinutesAgo(45),
      creative: { format: "IMAGE", imageUrl: image(unsplashPhotoIds.posts.weddingAsoEbi[1]), headline: "Aso-ebi for the whole squad", primaryText: "Custom colours, 5-day delivery across Nigeria. Pay safely with Nantty escrow.", callToAction: "Shop now", landingUrl: "https://nantty.com/s/adaeze.styles" },
      targeting: { countries: ["NG"], ageRange: "21–45", interests: ["Weddings", "Fashion"], placements }, dailyBudget: money(25_000_00, "NGN"), autoCheckFlags: [] },
    { ...base, id: "ad_0002", advertiserId: "adv_0002", campaignName: "Glow serum launch", submittedAt: isoMinutesAgo(130),
      creative: { format: "IMAGE", imageUrl: image(unsplashPhotoIds.products.b6[1]), headline: "Clear skin in 7 days — guaranteed", primaryText: "Our herbal serum cures acne and eczema permanently. 100% natural.", callToAction: "Order now", landingUrl: "https://funkenaturals.ng/serum" },
      targeting: { countries: ["NG", "GH"], ageRange: "18–35", interests: ["Beauty", "Skincare"], placements }, dailyBudget: money(15_000_00, "NGN"),
      autoCheckFlags: [{ policyCategoryId: "pol_health", label: "Health claims", severity: "HIGH", detail: "Text contains 'cures' and 'guaranteed'; no NAFDAC number detected." }, { policyCategoryId: "pol_misleading", label: "Misleading claims", severity: "MEDIUM", detail: "Time-bound result promise ('7 days')." }] },
    { ...base, id: "ad_0003", advertiserId: "adv_0003", campaignName: "New single — Accra Summer", submittedAt: isoMinutesAgo(260), isBoostedPost: true,
      creative: { format: "VIDEO", imageUrl: image(unsplashPhotoIds.posts.beachSunset[0]), headline: "Accra Summer out now", primaryText: "Use the sound in your clips 🎶", callToAction: "Use sound", landingUrl: "https://nantty.com/sound/snd_8801" },
      targeting: { countries: ["GH", "NG"], ageRange: "16–30", interests: ["Afrobeats", "Dance"], placements: ["Clips"] }, dailyBudget: money(300_00, "GHS"), totalBudget: money(4_500_00, "GHS"), autoCheckFlags: [] },
    { ...base, id: "ad_0004", advertiserId: "adv_0004", campaignName: "Zanzibar group trip", submittedAt: isoMinutesAgo(400),
      creative: { format: "CAROUSEL", imageUrl: image(unsplashPhotoIds.posts.airportTravel[0]), headline: "Zanzibar, 5 nights from £899", primaryText: "Flights from Lagos and London, hotel and tours included.", callToAction: "Book a slot", landingUrl: "https://tomitravels.co.uk/zanzibar" },
      targeting: { countries: ["GB", "NG"], ageRange: "25–45", interests: ["Travel"], placements }, dailyBudget: money(40_00, "GBP"),
      autoCheckFlags: [{ policyCategoryId: "pol_landing", label: "Landing page", severity: "LOW", detail: "Landing page responded slowly (6.2 s) during crawl." }] },
    { ...base, id: "ad_0005", advertiserId: "adv_0006", campaignName: "Tokunbo Camry clearance", submittedAt: isoMinutesAgo(610),
      creative: { format: "IMAGE", imageUrl: image(unsplashPhotoIds.products.k2[0]), headline: "2019 Camry, pay 30% and drive", primaryText: "Pay deposit by bank transfer to reserve. First come first served!", callToAction: "Message us", landingUrl: "https://nantty.com/s/musa.motors" },
      targeting: { countries: ["NG"], ageRange: "25–55", interests: ["Cars"], placements }, dailyBudget: money(10_000_00, "NGN"),
      autoCheckFlags: [{ policyCategoryId: "pol_financial", label: "Off-platform payment", severity: "CRITICAL", detail: "Asks for bank transfer deposit outside Nantty checkout." }] },
    { ...base, id: "ad_0006", advertiserId: "adv_0001", campaignName: "Weekend flash sale", submittedAt: isoMinutesAgo(3000), status: "APPROVED",
      decision: { policyCategoryId: null, reason: "Creative and landing page comply.", decidedByName: "Chidi Okafor", decidedAt: isoMinutesAgo(2900) },
      creative: { format: "IMAGE", imageUrl: image(unsplashPhotoIds.products.f1[0]), headline: "30% off this weekend", primaryText: "Selected styles only.", callToAction: "Shop now", landingUrl: "https://nantty.com/s/adaeze.styles" },
      targeting: { countries: ["NG"], ageRange: "18–45", interests: ["Fashion"], placements }, dailyBudget: money(20_000_00, "NGN"), autoCheckFlags: [] },
    { ...base, id: "ad_0007", advertiserId: "adv_0005", campaignName: "Rolex AAA wholesale", submittedAt: isoMinutesAgo(3500), status: "REJECTED",
      decision: { policyCategoryId: "pol_counterfeit", reason: "Replica luxury watches.", decidedByName: "Chidi Okafor", decidedAt: isoMinutesAgo(3100) },
      creative: { format: "IMAGE", imageUrl: image(unsplashPhotoIds.products.g1[1]), headline: "AAA Rolex from ₦45k", primaryText: "Looks 100% original.", callToAction: "Buy now", landingUrl: "https://nantty.com/s/dayo_deals" },
      targeting: { countries: ["NG"], ageRange: "18–50", interests: ["Watches"], placements }, dailyBudget: money(5_000_00, "NGN"),
      autoCheckFlags: [{ policyCategoryId: "pol_counterfeit", label: "Counterfeit goods", severity: "HIGH", detail: "Text contains 'AAA' and a protected brand name." }] },
  ];
}
