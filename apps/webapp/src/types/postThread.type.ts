import type { AdAppInstall, AdClickLinks, AdCreativeType, AdDestination } from "./adCreative.type";
import type { Comment, ID, Media } from "./models.type";

export type ThreadSort = "relevant" | "latest" | "likes";

export const THREAD_SORT_LABELS: Record<ThreadSort, string> = { relevant: "Relevant", latest: "Latest", likes: "Most liked" };

export const THREAD_SORT_OPTIONS: readonly ThreadSort[] = ["relevant", "latest", "likes"];

export interface ThreadConnector {
  readonly depth: number;
  readonly hasParentAbove: boolean;
  readonly hasChildBelow: boolean;
  readonly isLastInChain: boolean;
}

export interface ThreadReply extends Comment {
  readonly media?: readonly Media[];
  readonly isPostAuthor: boolean;
  readonly connector: ThreadConnector;
  readonly inlineReplies: readonly ThreadReply[];
  readonly hasMoreReplies?: boolean;
  readonly continuesInThread?: boolean;
}

export const THREAD_AD_SLOT_KIND = "feedCommentThread" as const;

export interface ThreadAdCreativeMedia {
  readonly id: ID;
  readonly kind: "image" | "video";
  readonly url: string;
  readonly posterUrl: string | null;
  readonly width: number;
  readonly height: number;
}

export interface ThreadAdCard {
  readonly media: ThreadAdCreativeMedia;
  readonly headline: string;
  readonly description?: string;
  readonly callToAction?: string;
  readonly destination: AdDestination;
}

export interface ThreadAdCreative {
  readonly type?: AdCreativeType;
  readonly mediaClickable?: boolean;
  readonly cards?: readonly ThreadAdCard[];
  readonly app?: AdAppInstall | null;
  readonly format: "feed_post" | "product";
  readonly media: readonly ThreadAdCreativeMedia[];
  readonly headline: string;
  readonly primaryText: string;
  readonly callToAction: string;
  readonly destination: AdDestination;
  readonly identity: { readonly name: string; readonly handle: string; readonly avatarUrl: string | null; readonly verifiedBusiness: boolean };
}

export interface ThreadDecidedAd {
  readonly adId: ID;
  readonly impressionToken: string;
  readonly expiresAt: string;
  readonly placement: "feed";
  readonly slotKind: typeof THREAD_AD_SLOT_KIND;
  readonly format: ThreadAdCreative["format"];
  readonly label: "Promoted";
  readonly clickLinks?: AdClickLinks;
  readonly creative: ThreadAdCreative;
}

export interface ThreadAdDecision {
  readonly ad: ThreadDecidedAd | null;
  readonly declinedReason?: string;
}

export type ThreadRow =
  | { readonly kind: "reply"; readonly key: string; readonly reply: ThreadReply }
  | { readonly kind: "sponsored"; readonly key: string; readonly ad: ThreadDecidedAd };

export interface CommentThreadPage {
  readonly data: readonly ThreadReply[];
  readonly nextCursor: string | null;
  readonly focus: Comment;
  readonly ancestors: readonly Comment[];
  readonly maximumVisibleDepth: number;
}
