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
  readonly replies: number;
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
  readonly media: readonly Media[];
  readonly audience: PostAudience;
}

export interface NewStoryInput {
  readonly media: Media;
}
