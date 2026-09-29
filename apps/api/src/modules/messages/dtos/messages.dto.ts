import type { UserSummary } from "../../../interfaces/userDirectory.interface.js";
import type { ConversationKind, MessageKind, MessageMediaItem, ParticipantRole } from "../models/messages.model.js";

export interface MessageReactionSummaryDto {
  readonly emoji: string;
  readonly count: number;
  readonly reactedByMe: boolean;
}

export interface MessageAttachedMediaDto {
  readonly id: string;
  readonly type: "voice" | "image" | "video";
  readonly url: string | null;
  readonly durationSeconds?: number;
}

export interface StoreIdentityDto {
  readonly id: string;
  readonly name: string;
  readonly logoUrl: string | null;
}

export interface MessageDto {
  readonly id: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly text: string;
  readonly createdAt: string;
  readonly kind: MessageKind;
  readonly sender: UserSummary | null;
  readonly senderStore: StoreIdentityDto | null;
  readonly media: MessageAttachedMediaDto | null;
  readonly attachments: readonly MessageMediaItem[];
  readonly reactions: readonly MessageReactionSummaryDto[];
  readonly expiresAt: string | null;
}

export interface FriendshipDto {
  readonly following: boolean;
  readonly followedBy: boolean;
  readonly areFriends: boolean;
}

export type ViewerConversationRole = Exclude<ParticipantRole, "customer"> | "member";

export interface ConversationDto {
  readonly id: string;
  readonly kind: ConversationKind;
  readonly peer: UserSummary | null;
  readonly lastMessage: string;
  readonly lastMessageAt: string;
  readonly unread: number;
  readonly isFriend: boolean;
  readonly title: string | null;
  readonly description: string;
  readonly photoUrl: string | null;
  readonly memberCount: number;
  readonly subscriberCount: number;
  readonly myRole: ViewerConversationRole;
  readonly disappearingMessagesSeconds: number | null;
  readonly store: StoreIdentityDto | null;
  readonly otherParticipant: UserSummary | null;
  readonly unreadCount: number;
  readonly friendship: FriendshipDto;
  readonly latestMessage: MessageDto | null;
}

export interface ConversationMemberDto {
  readonly user: UserSummary;
  readonly role: ViewerConversationRole;
}

export interface MessageSearchResultDto {
  readonly conversations: readonly { readonly id: string; readonly peer: UserSummary | null; readonly snippet: string }[];
  readonly messages: readonly MessageDto[];
  readonly people: readonly UserSummary[];
}

export function describeMessagePreview(kind: MessageKind, text: string): string {
  if (kind === "voice") return "Voice note";
  return text;
}
