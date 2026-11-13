import type { AttachmentPointer, ChatControl, ChatLinkPreview, ChatLocation, ChatPoll, LiveLocationState, PollOptionTally } from "@nantty/chat-crypto";

import type { InboxFolder, SharedContentReference } from "./chatSafety.type";
import type { ID, ISODate } from "./primitive.type";
import type { UserSummary } from "./identityModels.type";

export interface Conversation {
  readonly id: ID;
  readonly peer: UserSummary;
  readonly lastMessage: string;
  readonly lastMessageAt: ISODate;
  readonly unread: number;
  readonly isFriend: boolean;
  readonly kind?: "direct" | "group" | "channel" | "business";
  readonly title?: string | null;
  readonly description?: string | null;
  readonly encryptedAttributes?: string | null;
  readonly photoUrl?: string | null;
  readonly photoMediaId?: ID | null;
  readonly memberCount?: number;
  readonly onlyAdminsCanMentionAll?: boolean;
  readonly mutedUntil?: string | null;
  readonly subscriberCount?: number;
  readonly myRole?: "owner" | "admin" | "member" | "subscriber";
  readonly disappearingMessagesSeconds?: number | null;
  readonly store?: { readonly id: ID; readonly name: string; readonly avatarUrl?: string | null } | null;
  readonly inboxFolder?: InboxFolder;
  readonly spamReason?: string | null;
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

export interface MessageEncryptionEnvelope {
  readonly deviceId: string;
  readonly ciphertext: string | null;
  readonly protocol: string;
}

export interface Message {
  readonly id: ID;
  readonly conversationId: ID;
  readonly senderId: ID;
  readonly text: string;
  readonly createdAt: ISODate;
  readonly kind?: "text" | "voice" | "image" | "video" | "system" | "shared" | "location" | "liveLocation" | "document" | "poll" | "control";
  readonly sender?: UserSummary;
  readonly media?: MessageAttachedMedia | null;
  readonly reactions?: readonly MessageReactionSummary[];
  readonly expiresAt?: ISODate | null;
  readonly encryption?: MessageEncryptionEnvelope | null;
  readonly linkPreview?: ChatLinkPreview | null;
  readonly sharedReference?: SharedContentReference | null;
  readonly attachment?: AttachmentPointer | null;
  readonly document?: { readonly url: string | null } | null;
  readonly location?: ChatLocation | null;
  readonly liveLocation?: LiveLocationState | null;
  readonly poll?: ChatPoll | null;
  readonly pollTally?: readonly PollOptionTally[];
  readonly control?: ChatControl | null;
  readonly decryptionNotice?: string | null;
  readonly clientMessageId?: string | null;
  readonly deliveryState?: "pending" | "failed";
  readonly pendingLabel?: string | null;
}
