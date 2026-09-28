import { randomUUID } from "node:crypto";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import type { ConversationRecord, MessageRecord, NewMessage, ParticipantRecord } from "../models/messages.model.js";

export interface MessagesRepository {
  findOrCreateDirectConversation(pairKey: string, participantIds: readonly string[], now: Date): Promise<ConversationRecord>;
  findConversationById(conversationId: string): Promise<ConversationRecord | undefined>;
  listConversationsForUser(userId: string): Promise<readonly ConversationRecord[]>;
  findParticipant(conversationId: string, userId: string): Promise<ParticipantRecord | undefined>;
  appendMessage(message: NewMessage, createdAt: Date): Promise<MessageRecord>;
  listMessages(conversationId: string, page: PageRequest): Promise<Page<MessageRecord>>;
  findLatestMessage(conversationId: string): Promise<MessageRecord | undefined>;
  countUnreadMessages(conversationId: string, userId: string, since: Date): Promise<number>;
  markConversationRead(conversationId: string, userId: string, readAt: Date): Promise<void>;
  searchMessagesInConversations(conversationIds: readonly string[], term: string, limit: number): Promise<readonly MessageRecord[]>;
}

export class InMemoryMessagesRepository implements MessagesRepository {
  private readonly conversations = new Map<string, ConversationRecord>();
  private readonly participants = new Map<string, ParticipantRecord>();
  private readonly messages: MessageRecord[] = [];

  public async findOrCreateDirectConversation(pairKey: string, participantIds: readonly string[], now: Date): Promise<ConversationRecord> {
    const existing = [...this.conversations.values()].find((conversation) => conversation.pairKey === pairKey);
    if (existing !== undefined) return existing;
    const conversation: ConversationRecord = { id: randomUUID(), kind: "direct", pairKey, participantIds: [...participantIds], lastMessageAt: now, createdAt: now };
    this.conversations.set(conversation.id, conversation);
    for (const userId of participantIds) this.participants.set(`${conversation.id}:${userId}`, { conversationId: conversation.id, userId, lastReadAt: now });
    return conversation;
  }

  public async findConversationById(conversationId: string): Promise<ConversationRecord | undefined> {
    return this.conversations.get(conversationId);
  }

  public async listConversationsForUser(userId: string): Promise<readonly ConversationRecord[]> {
    return [...this.conversations.values()]
      .filter((conversation) => conversation.participantIds.includes(userId))
      .sort((left, right) => right.lastMessageAt.getTime() - left.lastMessageAt.getTime());
  }

  public async findParticipant(conversationId: string, userId: string): Promise<ParticipantRecord | undefined> {
    return this.participants.get(`${conversationId}:${userId}`);
  }

  public async appendMessage(message: NewMessage, createdAt: Date): Promise<MessageRecord> {
    const record: MessageRecord = { ...message, id: randomUUID(), createdAt };
    this.messages.push(record);
    const conversation = this.conversations.get(message.conversationId);
    if (conversation !== undefined) this.conversations.set(conversation.id, { ...conversation, lastMessageAt: createdAt });
    await this.markConversationRead(message.conversationId, message.senderId, createdAt);
    return record;
  }

  public async listMessages(conversationId: string, page: PageRequest): Promise<Page<MessageRecord>> {
    return paginateSortedItems(this.messages.filter((message) => message.conversationId === conversationId).sort(compareByNewestFirst), page);
  }

  public async findLatestMessage(conversationId: string): Promise<MessageRecord | undefined> {
    return this.messages.filter((message) => message.conversationId === conversationId).sort(compareByNewestFirst)[0];
  }

  public async countUnreadMessages(conversationId: string, userId: string, since: Date): Promise<number> {
    return this.messages.filter((message) => message.conversationId === conversationId && message.senderId !== userId && message.createdAt > since).length;
  }

  public async markConversationRead(conversationId: string, userId: string, readAt: Date): Promise<void> {
    const participant = this.participants.get(`${conversationId}:${userId}`);
    if (participant !== undefined && participant.lastReadAt < readAt) this.participants.set(`${conversationId}:${userId}`, { ...participant, lastReadAt: readAt });
  }

  public async searchMessagesInConversations(conversationIds: readonly string[], term: string, limit: number): Promise<readonly MessageRecord[]> {
    const needle = term.toLowerCase();
    return this.messages
      .filter((message) => conversationIds.includes(message.conversationId) && message.text.toLowerCase().includes(needle))
      .sort(compareByNewestFirst)
      .slice(0, limit);
  }
}
