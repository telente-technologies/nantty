import type { ID, ISODate } from "./primitive.type";
import type { ProductSummary } from "./catalogModels.type";
import type { UserSummary, VerificationColor } from "./identityModels.type";
import type { MentionEntity } from "./mentions.type";
import type { LinkPreview } from "./linkPreview.type";
import type { ReplyPolicy, ReplyRestriction, SensitiveContent } from "./postAudience.type";
import type { SponsoredPlacement } from "./sponsoredPlacement.type";
import type { TaggedUser } from "./taggedUser.type";

export type MediaProcessingStatus = "processing" | "ready" | "failed";

export interface Media {
  readonly type: "image" | "video";
  readonly url: string | null;
  readonly id?: ID;
  readonly posterUrl?: string | null;
  readonly hlsUrl?: string | null;
  readonly width?: number;
  readonly height?: number;
  readonly durationSeconds?: number;
  readonly status?: MediaProcessingStatus;
  readonly blurhash?: string | null;
}

export interface Post {
  readonly id: ID;
  readonly kind: "post" | "clip";
  readonly author: UserSummary;
  readonly postedAs?: { readonly id: ID; readonly kind: string; readonly name: string; readonly handle: string; readonly avatarUrl: string | null } | null;
  readonly createdAt: ISODate;
  readonly text: string;
  readonly media: readonly Media[];
  readonly likes: number;
  readonly comments: number;
  readonly reposts: number;
  readonly reposted?: boolean;
  readonly views: number;
  readonly liked: boolean;
  readonly bookmarked: boolean;
  readonly saveCount?: number;
  readonly isFollowingAuthor: boolean;
  readonly friendsLiked: { readonly count: number; readonly avatars: readonly (string | null)[] } | null;
  readonly products: readonly ProductSummary[];
  readonly sponsored?: SponsoredPlacement | null;
  readonly subscriberOnly?: boolean;
  readonly viewerHasAccess?: boolean;
  readonly mentions?: readonly MentionEntity[];
  readonly linkPreview?: LinkPreview | null;
  readonly isQuote?: boolean;
  readonly quotes?: number;
  readonly resharedFrom?: Post | null;
  readonly resharedFromUnavailable?: boolean;
  readonly replyPolicy?: ReplyPolicy;
  readonly viewerCanReply?: boolean;
  readonly viewerCanDownload?: boolean;
  readonly replyRestriction?: ReplyRestriction | null;
  readonly sensitive?: SensitiveContent | null;
  readonly taggedUsers?: readonly TaggedUser[];
  readonly taggedUsersCount?: number;
  readonly isPinned?: boolean;
  readonly pinnedAt?: ISODate | null;
  readonly pinnedCommentId?: ID | null;
  readonly viewerNotificationsMuted?: boolean;
}

export interface PostAnalyticsDaily {
  readonly day: ISODate;
  readonly impressions: number;
}

export interface PostVideoAnalytics {
  readonly views: number;
  readonly watchTimeSeconds: number;
  readonly averageWatchSeconds?: number;
  readonly completedViews?: number;
  readonly completionRate?: number;
}

export interface PostAnalytics {
  readonly postId: ID;
  readonly kind?: "post" | "clip" | "story";
  readonly hasLink?: boolean;
  readonly author: UserSummary;
  readonly postedAt: ISODate;
  readonly impressions: number;
  readonly uniqueViewers: number;
  readonly likes: number;
  readonly comments: number;
  readonly reposts: number;
  readonly profileVisits: number;
  readonly saves: number;
  readonly shares: number;
  readonly linkClicks: number;
  readonly profileClicks: number;
  readonly newFollows: number;
  readonly engagements: number;
  readonly engagementRate: number;
  readonly video: PostVideoAnalytics | null;
  readonly audience: readonly { readonly label: string; readonly share: number }[];
  readonly daily: readonly PostAnalyticsDaily[];
}

export interface QuotedPostSummary {
  readonly id: ID;
  readonly kind: "post" | "clip";
  readonly author: UserSummary;
  readonly text: string;
  readonly thumbnail: { readonly type: "image" | "video"; readonly url: string; readonly blurhash: string | null } | null;
  readonly mediaCount: number;
  readonly createdAt: ISODate;
}

export interface CommentVideoReply {
  readonly clipId: ID;
  readonly thumbnailUrl: string | null;
  readonly createdAt: ISODate;
}

export interface Comment {
  readonly id: ID;
  readonly postId: ID;
  readonly parentCommentId: ID | null;
  readonly rootCommentId: ID | null;
  readonly author: UserSummary;
  readonly postedAs?: { readonly id: ID; readonly kind: string; readonly name: string; readonly handle: string; readonly avatarUrl: string | null; readonly checkmark?: VerificationColor | null } | null;
  readonly text: string;
  readonly createdAt: ISODate;
  readonly likes: number;
  readonly liked: boolean;
  readonly bookmarked?: boolean;
  readonly replyCount: number;
  readonly isPinned?: boolean;
  readonly pinnedAt?: ISODate | null;
  readonly replyingTo?: { readonly userId: ID; readonly username: string };
  readonly mentions?: readonly MentionEntity[];
  readonly isPostAuthor?: boolean;
  readonly quotedPost?: QuotedPostSummary | null;
  readonly quotedPostUnavailable?: boolean;
  readonly videoReplies?: readonly CommentVideoReply[];
  readonly videoReplyBlocked?: boolean;
}

export interface CommentHiddenState {
  readonly commentId: ID;
  readonly postId: ID;
  readonly hidden: boolean;
  readonly hiddenAt: ISODate | null;
}

export interface MyPostComment extends Comment {
  readonly previewReplies: readonly Comment[];
  readonly post: { readonly id: ID; readonly kind: string; readonly text: string; readonly thumbnailUrl: string | null };
  readonly hidden: boolean;
  readonly hiddenAt: ISODate | null;
  readonly needsReply: boolean;
}
