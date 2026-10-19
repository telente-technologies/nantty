import type { Money } from "@/types/money.type";

export type CreativeFormat = "feed_post" | "clip" | "product" | "store" | "story" | "live";
export type CreativeSourceType = "post" | "clip" | "product" | "store" | "live" | "upload";
export type CallToAction = "shop_now" | "learn_more" | "visit_store" | "send_message" | "follow" | "watch_more" | "order_now" | "sign_up" | "install" | "download" | "book_now" | "contact_us";
export type DestinationType = "post" | "profile" | "store" | "product" | "messages" | "url" | "app_store";
export type CreativeType = "single" | "carousel" | "app_install" | "promoted_post";
export type AdStorePlatform = "ios" | "android" | "web";

export interface CreativeMedia {
  readonly id: string;
  readonly kind: "image" | "video";
  readonly url: string;
  readonly posterUrl: string | null;
  readonly width: number;
  readonly height: number;
  readonly durationSeconds: number | null;
}

export interface CreativeIdentity {
  readonly name: string;
  readonly handle: string;
  readonly avatarUrl: string | null;
  readonly verifiedBusiness: boolean;
}

export type PromotableDestinationKind = Extract<DestinationType, "profile" | "store">;

export interface PromotedDestinationIdentity {
  readonly kind: PromotableDestinationKind;
  readonly id: string;
  readonly name: string;
  readonly handle: string;
  readonly avatarUrl: string | null;
  readonly verified: boolean;
  readonly checkmarkColor?: string;
  readonly private: boolean;
}

export interface PromotableDestination extends PromotedDestinationIdentity {
  readonly available: boolean;
  readonly eligible: boolean;
  readonly ineligibleReason: string | null;
}

export interface CreativeProduct {
  readonly productId: string;
  readonly title: string;
  readonly price: Money;
  readonly compareAtPrice: Money | null;
  readonly rating: number | null;
}

export interface CreativeLiveStream {
  readonly liveSessionId: string;
  readonly status: "scheduled" | "live";
  readonly startsAt: string;
  readonly viewerCount: number;
}

export interface CreativeUtm {
  readonly source?: string;
  readonly medium?: string;
  readonly campaign?: string;
  readonly content?: string;
  readonly term?: string;
}

export interface CreativeDestination {
  readonly type: DestinationType;
  readonly targetId: string | null;
  readonly url: string | null;
  readonly utm?: CreativeUtm | null;
}

export interface CreativeCardInput {
  readonly mediaId: string;
  readonly headline: string;
  readonly description: string;
  readonly callToAction: CallToAction;
  readonly destination: CreativeDestination;
}

export interface CreativeCard {
  readonly media: CreativeMedia;
  readonly headline: string;
  readonly description: string;
  readonly callToAction: CallToAction;
  readonly destination: CreativeDestination;
}

export interface CreativeApp {
  readonly appName: string;
  readonly iconMediaId?: string;
  readonly iconUrl?: string;
  readonly rating: number | null;
  readonly iosStoreUrl: string;
  readonly androidStoreUrl: string;
  readonly webFallbackUrl: string;
  readonly iosDeepLink: string;
  readonly androidDeepLink: string;
}

export interface CreativeClickLinks {
  readonly media?: string;
  readonly cta?: string;
  readonly cards?: readonly string[];
}

export interface Creative {
  readonly format: CreativeFormat;
  readonly type: CreativeType;
  readonly mediaClickable: boolean;
  readonly cards?: readonly CreativeCard[];
  readonly app?: CreativeApp | null;
  readonly source: { readonly type: CreativeSourceType; readonly id: string };
  readonly media: readonly CreativeMedia[];
  readonly headline: string;
  readonly primaryText: string;
  readonly callToAction: CallToAction;
  readonly destination: CreativeDestination;
  readonly identity: CreativeIdentity;
  readonly product: CreativeProduct | null;
  readonly live?: CreativeLiveStream | null;
  readonly promoted?: PromotedDestinationIdentity | null;
}

export interface CreativeInput {
  readonly format: CreativeFormat;
  readonly type: CreativeType;
  readonly mediaClickable: boolean;
  readonly cards: readonly CreativeCardInput[];
  readonly app: CreativeApp | null;
  readonly source: { readonly type: CreativeSourceType; readonly id: string };
  readonly mediaIds: readonly string[];
  readonly headline: string;
  readonly primaryText: string;
  readonly callToAction: CallToAction;
  readonly destination: CreativeDestination;
}

export interface ContentSource {
  readonly id: string;
  readonly type: Exclude<CreativeSourceType, "upload">;
  readonly title: string;
  readonly text: string;
  readonly media: readonly CreativeMedia[];
  readonly createdAt: string;
  readonly engagement: { readonly likes: number; readonly comments: number; readonly views: number };
  readonly product: CreativeProduct | null;
  readonly live?: CreativeLiveStream | null;
  readonly eligible: boolean;
  readonly ineligibleReason: string | null;
}

export interface MediaUploadIntent {
  readonly mediaId: string;
  readonly uploadUrl: string;
  readonly uploadHeaders: Readonly<Record<string, string>>;
  readonly expiresAt: string;
}

export interface UploadedMedia {
  readonly mediaId: string;
  readonly status: "processing" | "ready" | "failed";
  readonly media: CreativeMedia | null;
}
