import type { UserSummary } from "../../../interfaces/identityDirectory.interface.js";
import type { MentionEntity } from "../../mentions/models/mention.model.js";

export type MessageKindName = "text" | "voice" | "image" | "video" | "system" | "shared" | "location" | "liveLocation" | "document" | "poll";

export interface MessageReactionSummary {
  readonly emoji: string;
  readonly count: number;
  readonly reactedByMe: boolean;
}

export interface MessageAttachedMedia {
  readonly id: string;
  readonly type: "voice" | "image" | "video";
  readonly url: string | null;
  readonly durationSeconds?: number;
}

export interface SharedLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly address: string | null;
  readonly liveUntil?: string | null;
  readonly updatedAt?: string;
}

export interface MessageDocument {
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly pageCount?: number | null;
  readonly url: string | null;
}

export interface MessagePollOptionView {
  readonly id: string;
  readonly text: string;
  readonly voteCount: number;
  readonly votedByMe: boolean;
}

export interface MessagePollView {
  readonly question: string;
  readonly allowMultipleAnswers: boolean;
  readonly options: readonly MessagePollOptionView[];
}

export interface SharedContentReference {
  readonly kind: "post" | "clip" | "story" | "product" | "live" | "store" | "profile";
  readonly id: string;
}

export interface SharedContentCard {
  readonly reference: SharedContentReference;
  readonly availability: "available" | "private" | "unavailable";
  readonly title: string | null;
  readonly subtitle: string | null;
  readonly imageUrl: string | null;
  readonly isLive: boolean;
  readonly followsAuthor: boolean | null;
  readonly priceLabel?: string | null;
  readonly stock?: number | null;
  readonly viewerCount?: number | null;
  readonly profileUserId: string | null;
}

export interface MessageView {
  readonly id: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly text: "";
  readonly createdAt: string;
  readonly kind: MessageKindName;
  readonly sender?: UserSummary;
  readonly media: MessageAttachedMedia | null;
  readonly reactions: readonly MessageReactionSummary[];
  readonly expiresAt: string | null;
  readonly mediaExpiresAt: string | null;
  readonly linkPreview: string | null;
  readonly sharedContent: SharedContentCard | null;
  readonly location: SharedLocation | null;
  readonly document: MessageDocument | null;
  readonly poll: MessagePollView | null;
  readonly readAt: string | null;
  readonly encryption: { readonly deviceId: string; readonly ciphertext: string | null; readonly protocol: string } | null;
  readonly mentions: readonly MentionEntity[];
  readonly clientMessageId: string | null;
}
