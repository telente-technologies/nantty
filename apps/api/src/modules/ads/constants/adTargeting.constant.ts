import type { CampaignObjective, LocationTarget } from "../models/adCampaigns.model.js";

export interface AdBehaviour {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

export const AD_BEHAVIOURS: readonly AdBehaviour[] = [
  { id: "beh_recent_buyers", name: "Bought on Zudomart in the last 30 days", description: "People with at least one completed order." },
  { id: "beh_frequent_buyers", name: "Frequent buyers", description: "Three or more orders in the last 90 days." },
  { id: "beh_live_shoppers", name: "Live shopping viewers", description: "Watched a live shopping session in the last 30 days." },
  { id: "beh_cart_abandoners", name: "Left items in cart", description: "Added to cart but did not check out in the last 14 days." },
  { id: "beh_clip_watchers", name: "Heavy reel watchers", description: "Watch reels most days." },
  { id: "beh_new_users", name: "New to Zudomart", description: "Joined in the last 30 days." },
  { id: "beh_pay_on_delivery", name: "Prefers pay on delivery", description: "Chooses pay on delivery at checkout." },
  { id: "beh_android_budget", name: "Uses an entry-level Android phone", description: "Useful for lighter creatives and data-friendly reels." },
];

function country(code: string, name: string): LocationTarget {
  return { type: "country", code, name, countryCode: code, parentName: null };
}

function state(code: string, name: string, countryCode: string, countryName: string): LocationTarget {
  return { type: "state", code, name, countryCode, parentName: countryName };
}

function city(code: string, name: string, countryCode: string, parentName: string): LocationTarget {
  return { type: "city", code, name, countryCode, parentName };
}

export const AD_LOCATIONS: readonly LocationTarget[] = [
  country("NG", "Nigeria"), country("GH", "Ghana"), country("KE", "Kenya"), country("ZA", "South Africa"), country("GB", "United Kingdom"), country("US", "United States"),
  state("NG-LA", "Lagos", "NG", "Nigeria"), state("NG-FC", "Federal Capital Territory", "NG", "Nigeria"), state("NG-RI", "Rivers", "NG", "Nigeria"),
  state("NG-OY", "Oyo", "NG", "Nigeria"), state("NG-KN", "Kano", "NG", "Nigeria"), state("NG-EN", "Enugu", "NG", "Nigeria"), state("NG-AB", "Abia", "NG", "Nigeria"),
  state("NG-OG", "Ogun", "NG", "Nigeria"), state("NG-ED", "Edo", "NG", "Nigeria"), state("NG-KD", "Kaduna", "NG", "Nigeria"), state("NG-AN", "Anambra", "NG", "Nigeria"),
  state("NG-DE", "Delta", "NG", "Nigeria"), state("NG-KW", "Kwara", "NG", "Nigeria"), state("NG-PL", "Plateau", "NG", "Nigeria"),
  state("GH-AA", "Greater Accra", "GH", "Ghana"), state("GH-AH", "Ashanti", "GH", "Ghana"), state("KE-30", "Nairobi County", "KE", "Kenya"),
  city("NG-LA-IKJ", "Ikeja", "NG", "Lagos, Nigeria"), city("NG-LA-LEK", "Lekki", "NG", "Lagos, Nigeria"), city("NG-LA-YAB", "Yaba", "NG", "Lagos, Nigeria"),
  city("NG-LA-SUR", "Surulere", "NG", "Lagos, Nigeria"), city("NG-FC-ABJ", "Abuja", "NG", "Federal Capital Territory, Nigeria"),
  city("NG-RI-PHC", "Port Harcourt", "NG", "Rivers, Nigeria"), city("NG-OY-IBA", "Ibadan", "NG", "Oyo, Nigeria"), city("NG-AB-ABA", "Aba", "NG", "Abia, Nigeria"),
  city("NG-EN-ENU", "Enugu", "NG", "Enugu, Nigeria"), city("NG-KN-KAN", "Kano", "NG", "Kano, Nigeria"), city("NG-ED-BEN", "Benin City", "NG", "Edo, Nigeria"),
  city("GH-AA-ACC", "Accra", "GH", "Greater Accra, Ghana"), city("GH-AH-KUM", "Kumasi", "GH", "Ashanti, Ghana"), city("KE-30-NBO", "Nairobi", "KE", "Nairobi County, Kenya"),
];

export const REACHABLE_PEOPLE_BY_LOCATION_CODE: Readonly<Record<string, number>> = {
  NG: 38_000_000, GH: 6_200_000, KE: 7_400_000, ZA: 5_100_000, GB: 900_000, US: 1_300_000,
  "NG-LA": 11_200_000, "NG-FC": 3_100_000, "NG-RI": 2_600_000, "NG-OY": 2_200_000, "NG-KN": 2_000_000, "NG-EN": 1_300_000, "NG-AB": 1_000_000, "NG-OG": 1_500_000,
  "NG-ED": 1_100_000, "NG-KD": 1_400_000, "NG-AN": 1_200_000, "NG-DE": 1_100_000, "NG-KW": 700_000, "NG-PL": 600_000, "GH-AA": 2_900_000, "GH-AH": 1_900_000, "KE-30": 3_200_000,
};

export const COST_PER_THOUSAND_MAJOR_RANGE_BY_CURRENCY: Readonly<Record<string, readonly [number, number]>> = {
  NGN: [520, 1450], GHS: [6, 16], KES: [70, 190], ZAR: [9, 24], GBP: [2, 5], EUR: [2, 5], USD: [2, 6],
};

export const CLICK_RATE_BY_OBJECTIVE: Readonly<Record<CampaignObjective, number>> = {
  awareness: 0.006, traffic: 0.019, engagement: 0.024, messages: 0.014, sales: 0.013, followers: 0.017, store_promotion: 0.018,
};

export const RESULT_LABEL_BY_OBJECTIVE: Readonly<Record<CampaignObjective, string>> = {
  awareness: "Reach", traffic: "Link clicks", engagement: "Engagements", messages: "Conversations started", followers: "Follows", store_promotion: "Store visits", sales: "Purchases",
};

export const ENGAGEMENT_SOURCE_DESCRIPTIONS: Readonly<Record<string, string>> = {
  any_post: "People who liked, commented on or shared any post.",
  clips_watched: "People who watched at least half of a reel.",
  live_viewers: "People who joined one of your live sessions.",
  saved_products: "People who saved one of your products.",
  messaged: "People who sent you a message.",
};
