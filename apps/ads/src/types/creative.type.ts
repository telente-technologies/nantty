import type { Money } from "@/types/money.type";

export type CreativeFormat = "feed_post" | "clip" | "product" | "store" | "story";
export type CreativeSourceType = "post" | "clip" | "product" | "store" | "upload";
export type CallToAction = "shop_now" | "learn_more" | "visit_store" | "send_message" | "follow" | "watch_more" | "order_now" | "sign_up";
export type DestinationType = "post" | "profile" | "store" | "product" | "messages" | "url";

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

export interface CreativeProduct {
  readonly productId: string;
  readonly title: string;
  readonly price: Money;
  readonly compareAtPrice: Money | null;
  readonly rating: number | null;
}

export interface CreativeDestination {
  readonly type: DestinationType;
  readonly targetId: string | null;
  readonly url: string | null;
}

export interface Creative {
  readonly format: CreativeFormat;
  readonly source: { readonly type: CreativeSourceType; readonly id: string };
  readonly media: readonly CreativeMedia[];
  readonly headline: string;
  readonly primaryText: string;
  readonly callToAction: CallToAction;
  readonly destination: CreativeDestination;
  readonly identity: CreativeIdentity;
  readonly product: CreativeProduct | null;
}

export interface CreativeInput {
  readonly format: CreativeFormat;
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
  readonly eligible: boolean;
  readonly ineligibleReason: string | null;
}

export interface UploadSession {
  readonly uploadId: string;
  readonly chunkSizeBytes: number;
  readonly totalChunks: number;
  readonly uploadedChunks: readonly number[];
}

export interface UploadedMedia {
  readonly mediaId: string;
  readonly status: "processing" | "ready" | "failed";
  readonly media: CreativeMedia | null;
}
