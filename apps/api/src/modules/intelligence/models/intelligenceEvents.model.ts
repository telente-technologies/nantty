import type { IntelligenceAdPlacement } from "./intelligenceAds.model.js";
import type { IntelligenceMoney } from "./intelligenceRanking.model.js";

export type TargetType = "post" | "clip" | "story" | "live" | "product" | "store" | "account" | "comment" | "ad";

export interface ItemTopics {
  readonly topics?: readonly string[];
  readonly hashtags?: readonly string[];
}

export interface IntelligenceEventContext {
  readonly surface?: string;
  readonly rankingRequestId?: string;
  readonly deviceClass?: "android" | "ios" | "web" | "other";
}

export type IntelligenceEventPayloads = {
  readonly post_viewed: ItemTopics & { readonly postId: string; readonly authorUserId: string; readonly dwellMs: number; readonly position?: number; readonly isProductPost: boolean };
  readonly post_liked: ItemTopics & { readonly postId: string; readonly authorUserId: string };
  readonly commented: ItemTopics & { readonly postId: string; readonly authorUserId: string };
  readonly shared: ItemTopics & { readonly postId: string; readonly authorUserId: string; readonly channel: "in_app" | "external" | "message" | "story" };
  readonly followed: { readonly targetAccountId: string; readonly targetKind: "user" | "store" };
  readonly clip_watched: ItemTopics & { readonly clipId: string; readonly creatorUserId: string; readonly watchFraction: number; readonly loopCount: number; readonly durationMs: number };
  readonly product_viewed: { readonly productId: string; readonly storeId: string; readonly sourcePostId?: string; readonly categoryId?: string; readonly price?: IntelligenceMoney };
  readonly added_to_cart: { readonly productId: string; readonly storeId: string; readonly quantity: number; readonly sourcePostId?: string };
  readonly purchased: { readonly orderId: string; readonly storeId: string; readonly items: readonly { readonly productId: string; readonly quantity: number; readonly unitPrice: IntelligenceMoney }[] };
  readonly searched: { readonly queryText: string; readonly resultCount: number };
  readonly ad_impression: { readonly adId: string; readonly campaignId: string; readonly advertiserId: string; readonly auctionId: string; readonly placement: IntelligenceAdPlacement; readonly hostContentId?: string; readonly hostCreatorUserId?: string; readonly charge?: IntelligenceMoney };
  readonly ad_click: { readonly adId: string; readonly campaignId: string; readonly auctionId: string; readonly charge?: IntelligenceMoney };
  readonly ad_conversion: { readonly adId: string; readonly campaignId: string; readonly orderId: string; readonly value: IntelligenceMoney };
  readonly reported: { readonly targetId: string; readonly targetType: TargetType; readonly targetAuthorUserId?: string; readonly reasonCode: "spam" | "scam" | "nudity" | "violence" | "hate" | "counterfeit" | "harassment" | "other" };
  readonly hidden: { readonly targetId: string; readonly targetType: TargetType; readonly targetAuthorUserId?: string; readonly topics?: readonly string[] };
  readonly gift_sent: { readonly giftId: string; readonly creatorUserId: string; readonly coinAmount: number; readonly hostContentId?: string };
};

export type IntelligenceEventType = keyof IntelligenceEventPayloads;

export type IntelligenceEventInput = {
  readonly [Type in IntelligenceEventType]: {
    readonly eventType: Type;
    readonly eventId?: string;
    readonly actorUserId: string;
    readonly occurredAt: Date;
    readonly country?: string | null;
    readonly context?: IntelligenceEventContext;
    readonly payload: IntelligenceEventPayloads[Type];
  };
}[IntelligenceEventType];

export interface IntelligenceEventEnvelope {
  readonly eventId: string;
  readonly eventType: IntelligenceEventType;
  readonly eventVersion: 1;
  readonly occurredAt: string;
  readonly producer: "api";
  readonly actorId: string;
  readonly country?: string;
  readonly context?: IntelligenceEventContext;
  readonly payload: Readonly<Record<string, unknown>>;
}

export interface EventIngestionResponse {
  readonly accepted: number;
  readonly duplicates: number;
  readonly rejected: readonly { readonly index: number; readonly eventId?: string; readonly reason: string }[];
}
