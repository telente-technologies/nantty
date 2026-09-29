import { randomUUID } from "node:crypto";

import type {
  ConversationRecord,
  ConversationSettingsChanges,
  NewConversation,
  NewParticipant,
  ParticipantRecord,
  ParticipantRole,
} from "../models/messages.model.js";

export interface ConversationsRepository {
  createConversation(conversation: NewConversation, participants: readonly NewParticipant[], now: Date): Promise<ConversationRecord>;
  findOrCreateByPairKey(conversation: NewConversation, participants: readonly NewParticipant[], now: Date): Promise<ConversationRecord>;
  findById(conversationId: string): Promise<ConversationRecord | undefined>;
  updateSettings(conversationId: string, changes: ConversationSettingsChanges): Promise<ConversationRecord | undefined>;
  touchLastMessageAt(conversationId: string, at: Date): Promise<void>;
  listConversationsForUser(userId: string, limit: number): Promise<readonly ConversationRecord[]>;
  listConversationsForStore(storeId: string, limit: number): Promise<readonly ConversationRecord[]>;
  findParticipant(conversationId: string, userId: string): Promise<ParticipantRecord | undefined>;
  listParticipants(conversationId: string, limit: number): Promise<readonly ParticipantRecord[]>;
  listParticipantUserIds(conversationId: string): Promise<readonly string[]>;
  addParticipants(conversationId: string, participants: readonly NewParticipant[], now: Date): Promise<readonly ParticipantRecord[]>;
  removeParticipant(conversationId: string, userId: string): Promise<boolean>;
  changeParticipantRole(conversationId: string, userId: string, role: ParticipantRole): Promise<void>;
  markRead(conversationId: string, userId: string, readAt: Date): Promise<void>;
}

export class InMemoryConversationsRepository implements ConversationsRepository {
  private readonly conversations = new Map<string, ConversationRecord>();
  private readonly participants = new Map<string, ParticipantRecord>();

  public async createConversation(conversation: NewConversation, participants: readonly NewParticipant[], now: Date): Promise<ConversationRecord> {
    const record: ConversationRecord = { ...conversation, id: randomUUID(), memberCount: 0, lastMessageAt: now, createdAt: now };
    this.conversations.set(record.id, record);
    await this.addParticipants(record.id, participants, now);
    return this.conversations.get(record.id) ?? record;
  }

  public async findOrCreateByPairKey(conversation: NewConversation, participants: readonly NewParticipant[], now: Date): Promise<ConversationRecord> {
    const existing = [...this.conversations.values()].find((candidate) => candidate.pairKey === conversation.pairKey);
    return existing ?? this.createConversation(conversation, participants, now);
  }

  public async findById(conversationId: string): Promise<ConversationRecord | undefined> {
    return this.conversations.get(conversationId);
  }

  public async updateSettings(conversationId: string, changes: ConversationSettingsChanges): Promise<ConversationRecord | undefined> {
    const existing = this.conversations.get(conversationId);
    if (existing === undefined) return undefined;
    const updated = { ...existing, ...changes };
    this.conversations.set(conversationId, updated);
    return updated;
  }

  public async touchLastMessageAt(conversationId: string, at: Date): Promise<void> {
    const existing = this.conversations.get(conversationId);
    if (existing !== undefined) this.conversations.set(conversationId, { ...existing, lastMessageAt: at });
  }

  public async listConversationsForUser(userId: string, limit: number): Promise<readonly ConversationRecord[]> {
    const conversationIds = new Set([...this.participants.values()].filter((participant) => participant.userId === userId).map((participant) => participant.conversationId));
    return this.sortByLatestActivity([...this.conversations.values()].filter((conversation) => conversationIds.has(conversation.id))).slice(0, limit);
  }

  public async listConversationsForStore(storeId: string, limit: number): Promise<readonly ConversationRecord[]> {
    return this.sortByLatestActivity([...this.conversations.values()].filter((conversation) => conversation.storeId === storeId)).slice(0, limit);
  }

  public async findParticipant(conversationId: string, userId: string): Promise<ParticipantRecord | undefined> {
    return this.participants.get(`${conversationId}:${userId}`);
  }

  public async listParticipants(conversationId: string, limit: number): Promise<readonly ParticipantRecord[]> {
    return [...this.participants.values()]
      .filter((participant) => participant.conversationId === conversationId)
      .sort((left, right) => left.joinedAt.getTime() - right.joinedAt.getTime())
      .slice(0, limit);
  }

  public async listParticipantUserIds(conversationId: string): Promise<readonly string[]> {
    return [...this.participants.values()].filter((participant) => participant.conversationId === conversationId).map((participant) => participant.userId);
  }

  public async addParticipants(conversationId: string, participants: readonly NewParticipant[], now: Date): Promise<readonly ParticipantRecord[]> {
    const added: ParticipantRecord[] = [];
    for (const participant of participants) {
      const key = `${conversationId}:${participant.userId}`;
      if (this.participants.has(key)) continue;
      const record: ParticipantRecord = { conversationId, userId: participant.userId, role: participant.role, lastReadAt: now, joinedAt: now };
      this.participants.set(key, record);
      added.push(record);
    }
    this.changeMemberCount(conversationId, added.length);
    return added;
  }

  public async removeParticipant(conversationId: string, userId: string): Promise<boolean> {
    const removed = this.participants.delete(`${conversationId}:${userId}`);
    if (removed) this.changeMemberCount(conversationId, -1);
    return removed;
  }

  public async changeParticipantRole(conversationId: string, userId: string, role: ParticipantRole): Promise<void> {
    const existing = this.participants.get(`${conversationId}:${userId}`);
    if (existing !== undefined) this.participants.set(`${conversationId}:${userId}`, { ...existing, role });
  }

  public async markRead(conversationId: string, userId: string, readAt: Date): Promise<void> {
    const existing = this.participants.get(`${conversationId}:${userId}`);
    if (existing !== undefined && existing.lastReadAt < readAt) this.participants.set(`${conversationId}:${userId}`, { ...existing, lastReadAt: readAt });
  }

  private changeMemberCount(conversationId: string, delta: number): void {
    const existing = this.conversations.get(conversationId);
    if (existing !== undefined && delta !== 0) this.conversations.set(conversationId, { ...existing, memberCount: Math.max(0, existing.memberCount + delta) });
  }

  private sortByLatestActivity(conversations: readonly ConversationRecord[]): ConversationRecord[] {
    return [...conversations].sort((left, right) => right.lastMessageAt.getTime() - left.lastMessageAt.getTime());
  }
}
