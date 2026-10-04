import type { UserSummary } from "../../../interfaces/identityDirectory.interface.js";
import type { SoundView } from "../../sounds/models/sound.model.js";
import type { MentionEntity } from "../../mentions/models/mention.model.js";
import type { LinkPreviewView } from "../../linkPreviews/models/linkPreview.model.js";
import type { ReplyRestrictionReason } from "../services/replyPolicy.service.js";
import type { SensitiveContentView } from "../services/sensitiveContent.service.js";

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

export interface PostView {
  readonly id: string;
  readonly kind: "post" | "clip";
  readonly author: UserSummary;
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
  readonly friendsLiked: null;
  readonly products: readonly never[];
  readonly sponsored: null;
  readonly subscriberOnly: boolean;
  readonly viewerHasAccess: boolean;
  readonly resharedFrom: PostView | null;
  readonly resharedFromUnavailable: boolean;
  readonly isQuote: boolean;
  readonly quotes: number;
  readonly replyPolicy: "everyone" | "following" | "followers" | "mentioned" | "off";
  readonly viewerCanReply: boolean;
  readonly replyRestriction: { readonly reason: ReplyRestrictionReason; readonly message: string } | null;
  readonly sensitive: SensitiveContentView | null;
  readonly isAiGenerated: boolean;
  readonly sound?: SoundView;
  readonly mentions: readonly MentionEntity[];
  readonly linkPreview: LinkPreviewView | null;
  readonly replyToComment?: ReplyToComment;
  readonly stickerLayout?: StickerLayout;
}

export interface StoryView {
  readonly id: string;
  readonly author: UserSummary;
  readonly media: MediaView;
  readonly createdAt: string;
  readonly seen: boolean;
}
