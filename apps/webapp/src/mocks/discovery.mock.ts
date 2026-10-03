import type { TrendingTopic } from "@/types";

import { createMockRoute, type MockRoute } from "./registry.mock";
import { isFollowingUser } from "./socialGraph.mock";
import { directoryUsersExcludingAccounts, summariseUser } from "./userDirectory.mock";

const SUGGESTED_ACCOUNT_COUNT = 5;

const trendingTopics: readonly TrendingTopic[] = [
  { tag: "#OwambeFits", postCount: 18_400, category: "Fashion" },
  { tag: "#DettyDecember", postCount: 12_900, category: "Lifestyle" },
  { tag: "#ZudomartFinds", postCount: 9_700, category: "Shopping" },
  { tag: "#JollofWars", postCount: 7_250, category: "Food" },
  { tag: "#SuperEagles", postCount: 6_810, category: "Sports" },
];

const listSuggestedAccounts = () =>
  directoryUsersExcludingAccounts
    .filter((user) => !isFollowingUser(user.id))
    .sort((a, b) => b.followers - a.followers)
    .slice(0, SUGGESTED_ACCOUNT_COUNT)
    .map(summariseUser);

export const discoveryMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/users/suggested", listSuggestedAccounts),
  createMockRoute("GET", "/api/v1/trending", () => trendingTopics),
];
