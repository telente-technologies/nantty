import type { Comment, Conversation, ID, LiveSession, Media, Message, MessageReactionSummary, Post, UserSummary } from "./models.type";
import type { LiveSafetyState } from "./liveSafety.type";

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

export type ClipSoundStatus = "available" | "under_copyright_review" | "removed";

export interface ClipSound {
  readonly id: ID;
  readonly title: string;
  readonly owner: UserSummary;
  readonly isOriginal: boolean;
  readonly allowReuse: boolean;
  readonly status: ClipSoundStatus;
  readonly usageCount: number;
  readonly audioUrl?: string | null;
  readonly coverUrl?: string | null;
  readonly sourceClipId?: ID | null;
  readonly savedByViewer?: boolean;
}

export interface Clip extends Post {
  readonly durationSeconds: number;
  readonly shares: number;
  readonly sound: ClipSound;
  readonly promotedLive?: { readonly liveSessionId: ID; readonly title: string; readonly viewers: number } | null;
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
  readonly soundId?: ID;
}

export type MediaUploadPurpose =
  | "post"
  | "clip"
  | "story"
  | "avatar"
  | "banner"
  | "product"
  | "chat"
  | "voice"
  | "dispute_evidence"
  | "identity_document"
  | "verification_document";
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
  readonly type: "image" | "video" | "audio";
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
  readonly mediaId?: ID;
  readonly mode?: "single" | "multipart";
  readonly partSizeBytes?: number;
  readonly partCount?: number;
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

export type AdPlacement = "feed" | "clips" | "stories" | "mart" | "search" | "live_discovery" | "live" | "feedCommentThread";
export type AdEventType = "impression" | "click" | "card_view";

export interface AdEvent {
  readonly campaignId: ID;
  readonly placement: AdPlacement;
  readonly type: AdEventType;
  readonly itemId: ID;
  readonly token?: string;
  readonly cardIndex?: number;
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
  readonly emoji?: string;
  readonly imageUrl?: string | null;
  readonly priceCoins: number;
}

export interface SendLiveGiftInput {
  readonly giftId: ID;
  readonly quantity: number;
}

export interface SentLiveGiftReceipt {
  readonly giftId: ID;
  readonly quantity: number;
  readonly coinBalance: number;
}

export interface LiveSessionDetails {
  readonly safety?: LiveSafetyState | null;
  readonly coverUrl?: string | null;
  readonly playbackUrl?: string | null;
  readonly giftsEnabled?: boolean;
  readonly hostIsCreator?: boolean;
  readonly pinnedProductId?: ID | null;
}

export interface CoinBalance {
  readonly coins: number;
}

export interface CoinPackage {
  readonly id: ID;
  readonly coins: number;
  readonly bonusCoins?: number;
  readonly price: import("./money.type").Money;
}

export type CoinPurchaseChannel = "web_checkout" | "store_iap";

export interface StartedCoinPurchase {
  readonly reference: string;
  readonly purchaseChannel: CoinPurchaseChannel;
  readonly authorizationUrl?: string;
}

export interface VerifiedCoinPurchase {
  readonly status: "succeeded" | "pending" | "failed";
  readonly coins: number;
}

export interface CoinTransferQuote {
  readonly feeCoins: number;
  readonly netCoins: number;
  readonly feePercent: number;
}

export interface CoinTransferReceipt {
  readonly transferId: ID;
  readonly feeCoins: number;
  readonly netCoins: number;
  readonly balance: number;
}

export type TipTargetType = "post" | "clip" | "live";

export interface SendTipInput {
  readonly targetType: TipTargetType;
  readonly targetId: ID;
  readonly coins: number;
}

export interface TipReceipt {
  readonly tipId: ID;
  readonly coins: number;
  readonly balance: number;
}

export type ConversationMemberRole = "owner" | "admin" | "member";

export interface ConversationMember {
  readonly user: UserSummary;
  readonly role: ConversationMemberRole;
}

export interface GroupConversationDetails {
  readonly conversation: Conversation;
  readonly members: readonly ConversationMember[];
}

export interface NewGroupConversationInput {
  readonly name: string;
  readonly photoMediaId?: ID;
  readonly memberIds: readonly ID[];
}

export interface NewChannelInput {
  readonly name: string;
  readonly description?: string;
  readonly photoMediaId?: ID;
}

export interface ConversationSettingsUpdate {
  readonly name?: string;
  readonly photoMediaId?: ID;
  readonly disappearingMessagesSeconds?: number | null;
}

export interface OutgoingVoiceNote {
  readonly kind: "voice";
  readonly mediaId: ID;
  readonly durationSeconds: number;
}

export type RealtimeServerEvent =
  | { readonly type: "message.created"; readonly message: Message }
  | { readonly type: "message.updated"; readonly message: Message }
  | { readonly type: "conversation.updated"; readonly conversation: Conversation }
  | { readonly type: "typing"; readonly conversationId: ID; readonly user: UserSummary; readonly isTyping: boolean }
  | {
      readonly type: "reaction";
      readonly conversationId: ID;
      readonly messageId: ID;
      readonly reactions: readonly MessageReactionSummary[];
    }
  | { readonly type: "pong" };

export interface UpdateSoundInput {
  readonly title?: string;
  readonly allowReuse?: boolean;
}
