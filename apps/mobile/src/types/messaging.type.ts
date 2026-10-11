import type { AttachmentPointer, ChatControl, ChatPoll, GroupAvatar } from "@zudomart/chat-crypto";

import type { ChatStreak, InboxFolder, LinkPreview, MessageEncryptionEnvelope, SharedContentReference } from "./chatSafety.type";
import type { MentionEntity } from "./mention.type";
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
  readonly description?: string | null;
  readonly encryptedAttributes?: string | null;
  readonly hasGroupKey?: boolean;
  readonly photoUrl?: string | null;
  readonly photoMediaId?: string | null;
  readonly groupAvatar?: GroupAvatar | null;
  readonly memberCount?: number;
  readonly subscriberCount?: number;
  readonly myRole?: "owner" | "admin" | "member" | "subscriber";
  readonly disappearingMessagesSeconds?: number | null;
  readonly onlyAdminsCanMentionAll?: boolean;
  readonly store?: { readonly id: ID; readonly name: string; readonly avatarUrl?: string | null } | null;
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

export interface SharedLocation {
  readonly latitude: number;
  readonly longitude: number;
  readonly address: string | null;
  readonly liveUntil?: ISODate | null;
  readonly updatedAt?: ISODate;
}

export interface MessageDocument {
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly pageCount?: number | null;
  readonly url: string | null;
}

export interface MessagePollOption {
  readonly id: ID;
  readonly text: string;
  readonly voteCount: number;
  readonly votedByMe: boolean;
}

export interface MessagePoll {
  readonly question: string;
  readonly allowMultipleAnswers: boolean;
  readonly options: readonly MessagePollOption[];
}

export interface Message {
  readonly id: ID;
  readonly conversationId: ID;
  readonly senderId: ID;
  readonly text: string;
  readonly createdAt: ISODate;
  readonly kind?: "text" | "voice" | "image" | "system" | "shared" | "location" | "liveLocation" | "document" | "poll" | "control";
  readonly sender?: UserSummary;
  readonly media?: MessageAttachedMedia | null;
  readonly reactions?: readonly MessageReactionSummary[];
  readonly expiresAt?: ISODate | null;
  readonly mediaExpiresAt?: ISODate | null;
  readonly linkPreview?: LinkPreview | null;
  readonly sharedReference?: SharedContentReference | null;
  readonly location?: SharedLocation | null;
  readonly document?: MessageDocument | null;
  readonly pollDefinition?: ChatPoll | null;
  readonly poll?: MessagePoll | null;
  readonly control?: ChatControl | null;
  readonly readAt?: ISODate | null;
  readonly encryption?: MessageEncryptionEnvelope | null;
  readonly mentions?: readonly MentionEntity[];
  readonly decryptionNotice?: string | null;
  readonly attachment?: AttachmentPointer | null;
}
