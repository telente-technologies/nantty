import type { ChatStreak, InboxFolder, LinkPreview, MessageEncryptionEnvelope, SharedContentCard } from "./chatSafety.type";
import type { ID, ISODate, UserSummary } from "./models.type";

export interface Conversation {
  readonly id: ID;
  readonly peer: UserSummary;
  readonly lastMessage: string;
  readonly lastMessageAt: ISODate;
  readonly unread: number;
  readonly isFriend: boolean;
  readonly kind?: "direct" | "group" | "channel" | "business";
  readonly title?: string | null;
  readonly photoUrl?: string | null;
  readonly memberCount?: number;
  readonly subscriberCount?: number;
  readonly myRole?: "owner" | "admin" | "member" | "subscriber";
  readonly disappearingMessagesSeconds?: number | null;
  readonly store?: { readonly id: ID; readonly name: string } | null;
  readonly inboxFolder?: InboxFolder;
  readonly spamReason?: string | null;
  readonly streak?: ChatStreak | null;
  readonly mutedUntil?: ISODate | "always" | null;
}

export interface MessageReactionSummary {
  readonly emoji: string;
  readonly count: number;
  readonly reactedByMe: boolean;
}

export interface MessageAttachedMedia {
  readonly id: ID;
  readonly type: "voice" | "image" | "video";
  readonly url: string | null;
  readonly durationSeconds?: number;
}

export interface Message {
  readonly id: ID;
  readonly conversationId: ID;
  readonly senderId: ID;
  readonly text: string;
  readonly createdAt: ISODate;
  readonly kind?: "text" | "voice" | "image" | "system" | "shared";
  readonly sender?: UserSummary;
  readonly media?: MessageAttachedMedia | null;
  readonly reactions?: readonly MessageReactionSummary[];
  readonly expiresAt?: ISODate | null;
  readonly mediaExpiresAt?: ISODate | null;
  readonly linkPreview?: LinkPreview | null;
  readonly sharedContent?: SharedContentCard | null;
  readonly readAt?: ISODate | null;
  readonly encryption?: MessageEncryptionEnvelope | null;
}
