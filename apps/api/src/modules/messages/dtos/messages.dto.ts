import type { UserSummary } from "../../../interfaces/userDirectory.interface.js";
import type { MessageMediaItem, MessageRecord } from "../models/messages.model.js";

export interface MessageDto {
  readonly id: string;
  readonly conversationId: string;
  readonly senderId: string;
  readonly text: string;
  readonly media: readonly MessageMediaItem[];
  readonly createdAt: string;
}

export interface FriendshipDto {
  readonly following: boolean;
  readonly followedBy: boolean;
  readonly areFriends: boolean;
}

export interface ConversationSummaryDto {
  readonly id: string;
  readonly kind: "direct";
  readonly otherParticipant: UserSummary | null;
  readonly lastMessage: MessageDto | null;
  readonly unreadCount: number;
  readonly friendship: FriendshipDto;
  readonly lastMessageAt: string;
}

export interface MessageSearchResultDto {
  readonly messages: readonly MessageDto[];
  readonly people: readonly UserSummary[];
}

export function convertMessageToDto(message: MessageRecord): MessageDto {
  return {
    id: message.id,
    conversationId: message.conversationId,
    senderId: message.senderId,
    text: message.text,
    media: message.media,
    createdAt: message.createdAt.toISOString(),
  };
}
