import type { Comment, ID, LiveSession, Media, Post, UserSummary } from "./models.type";

export type ConversationFilter = "all" | "direct";
export type ClipsFeedTab = "forYou" | "following";
export type CreateMode = "story" | "post" | "product" | "live";
export type PostAudience = "everyone" | "followers";

export interface StoryTrayItem {
  readonly user: UserSummary;
  readonly hasUnseen: boolean;
}

export interface ChatSearchResults {
  readonly conversations: readonly { readonly id: ID; readonly peer: UserSummary; readonly snippet: string }[];
  readonly people: readonly UserSummary[];
}

export interface Clip extends Post {
  readonly durationSeconds: number;
  readonly sound: string;
}

export interface CommentWithReplies extends Comment {
  readonly previewReplies: readonly Comment[];
}

export interface NewCommentInput {
  readonly text: string;
  readonly parentCommentId?: ID;
}

export interface LiveSessionDetails extends LiveSession {
  readonly isFollowingHost: boolean;
  readonly startedAt: string;
}

export interface SuggestedLive {
  readonly id: ID;
  readonly host: UserSummary;
  readonly title: string;
  readonly coverUrl: string | null;
}

export interface NewPostInput {
  readonly text: string;
  readonly mediaIds: readonly ID[];
  readonly audience: PostAudience;
}

export type MediaUploadPurpose = "post" | "clip" | "story" | "avatar" | "banner" | "product" | "chat";
export type MediaUploadStatus = "uploading" | "processing" | "ready" | "failed";
export type MediaVariantFormat = "avif" | "webp" | "jpeg" | "mp4" | "hls";

export interface MediaVariant {
  readonly url: string;
  readonly width: number;
  readonly height: number;
  readonly format: MediaVariantFormat;
  readonly bitrateKbps?: number;
}

export interface MediaAsset {
  readonly id: ID;
  readonly type: "image" | "video";
  readonly status: "processing" | "ready" | "failed";
  readonly width: number;
  readonly height: number;
  readonly durationSeconds?: number;
  readonly blurhash?: string;
  readonly posterUrl?: string;
  readonly hlsUrl?: string;
  readonly variants: readonly MediaVariant[];
}

export interface CreateUploadSessionRequest {
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly purpose: MediaUploadPurpose;
  readonly sha256?: string;
}

export interface UploadSession {
  readonly uploadId: ID;
  readonly chunkSizeBytes: number;
  readonly totalChunks: number;
  readonly uploadedChunks: readonly number[];
}

export interface UploadSessionStatus {
  readonly status: MediaUploadStatus;
  readonly uploadedChunks: readonly number[];
  readonly media?: MediaAsset;
}

export interface CompletedUpload {
  readonly mediaId: ID;
  readonly status: "processing";
}

export type AdPlacement = "feed" | "clips" | "mart" | "search";
export type AdEventType = "impression" | "click";

export interface AdEvent {
  readonly campaignId: ID;
  readonly placement: AdPlacement;
  readonly type: AdEventType;
  readonly itemId: ID;
}

export interface NewStoryInput {
  readonly mediaId: ID;
  readonly media: Media;
}

export type CreatorProgramStatus = "none" | "pending" | "approved" | "rejected" | "suspended";

export interface CreatorStatus {
  readonly status: CreatorProgramStatus;
  readonly canGoLive: boolean;
  readonly tier?: string;
}

export interface LiveGift {
  readonly id: ID;
  readonly name: string;
  readonly emoji: string;
  readonly imageUrl?: string | null;
  readonly price: import("./money.type").Money;
}

export interface SendLiveGiftInput {
  readonly giftId: ID;
  readonly quantity: number;
}

export interface SentLiveGiftReceipt {
  readonly giftId: ID;
  readonly quantity: number;
  readonly walletAvailable: import("./money.type").Money;
}

export interface LiveSessionDetails {
  readonly giftsEnabled?: boolean;
  readonly hostIsCreator?: boolean;
  readonly pinnedProductId?: ID | null;
}
