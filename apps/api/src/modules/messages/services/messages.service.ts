import type { EventBus } from "@zudojs/events";

import { notFound } from "../../../errors/domain.error.js";
import type { Clock } from "../../../interfaces/clock.interface.js";
import type { SocialGraph } from "../../../interfaces/socialGraph.interface.js";
import type { UserDirectory, UserSummary } from "../../../interfaces/userDirectory.interface.js";
import { convertMessageToDto, type ConversationSummaryDto, type FriendshipDto } from "../dtos/messages.dto.js";
import type { ConversationRecord } from "../models/messages.model.js";
import type { MessagesRepository } from "../repositories/messages.repository.js";

export interface MessagesDependencies {
  readonly messages: MessagesRepository;
  readonly userDirectory: UserDirectory;
  readonly socialGraph: SocialGraph;
  readonly events: EventBus;
  readonly clock: Clock;
}

export class MessagesService {
  public constructor(public readonly dependencies: MessagesDependencies) {}

  public async requireConversationForParticipant(conversationId: string, userId: string): Promise<ConversationRecord> {
    const conversation = await this.dependencies.messages.findConversationById(conversationId);
    if (conversation === undefined || !conversation.participantIds.includes(userId)) throw notFound("Conversation");
    return conversation;
  }

  public findOtherParticipantId(conversation: ConversationRecord, userId: string): string | undefined {
    return conversation.participantIds.find((participantId) => participantId !== userId);
  }

  public async describeFriendship(userId: string, otherUserId: string | undefined): Promise<FriendshipDto> {
    if (otherUserId === undefined) return { following: false, followedBy: false, areFriends: false };
    const { socialGraph } = this.dependencies;
    const [following, followedBy] = await Promise.all([
      socialGraph.isFollowingUser(userId, otherUserId),
      socialGraph.isFollowingUser(otherUserId, userId),
    ]);
    return { following, followedBy, areFriends: following && followedBy };
  }

  public async buildConversationSummaries(conversations: readonly ConversationRecord[], userId: string): Promise<readonly ConversationSummaryDto[]> {
    const { messages, userDirectory } = this.dependencies;
    const otherIds = conversations.map((conversation) => this.findOtherParticipantId(conversation, userId)).filter((id): id is string => id !== undefined);
    const summaries = new Map<string, UserSummary>((await userDirectory.findUserSummaries(otherIds)).map((summary) => [summary.id, summary]));
    return Promise.all(
      conversations.map(async (conversation) => {
        const otherUserId = this.findOtherParticipantId(conversation, userId);
        const participant = await messages.findParticipant(conversation.id, userId);
        const [lastMessage, unreadCount, friendship] = await Promise.all([
          messages.findLatestMessage(conversation.id),
          messages.countUnreadMessages(conversation.id, userId, participant?.lastReadAt ?? conversation.createdAt),
          this.describeFriendship(userId, otherUserId),
        ]);
        return {
          id: conversation.id,
          kind: conversation.kind,
          otherParticipant: otherUserId === undefined ? null : (summaries.get(otherUserId) ?? null),
          lastMessage: lastMessage === undefined ? null : convertMessageToDto(lastMessage),
          unreadCount,
          friendship,
          lastMessageAt: conversation.lastMessageAt.toISOString(),
        };
      }),
    );
  }
}
