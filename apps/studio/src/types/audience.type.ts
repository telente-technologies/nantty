import type { ID, ISODate, Money } from "@/types";

export interface PersonSummary {
  readonly id: ID;
  readonly name: string;
  readonly username: string;
  readonly avatarUrl: string | null;
}

export interface MyPost {
  readonly id: ID;
  readonly kind: "post" | "clip";
  readonly createdAt: ISODate;
  readonly text: string;
  readonly media: readonly { readonly type: "image" | "video"; readonly posterUrl: string | null; readonly url: string | null }[];
  readonly likes: number;
  readonly comments: number;
  readonly reposts: number;
  readonly shares: number;
  readonly views: number;
  readonly saveCount: number;
  readonly durationSeconds: number | null;
  readonly subscriberOnly: boolean;
}

export interface PostVideoAnalytics {
  readonly views: number;
  readonly watchTimeSeconds: number;
  readonly averageWatchSeconds: number;
  readonly completedViews: number;
  readonly completionRate: number;
}

export interface PostAnalytics {
  readonly postId: ID;
  readonly kind: "post" | "clip" | "story";
  readonly postedAt: ISODate;
  readonly impressions: number;
  readonly uniqueViewers: number;
  readonly reach: number;
  readonly likes: number;
  readonly comments: number;
  readonly reposts: number;
  readonly shares: number;
  readonly saves: number;
  readonly profileVisits: number;
  readonly linkClicks: number;
  readonly newFollows: number;
  readonly engagements: number;
  readonly engagementRate: number;
  readonly video: PostVideoAnalytics | null;
  readonly audience: readonly { readonly label: string; readonly share: number }[];
  readonly daily: readonly { readonly day: string; readonly impressions: number }[];
}

export interface Follower extends PersonSummary {
  readonly isFollowing: boolean;
}

export type RankingBoard = "streamer" | "creator" | "supporter" | "engagement";
export type RankingPeriod = "day" | "week" | "month" | "all";

export interface RankingEntry {
  readonly rank: number;
  readonly user: PersonSummary;
  readonly points: number;
}

export interface SubscriptionPlan {
  readonly id: ID;
  readonly name: string;
  readonly description: string;
  readonly price: Money;
  readonly interval: "month" | "year";
  readonly benefits: readonly string[];
  readonly subscriberCount: number;
  readonly active: boolean;
}

export interface PriceTier {
  readonly tier: string;
  readonly prices: Readonly<Record<"web" | "ios" | "android", Money>>;
  readonly default: boolean;
}

export interface Subscriber {
  readonly id: ID;
  readonly user: PersonSummary | null;
  readonly planId: ID;
  readonly planName: string;
  readonly since: ISODate;
  readonly renewsAt: ISODate | null;
  readonly status: string;
}

export interface NewSubscriptionPlan {
  readonly name: string;
  readonly description: string;
  readonly price: Money;
  readonly interval: "month" | "year";
  readonly benefits: readonly string[];
}
