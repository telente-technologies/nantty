import { randomUUID } from "node:crypto";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import { isMessageVisibleAt, type MessageRecord, type MessageSyncPosition, type NewMessage, type ReactionRecord } from "../models/messages.model.js";

export interface MessagesRepository {
  appendMessage(message: NewMessage, createdAt: Date): Promise<MessageRecord>;
  findById(messageId: string): Promise<MessageRecord | undefined>;
  listVisibleMessages(conversationId: string, now: Date, page: PageRequest): Promise<Page<MessageRecord>>;
  listVisibleMessagesAfter(conversationId: string, now: Date, position: MessageSyncPosition, limit: number): Promise<readonly MessageRecord[]>;
  findLatestVisibleMessage(conversationId: string, now: Date): Promise<MessageRecord | undefined>;
  countUnreadMessages(conversationId: string, userId: string, since: Date, now: Date): Promise<number>;
  searchVisibleMessages(conversationIds: readonly string[], term: string, now: Date, limit: number): Promise<readonly MessageRecord[]>;
  setHiddenAt(messageId: string, hiddenAt: Date | null): Promise<boolean>;
  deleteExpiredMessages(now: Date, limit: number): Promise<number>;
  addReaction(messageId: string, userId: string, emoji: string, now: Date): Promise<void>;
  removeReaction(messageId: string, userId: string, emoji: string): Promise<void>;
  listReactions(messageIds: readonly string[]): Promise<readonly ReactionRecord[]>;
}

function isAfterPosition(message: MessageRecord, position: MessageSyncPosition): boolean {
  const delta = message.createdAt.getTime() - position.createdAt.getTime();
  return delta !== 0 ? delta > 0 : message.id > position.messageId;
}

export class InMemoryMessagesRepository implements MessagesRepository {
  private readonly messages = new Map<string, MessageRecord>();
  private readonly reactions = new Map<string, ReactionRecord>();

  public async appendMessage(message: NewMessage, createdAt: Date): Promise<MessageRecord> {
    const record: MessageRecord = { ...message, id: randomUUID(), hiddenAt: null, createdAt };
    this.messages.set(record.id, record);
    return record;
  }

  public async findById(messageId: string): Promise<MessageRecord | undefined> {
    return this.messages.get(messageId);
  }

  public async listVisibleMessages(conversationId: string, now: Date, page: PageRequest): Promise<Page<MessageRecord>> {
    return paginateSortedItems(this.visibleMessagesIn(conversationId, now).sort(compareByNewestFirst), page);
  }

  public async listVisibleMessagesAfter(conversationId: string, now: Date, position: MessageSyncPosition, limit: number): Promise<readonly MessageRecord[]> {
    return this.visibleMessagesIn(conversationId, now)
      .filter((message) => isAfterPosition(message, position))
      .sort((left, right) => compareByNewestFirst(right, left))
      .slice(0, limit);
  }

  public async findLatestVisibleMessage(conversationId: string, now: Date): Promise<MessageRecord | undefined> {
    return this.visibleMessagesIn(conversationId, now).sort(compareByNewestFirst)[0];
  }

  public async countUnreadMessages(conversationId: string, userId: string, since: Date, now: Date): Promise<number> {
    return this.visibleMessagesIn(conversationId, now).filter((message) => message.senderId !== userId && message.createdAt > since).length;
  }

  public async searchVisibleMessages(conversationIds: readonly string[], term: string, now: Date, limit: number): Promise<readonly MessageRecord[]> {
    const needle = term.toLowerCase();
    return [...this.messages.values()]
      .filter((message) => conversationIds.includes(message.conversationId) && isMessageVisibleAt(message, now) && message.text.toLowerCase().includes(needle))
      .sort(compareByNewestFirst)
      .slice(0, limit);
  }

  public async setHiddenAt(messageId: string, hiddenAt: Date | null): Promise<boolean> {
    const existing = this.messages.get(messageId);
    if (existing === undefined) return false;
    this.messages.set(messageId, { ...existing, hiddenAt });
    return true;
  }

  public async deleteExpiredMessages(now: Date, limit: number): Promise<number> {
    const expired = [...this.messages.values()].filter((message) => message.expiresAt !== null && message.expiresAt <= now).slice(0, limit);
    for (const message of expired) {
      this.messages.delete(message.id);
      for (const [key, reaction] of this.reactions) if (reaction.messageId === message.id) this.reactions.delete(key);
    }
    return expired.length;
  }

  public async addReaction(messageId: string, userId: string, emoji: string, now: Date): Promise<void> {
    const key = `${messageId}:${userId}:${emoji}`;
    if (!this.reactions.has(key)) this.reactions.set(key, { messageId, userId, emoji, createdAt: now });
  }

  public async removeReaction(messageId: string, userId: string, emoji: string): Promise<void> {
    this.reactions.delete(`${messageId}:${userId}:${emoji}`);
  }

  public async listReactions(messageIds: readonly string[]): Promise<readonly ReactionRecord[]> {
    const wanted = new Set(messageIds);
    return [...this.reactions.values()].filter((reaction) => wanted.has(reaction.messageId));
  }

  private visibleMessagesIn(conversationId: string, now: Date): MessageRecord[] {
    return [...this.messages.values()].filter((message) => message.conversationId === conversationId && isMessageVisibleAt(message, now));
  }
}
