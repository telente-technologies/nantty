import type { Behaviour, LocationTarget, Topic } from "@/types/audience.type";

export const demoTopics: readonly Topic[] = [
  ["top_fashion", "Fashion", "fashion"],
  ["top_beauty", "Beauty & skincare", "beauty"],
  ["top_sneakers", "Sneakers", "sneakers"],
  ["top_gadgets", "Phones & gadgets", "gadgets"],
  ["top_food", "Food & recipes", "food"],
  ["top_home", "Home & decor", "home"],
  ["top_owambe", "Owambe & events", "owambe"],
  ["top_afrobeats", "Afrobeats", "afrobeats"],
  ["top_football", "Football", "football"],
  ["top_fitness", "Fitness", "fitness"],
  ["top_parenting", "Parenting", "parenting"],
  ["top_business", "Small business", "small-business"],
  ["top_travel", "Travel", "travel"],
  ["top_nollywood", "Nollywood", "nollywood"],
  ["top_jewellery", "Jewellery", "jewellery"],
].map(([id, name, slug]) => ({ id: id as string, name: name as string, slug: slug as string }));

export const demoBehaviours: readonly Behaviour[] = [
  { id: "beh_recent_buyers", name: "Bought on Nantty in the last 30 days", description: "People with at least one completed order." },
  { id: "beh_frequent_buyers", name: "Frequent buyers", description: "Three or more orders in the last 90 days." },
  { id: "beh_live_shoppers", name: "Live shopping viewers", description: "Watched a live shopping session in the last 30 days." },
  { id: "beh_cart_abandoners", name: "Left items in cart", description: "Added to cart but did not check out in the last 14 days." },
  { id: "beh_clip_watchers", name: "Heavy reel watchers", description: "Watch reels most days." },
  { id: "beh_new_users", name: "New to Nantty", description: "Joined in the last 30 days." },
  { id: "beh_pay_on_delivery", name: "Prefers pay on delivery", description: "Chooses pay on delivery at checkout." },
  { id: "beh_android_budget", name: "Uses an entry-level Android phone", description: "Useful for lighter creatives and data-friendly reels." },
];

function state(code: string, name: string, countryCode: string, countryName: string): LocationTarget {
  return { type: "state", code, name, countryCode, parentName: countryName };
}

function city(code: string, name: string, countryCode: string, parentName: string): LocationTarget {
  return { type: "city", code, name, countryCode, parentName };
}

export const demoLocations: readonly LocationTarget[] = [
  { type: "country", code: "NG", name: "Nigeria", countryCode: "NG", parentName: null },
  { type: "country", code: "GH", name: "Ghana", countryCode: "GH", parentName: null },
  { type: "country", code: "KE", name: "Kenya", countryCode: "KE", parentName: null },
  { type: "country", code: "ZA", name: "South Africa", countryCode: "ZA", parentName: null },
  { type: "country", code: "GB", name: "United Kingdom", countryCode: "GB", parentName: null },
  { type: "country", code: "US", name: "United States", countryCode: "US", parentName: null },
  state("NG-LA", "Lagos", "NG", "Nigeria"),
  state("NG-FC", "Federal Capital Territory", "NG", "Nigeria"),
  state("NG-RI", "Rivers", "NG", "Nigeria"),
  state("NG-OY", "Oyo", "NG", "Nigeria"),
  state("NG-KN", "Kano", "NG", "Nigeria"),
  state("NG-EN", "Enugu", "NG", "Nigeria"),
  state("NG-AB", "Abia", "NG", "Nigeria"),
  state("NG-OG", "Ogun", "NG", "Nigeria"),
  state("NG-ED", "Edo", "NG", "Nigeria"),
  state("NG-KD", "Kaduna", "NG", "Nigeria"),
  state("NG-AN", "Anambra", "NG", "Nigeria"),
  state("NG-DE", "Delta", "NG", "Nigeria"),
  state("NG-KW", "Kwara", "NG", "Nigeria"),
  state("NG-PL", "Plateau", "NG", "Nigeria"),
  state("GH-AA", "Greater Accra", "GH", "Ghana"),
  state("GH-AH", "Ashanti", "GH", "Ghana"),
  state("KE-30", "Nairobi County", "KE", "Kenya"),
  city("NG-LA-IKJ", "Ikeja", "NG", "Lagos, Nigeria"),
  city("NG-LA-LEK", "Lekki", "NG", "Lagos, Nigeria"),
  city("NG-LA-YAB", "Yaba", "NG", "Lagos, Nigeria"),
  city("NG-LA-SUR", "Surulere", "NG", "Lagos, Nigeria"),
  city("NG-FC-ABJ", "Abuja", "NG", "Federal Capital Territory, Nigeria"),
  city("NG-RI-PHC", "Port Harcourt", "NG", "Rivers, Nigeria"),
  city("NG-OY-IBA", "Ibadan", "NG", "Oyo, Nigeria"),
  city("NG-AB-ABA", "Aba", "NG", "Abia, Nigeria"),
  city("NG-EN-ENU", "Enugu", "NG", "Enugu, Nigeria"),
  city("NG-KN-KAN", "Kano", "NG", "Kano, Nigeria"),
  city("NG-ED-BEN", "Benin City", "NG", "Edo, Nigeria"),
  city("GH-AA-ACC", "Accra", "GH", "Greater Accra, Ghana"),
  city("GH-AH-KUM", "Kumasi", "GH", "Ashanti, Ghana"),
  city("KE-30-NBO", "Nairobi", "KE", "Nairobi County, Kenya"),
];

export const demoPopulationByLocationCode: Record<string, number> = {
  NG: 38_000_000, GH: 6_200_000, KE: 7_400_000, ZA: 5_100_000, GB: 900_000, US: 1_300_000,
  "NG-LA": 11_200_000, "NG-FC": 3_100_000, "NG-RI": 2_600_000, "NG-OY": 2_200_000, "NG-KN": 2_000_000, "NG-EN": 1_300_000, "NG-AB": 1_000_000, "NG-OG": 1_500_000,
  "NG-ED": 1_100_000, "NG-KD": 1_400_000, "NG-AN": 1_200_000, "NG-DE": 1_100_000, "NG-KW": 700_000, "NG-PL": 600_000, "GH-AA": 2_900_000, "GH-AH": 1_900_000, "KE-30": 3_200_000,
};

export function estimatePopulationForLocation(location: LocationTarget): number {
  if (demoPopulationByLocationCode[location.code]) return demoPopulationByLocationCode[location.code] as number;
  return location.type === "city" ? 650_000 : 800_000;
}
