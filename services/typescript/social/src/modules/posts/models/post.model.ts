import type { UserSummary } from "../../../interfaces/identityDirectory.interface.js";
import type { SoundView } from "../../sounds/models/sound.model.js";
import type { MentionEntity } from "../../mentions/models/mention.model.js";
import type { LinkPreviewView } from "../../linkPreviews/models/linkPreview.model.js";
import type { ReplyRestrictionReason } from "../services/replyPolicy.service.js";
import type { SensitiveContentView } from "../services/sensitiveContent.service.js";
import type { RankingExplanation } from "../../../interfaces/feedRanker.interface.js";
import type { SponsoredPlacementView } from "../../../interfaces/adDecisions.interface.js";

export interface FeedRankingDisclosure {
  readonly explanations: readonly RankingExplanation[];
  readonly boostMultiplier: number;
}

export interface MediaView {
  readonly id: string;
  readonly type: "image" | "video";
  readonly url: string | null;
  readonly posterUrl: string | null;
  readonly hlsUrl: string | null;
  readonly width?: number;
  readonly height?: number;
  readonly durationSeconds?: number;
  readonly blurhash: string | null;
  readonly status: "processing" | "ready" | "failed";
  readonly trim?: MediaTrim;
}

export interface MediaTrim {
  readonly startMs: number;
  readonly endMs: number;
}

export interface ClipSlideshow {
  readonly durationsMs: readonly number[];
  readonly transition: "none" | "crossfade" | "slide";
}

export interface PostLocationTag {
  readonly placeId: string;
  readonly name: string;
  readonly area?: string | null;
}

export const CLIP_LOOKS = ["warm", "cool", "rose", "aqua", "sunset"] as const;

export type ClipLook = (typeof CLIP_LOOKS)[number];

export interface PostClipEdit {
  readonly trims?: Readonly<Record<string, MediaTrim>>;
  readonly slideshow?: ClipSlideshow;
  readonly look?: ClipLook;
}

export interface TaggedProductView {
  readonly id: string;
  readonly name: string;
  readonly price: { readonly amountMinor: number; readonly currency: string };
  readonly imageUrl: string | null;
  readonly stock: number;
}

export interface FriendsLikedView {
  readonly count: number;
  readonly avatars: readonly (string | null)[];
}

export interface StickerLayout {
  readonly x: number;
  readonly y: number;
  readonly scale: number;
  readonly rotation: number;
  readonly hidden?: boolean;
}

export interface ReplyToComment {
  readonly commentId: string;
  readonly clipId: string;
  readonly commenterUserId: string;
}

export interface TaggedUserView {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly avatarUrl: string | null;
  readonly checkmark: "blue" | "gold" | "black" | null;
  readonly isFollowing?: boolean;
}

export interface PostedAsView {
  readonly id: string;
  readonly kind: string;
  readonly name: string;
  readonly handle: string;
  readonly avatarUrl: string | null;
}

export interface PostView {
  readonly id: string;
  readonly kind: "post" | "clip";
  readonly author: UserSummary;
  readonly postedAs: PostedAsView | null;
  readonly createdAt: string;
  readonly text: string;
  readonly media: readonly MediaView[];
  readonly likes: number;
  readonly comments: number;
  readonly reposts: number;
  readonly views: number;
  readonly liked: boolean;
  readonly bookmarked: boolean;
  readonly isSaved: boolean;
  readonly saveCount: number;
  readonly isFollowingAuthor: boolean;
  readonly shares: number;
  readonly durationSeconds: number | null;
  readonly friendsLiked: FriendsLikedView | null;
  readonly products: readonly TaggedProductView[];
  readonly sponsored: SponsoredPlacementView | null;
  readonly topics: readonly string[];
  readonly location: PostLocationTag | null;
  readonly slideshow: ClipSlideshow | null;
  readonly look: ClipLook | null;
  readonly subscriberOnly: boolean;
  readonly viewerHasAccess: boolean;
  readonly resharedFrom: PostView | null;
  readonly resharedFromUnavailable: boolean;
  readonly isQuote: boolean;
  readonly quotes: number;
  readonly replyPolicy: "everyone" | "following" | "followers" | "mentioned" | "off";
  readonly viewerCanReply: boolean;
  readonly viewerCanDownload: boolean;
  readonly replyRestriction: { readonly reason: ReplyRestrictionReason; readonly message: string } | null;
  readonly sensitive: SensitiveContentView | null;
  readonly isAiGenerated: boolean;
  readonly isPinned: boolean;
  readonly pinnedAt: string | null;
  readonly pinnedCommentId: string | null;
  readonly viewerNotificationsMuted: boolean;
  readonly sound?: SoundView;
  readonly mentions: readonly MentionEntity[];
  readonly linkPreview: LinkPreviewView | null;
  readonly taggedUsers: readonly TaggedUserView[];
  readonly taggedUsersCount: number;
  readonly replyToComment?: ReplyToComment;
  readonly stickerLayout?: StickerLayout;
  readonly ranking?: FeedRankingDisclosure;
}

export interface QuotedPostThumbnail {
  readonly type: "image" | "video";
  readonly url: string;
  readonly blurhash: string | null;
}

export interface QuotedPostSummary {
  readonly id: string;
  readonly kind: "post" | "clip";
  readonly author: UserSummary;
  readonly text: string;
  readonly thumbnail: QuotedPostThumbnail | null;
  readonly mediaCount: number;
  readonly createdAt: string;
}

export interface StoryView {
  readonly id: string;
  readonly author: UserSummary;
  readonly media: MediaView;
  readonly createdAt: string;
  readonly seen: boolean;
  readonly sound: SoundView | null;
  readonly look: ClipLook | null;
}
