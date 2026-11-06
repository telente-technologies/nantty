import type { ClipMediaInput, ClipSlideshowInput, PostLocationTag } from "./clipCreate.type";
import type { LiveGiftSentEvent } from "./liveGift.type";
import type { LiveSafetyRealtimeEvent, LiveSafetyState } from "./liveSafety.type";
import type { Comment, CommentStickerLayout, Conversation, ID, LiveSession, Media, Message, Post, ReplyToComment, UserSummary } from "./models.type";
import type { Money } from "./money.type";
import type { MentionEntity } from "./mention.type";
import type { ReplyPolicy, SensitiveLabel } from "./postAudience.type";
import type { LiveAdSettings } from "./socialGraph.type";

export type ConversationFilter = "all" | "direct";
export type ClipsFeedTab = "forYou" | "following";
export type CreateMode = "story" | "post" | "clip" | "product" | "live" | "space";
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
  readonly type?: "comment";
  readonly previewReplies: readonly Comment[];
}

export interface NewCommentInput {
  readonly text: string;
  readonly parentCommentId?: ID;
  readonly asProfileId?: ID;
  readonly mentions?: readonly MentionEntity[];
  readonly quotedPostId?: ID | null;
}

export type LiveSource = "camera" | "screen" | "external";
export type LiveCategory = "justChatting" | "gaming" | "music" | "irl" | "education" | "shopping";

export interface LiveSessionDetails extends LiveSession {
  readonly category?: LiveCategory;
  readonly isFollowingHost: boolean;
  readonly startedAt: string;
  readonly ingestUrl?: string | null;
  readonly streamKey?: string | null;
  readonly liveAdSettings?: LiveAdSettings | null;
  readonly acceptedLiveAdTermsVersion?: string | null;
  readonly sponsorshipLine?: string | null;
  readonly hostRanking?: LiveHostRanking | null;
}

export interface LiveHostRanking {
  readonly globalRank: number;
  readonly categoryRank: number | null;
  readonly category: LiveCategory | null;
  readonly period: "day" | "week" | "month" | "all";
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
  readonly kind?: "post" | "clip";
  readonly asProfileId?: ID;
  readonly soundId?: ID;
  readonly look?: string;
  readonly isAiGenerated?: boolean;
  readonly mentions?: readonly MentionEntity[];
  readonly replyToComment?: ReplyToComment;
  readonly stickerLayout?: CommentStickerLayout;
  readonly replyPolicy?: ReplyPolicy;
  readonly sensitiveLabels?: readonly SensitiveLabel[];
  readonly media?: readonly ClipMediaInput[];
  readonly slideshow?: ClipSlideshowInput;
  readonly location?: PostLocationTag;
  readonly taggedUserIds?: readonly ID[];
  readonly quotedPostId?: ID | null;
  readonly scheduledAt?: string;
}

export interface ScheduledPostSummary {
  readonly id: ID;
  readonly text: string;
  readonly createdAt: string;
  readonly scheduledAt: string | null;
  readonly status: "scheduled" | "failed";
  readonly failureReason: "media_failed" | "media_processing_timeout" | "author_unavailable" | "profile_unavailable" | null;
  readonly media: readonly { readonly id: ID; readonly type: "image" | "video"; readonly status: "processing" | "ready" | "failed"; readonly posterUrl: string | null }[];
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
  readonly soundId?: ID;
  readonly look?: string;
}

export interface StoryAdCreativeMedia {
  readonly id: ID;
  readonly kind: "image" | "video";
  readonly url: string;
  readonly posterUrl?: string | null;
  readonly width?: number | null;
  readonly height?: number | null;
  readonly durationSeconds?: number | null;
}

export interface StoryDecidedAd {
  readonly adId: ID;
  readonly impressionToken: string;
  readonly expiresAt: string;
  readonly placement: "stories";
  readonly slotKind: "story";
  readonly format: string;
  readonly label: "Sponsored" | "Ad";
  readonly skipAfterSeconds?: number | null;
  readonly creative: {
    readonly media: readonly StoryAdCreativeMedia[];
    readonly headline: string;
    readonly primaryText: string;
    readonly callToAction: string;
    readonly destination: import("./adCreative.type").AdDestination;
    readonly identity: { readonly name: string; readonly handle: string; readonly avatarUrl: string | null };
  };
}

export interface StoryAdDecision {
  readonly ad: StoryDecidedAd | null;
  readonly declinedReason?: string;
}

export type CreatorProgramStatus = "none" | "pending" | "approved" | "rejected" | "suspended";

export interface CreatorStatus {
  readonly status: CreatorProgramStatus;
  readonly canGoLive: boolean;
  readonly tier?: string;
}

export interface LiveSessionDetails {
  readonly access?: { readonly allowed: boolean; readonly reason: string };
  readonly safety?: LiveSafetyState | null;
  readonly coverUrl?: string | null;
  readonly playbackUrl?: string | null;
  readonly giftsEnabled?: boolean;
  readonly hostIsCreator?: boolean;
  readonly pinnedProductId?: ID | null;
  readonly storeId?: ID | null;
}

export interface CoinBalance {
  readonly coins: number;
  readonly earnedCoins?: number;
}

export interface CoinConversionReceipt {
  readonly coins: number;
  readonly cash: Money;
  readonly earnedCoinsRemaining: number;
  readonly minimumPayout: Money;
}

export interface CoinActivityEntry {
  readonly id: ID;
  readonly transactionId: ID;
  readonly type: "credit" | "debit";
  readonly coins: number;
  readonly balanceAfter: number;
  readonly createdAt: string;
}

export interface CoinPackage {
  readonly id: ID;
  readonly coins: number;
  readonly bonusCoins?: number;
  readonly price: Money;
  readonly purchaseChannel?: CoinPurchaseChannel;
  readonly storeProductId?: string | null;
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

export type TipTargetType = "post" | "clip" | "live" | "profile";

export interface SendTipInput {
  readonly targetType: TipTargetType;
  readonly targetId: ID;
  readonly coins: number;
  readonly note?: string;
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
  readonly description?: string | null;
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
  readonly onlyAdminsCanMentionAll?: boolean;
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
  | LiveGiftSentEvent
  | LiveSafetyRealtimeEvent
  | { readonly type: "pong" };

export interface UpdateSoundInput {
  readonly title?: string;
  readonly allowReuse?: boolean;
}

export type CopyrightClaimTargetType = "clip" | "sound" | "post" | "live";

export type CopyrightClaimScope = "audio" | "video";

export interface CopyrightInfringingSegment {
  readonly startSeconds: number;
  readonly endSeconds: number;
}

export interface CopyrightClaimInput {
  readonly targetType: CopyrightClaimTargetType;
  readonly targetId: ID;
  readonly claimScope: CopyrightClaimScope;
  readonly claimantName: string;
  readonly organization?: string;
  readonly representativeOf?: string;
  readonly claimantPhone?: string;
  readonly workDescription: string;
  readonly ownershipStatement: string;
  readonly contactEmail: string;
  readonly originalWorkUrl?: string;
  readonly originalWorkMediaId?: ID;
  readonly proofUrls: readonly string[];
  readonly proofMediaIds?: readonly ID[];
  readonly segments: readonly CopyrightInfringingSegment[];
  readonly goodFaith: true;
  readonly accuracyDeclared: true;
  readonly signatureName: string;
}

export interface CopyrightClaimReceipt {
  readonly claimId: ID;
  readonly status: "received";
}

export * from "./mediaUpload.type";
