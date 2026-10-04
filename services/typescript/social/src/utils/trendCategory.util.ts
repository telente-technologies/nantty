import type { TrendCategory } from "../constants/ranking.constant.js";

const categoryKeywords: readonly (readonly [TrendCategory, readonly string[]])[] = [
  ["news", ["news", "breaking", "update", "weather", "flood", "traffic", "headline", "report"]],
  ["sports", ["sport", "football", "soccer", "epl", "premierleague", "afcon", "supereagles", "nba", "basketball", "athletics", "olympic", "boxing", "ucl", "laliga", "match", "goal", "tennis", "cricket", "f1"]],
  ["entertainment", ["movie", "film", "nollywood", "bbnaija", "celebrity", "tv", "series", "netflix", "showbiz", "awards"]],
  ["music", ["music", "afrobeats", "amapiano", "album", "song", "concert", "rap", "hiphop", "gospelmusic", "playlist", "dj"]],
  ["tech", ["tech", "ai", "startup", "coding", "developer", "iphone", "android", "gadget", "crypto", "software", "app"]],
  ["business", ["business", "market", "naira", "economy", "stocks", "finance", "sme", "entrepreneur", "trade", "price"]],
  ["fashion", ["fashion", "style", "outfit", "ankara", "aso", "asoebi", "streetwear", "sneakers", "ootd", "thrift"]],
  ["gaming", ["gaming", "game", "esports", "fifa", "codm", "pubg", "playstation", "xbox", "nintendo", "freefire"]],
  ["comedy", ["comedy", "funny", "skit", "meme", "lol", "jokes", "prank"]],
  ["religion", ["church", "mosque", "prayer", "gospel", "ramadan", "eid", "christmas", "easter", "faith", "sermon"]],
  ["food", ["food", "jollof", "recipe", "suya", "cooking", "chef", "restaurant", "foodie", "kitchen"]],
  ["politics", ["politics", "election", "senate", "governor", "president", "inec", "voting", "policy", "minister"]],
  ["lifestyle", ["lifestyle", "travel", "fitness", "wellness", "beauty", "skincare", "makeup", "home", "wedding", "health"]],
];

const spamFragments = ["follow4follow", "followforfollow", "f4f", "like4like", "likeforlike", "l4l", "followback", "followme", "sub4sub", "gainfollowers", "freefollowers", "instantfollowers", "buyfollowers", "teamfollowback"];

export const normaliseTrendSlug = (slug: string): string => slug.toLowerCase().replace(/[^a-z0-9]/g, "");

export function classifyTrendCategory(slug: string): TrendCategory {
  const normalised = normaliseTrendSlug(slug);
  if (normalised === "") return "other";
  for (const [category, keywords] of categoryKeywords) if (keywords.includes(normalised)) return category;
  for (const [category, keywords] of categoryKeywords) if (keywords.some((keyword) => keyword.length >= 4 && normalised.includes(keyword))) return category;
  return "other";
}

export function isSpammyHashtag(slug: string): boolean {
  const normalised = normaliseTrendSlug(slug);
  if (normalised === "" || normalised.length > 40) return true;
  if (spamFragments.some((fragment) => normalised.includes(fragment))) return true;
  return /(.)\1{4,}/.test(normalised) || /\d{6,}/.test(normalised);
}

export const trendCategoryLabels: Readonly<Record<string, string>> = {
  for_you: "For you", trending: "Trending", news: "News", sports: "Sports", entertainment: "Entertainment", music: "Music", tech: "Tech", business: "Business", fashion: "Fashion", gaming: "Gaming", comedy: "Comedy", religion: "Religion", food: "Food", politics: "Politics", lifestyle: "Lifestyle", other: "Other",
};
