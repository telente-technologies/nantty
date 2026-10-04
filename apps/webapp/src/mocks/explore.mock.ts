import type { Post } from "@/types";
import type { ExploreCategoryId, FollowSuggestion, HeadlineItem, RankedPost, TrendItem } from "@/types/explore.type";

import { mockPostsState, withCurrentProductPrices } from "./postCatalog.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { blockedUserIds, isFollowingUser } from "./socialGraph.mock";
import { directoryUsersExcludingAccounts, summariseUser } from "./userDirectory.mock";

const CATEGORIES: readonly { id: ExploreCategoryId; label: string }[] = [
  { id: "for_you", label: "For you" }, { id: "trending", label: "Trending" }, { id: "news", label: "News" }, { id: "sports", label: "Sports" },
  { id: "entertainment", label: "Entertainment" }, { id: "music", label: "Music" }, { id: "tech", label: "Tech" }, { id: "business", label: "Business" },
  { id: "fashion", label: "Fashion" }, { id: "gaming", label: "Gaming" }, { id: "comedy", label: "Comedy" }, { id: "religion", label: "Religion" },
  { id: "food", label: "Food" }, { id: "politics", label: "Politics" }, { id: "lifestyle", label: "Lifestyle" },
];

const TREND_SEEDS: readonly [string, string, number, number][] = [
  ["supereagles", "sports", 18420, 9210], ["afrobeats", "music", 12890, 7420], ["lagosfashionweek", "fashion", 8760, 3110],
  ["jollofwars", "food", 6420, 4180], ["nollywood", "entertainment", 5980, 2470], ["naira", "business", 5210, 3020],
  ["lagosrain", "news", 4870, 3650], ["techcabal", "tech", 3320, 1510], ["codmafrica", "gaming", 2910, 1240],
  ["skitmakers", "comedy", 2650, 1730], ["sundayservice", "religion", 2240, 1680], ["asoebi", "fashion", 1980, 1150],
];

const categoryLabel = (id: string) => CATEGORIES.find((category) => category.id === id)?.label ?? "Other";

const HEADLINE_SEEDS: readonly Omit<HeadlineItem, "postIds" | "sourceLabel">[] = [
  { id: "supereagles", title: "Super Eagles name squad for the AFCON qualifier in Uyo", summary: "4,210 public posts from 2,980 accounts in the last 24 hours. Related: #afcon, #uyo.", category: "sports", categoryLabel: "Sports", postCount: 4210, authorCount: 2980, hashtags: ["supereagles", "afcon"], coverImageUrl: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=640&q=70" },
  { id: "lagosfashionweek", title: "Lagos Fashion Week opens with ankara and adire collections", summary: "1,870 public posts from 940 accounts in the last 24 hours. Related: #ankara, #adire.", category: "fashion", categoryLabel: "Fashion", postCount: 1870, authorCount: 940, hashtags: ["lagosfashionweek", "ankara"], coverImageUrl: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=640&q=70" },
  { id: "lagosrain", title: "Heavy rain slows traffic on Third Mainland Bridge", summary: "1,240 public posts from 1,010 accounts in the last 24 hours. Related: #lagostraffic.", category: "news", categoryLabel: "News", postCount: 1240, authorCount: 1010, hashtags: ["lagosrain", "lagostraffic"], coverImageUrl: null },
  { id: "afrobeats", title: "New Afrobeats single tops streaming charts across West Africa", summary: "3,090 public posts from 2,150 accounts in the last 24 hours. Related: #newmusicfriday.", category: "music", categoryLabel: "Music", postCount: 3090, authorCount: 2150, hashtags: ["afrobeats"], coverImageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=640&q=70" },
];

const KEYWORDS: Readonly<Record<string, readonly string[]>> = {
  fashion: ["fashion", "outfit", "ankara", "style", "dress", "sneaker"], food: ["food", "jollof", "recipe", "suya", "chef"], tech: ["phone", "gadget", "tech", "laptop"],
  sports: ["football", "match", "goal"], music: ["music", "song", "afrobeats"], lifestyle: ["travel", "home", "skincare", "beauty"],
};

const visiblePosts = (): Post[] => [...mockPostsState.values()].filter((post) => !blockedUserIds.has(post.author.id) && !(post.sensitive?.labels?.length));

const matchesCategory = (post: Post, category: ExploreCategoryId) =>
  category === "for_you" || category === "trending" || (KEYWORDS[category] ?? []).some((keyword) => post.text.toLowerCase().includes(keyword));

const explain = (post: Post, index: number): RankedPost => ({
  ...withCurrentProductPrices(post),
  ranking: {
    boostMultiplier: post.author.verified ? 1.04 : 1,
    explanations: [
      index % 3 === 0 ? { code: "trending_topic", label: "Trending: #lagosfashionweek", detail: "lagosfashionweek" } : isFollowingUser(post.author.id) ? { code: "following", label: "You follow this account" } : { code: "similar_to_liked", label: "Similar to posts you liked" },
      ...(post.author.verified ? [{ code: "checkmark_boost", label: "Checkmark account", detail: "Gets a disclosed ranking boost of 4%, capped for everyone" }] : []),
    ],
  },
});

const REASONS = ["Followed by people you follow", "Popular in your region", "Similar to posts you liked"];

export const exploreMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/explore/categories", () => ({ data: CATEGORIES })),
  createMockRoute("GET", "/api/v1/explore/trends", ({ query }) => {
    const category = query.get("category");
    const items: TrendItem[] = TREND_SEEDS.filter(([, seedCategory]) => category === null || seedCategory === category).map(([hashtag, seedCategory, postCount, authorCount], index) => ({
      hashtag, label: `#${hashtag}`, category: seedCategory, categoryLabel: categoryLabel(seedCategory), postCount, authorCount, rank: index + 1, scope: "in Nigeria", context: `${categoryLabel(seedCategory)} · Trending`,
    }));
    return { scope: "in Nigeria", items: items.slice(0, Number(query.get("limit") ?? 10)) };
  }),
  createMockRoute("GET", "/api/v1/explore/headlines", ({ query }) => {
    const category = query.get("category");
    const postIds = visiblePosts().slice(0, 4).map((post) => post.id);
    return { scope: "in Nigeria", items: HEADLINE_SEEDS.filter((seed) => category === null || seed.category === category).map((seed) => ({ ...seed, postIds, sourceLabel: "Summarised from posts" as const })) };
  }),
  createMockRoute("GET", "/api/v1/explore/who-to-follow", ({ query }) => ({
    data: directoryUsersExcludingAccounts.filter((user) => !isFollowingUser(user.id)).slice(0, Number(query.get("limit") ?? 3)).map((user, index): FollowSuggestion => ({
      user: summariseUser(user), reason: { code: "popular_in_region", label: REASONS[index % REASONS.length]! }, isOfficial: index === 1, checkmarkTier: index === 1 ? "black_official" : "none",
    })),
  })),
  createMockRoute("GET", "/api/v1/explore/posts-for-you", ({ query }) => {
    const category = (query.get("category") ?? "for_you") as ExploreCategoryId;
    const start = Number(query.get("cursor") ?? 0);
    const posts = visiblePosts().filter((post) => matchesCategory(post, category));
    return { data: posts.slice(start, start + 5).map((post, index) => explain(post, start + index)), nextCursor: start + 5 < posts.length ? String(start + 5) : null };
  }),
];
