import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import type { Conversation, ConversationParticipant } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type {
  ConversationKind,
  ConversationRecord,
  ConversationSettingsChanges,
  NewConversation,
  NewParticipant,
  ParticipantRecord,
  ParticipantRole,
} from "../models/messages.model.js";
import type { ConversationsRepository } from "./conversations.repository.js";

function convertConversationRow(row: Conversation): ConversationRecord {
  return { ...row, kind: row.kind as ConversationKind };
}

function convertParticipantRow(row: ConversationParticipant): ParticipantRecord {
  return { ...row, role: row.role as ParticipantRole };
}

export class PrismaConversationsRepository implements ConversationsRepository {
  public async createConversation(conversation: NewConversation, participants: readonly NewParticipant[], now: Date): Promise<ConversationRecord> {
    const created = await prisma().$transaction(async (transaction) => {
      const row = await transaction.conversation.create({
        data: { ...conversation, memberCount: participants.length, lastMessageAt: now, createdAt: now },
      });
      await transaction.conversationParticipant.createMany({
        data: participants.map((participant) => ({ conversationId: row.id, userId: participant.userId, role: participant.role, lastReadAt: now, joinedAt: now })),
        skipDuplicates: true,
      });
      return row;
    });
    return convertConversationRow(created);
  }

  public async findOrCreateByPairKey(conversation: NewConversation, participants: readonly NewParticipant[], now: Date): Promise<ConversationRecord> {
    const pairKey = conversation.pairKey ?? "";
    const existing = await prisma().conversation.findUnique({ where: { pairKey } });
    if (existing !== null) return convertConversationRow(existing);
    try {
      return await this.createConversation(conversation, participants, now);
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      return convertConversationRow(await prisma().conversation.findUniqueOrThrow({ where: { pairKey } }));
    }
  }

  public async findById(conversationId: string): Promise<ConversationRecord | undefined> {
    const row = await prisma().conversation.findUnique({ where: { id: conversationId } });
    return row === null ? undefined : convertConversationRow(row);
  }

  public async updateSettings(conversationId: string, changes: ConversationSettingsChanges): Promise<ConversationRecord | undefined> {
    await prisma().conversation.updateMany({ where: { id: conversationId }, data: changes });
    return this.findById(conversationId);
  }

  public async touchLastMessageAt(conversationId: string, at: Date): Promise<void> {
    await prisma().conversation.updateMany({ where: { id: conversationId }, data: { lastMessageAt: at } });
  }

  public async listConversationsForUser(userId: string, limit: number): Promise<readonly ConversationRecord[]> {
    const memberships = await prisma().conversationParticipant.findMany({ where: { userId }, select: { conversationId: true } });
    const rows = await prisma().conversation.findMany({
      where: { id: { in: memberships.map((membership) => membership.conversationId) } },
      orderBy: { lastMessageAt: "desc" },
      take: limit,
    });
    return rows.map(convertConversationRow);
  }

  public async listConversationsForStore(storeId: string, limit: number): Promise<readonly ConversationRecord[]> {
    const rows = await prisma().conversation.findMany({ where: { storeId }, orderBy: { lastMessageAt: "desc" }, take: limit });
    return rows.map(convertConversationRow);
  }

  public async findParticipant(conversationId: string, userId: string): Promise<ParticipantRecord | undefined> {
    const row = await prisma().conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
    return row === null ? undefined : convertParticipantRow(row);
  }

  public async listParticipants(conversationId: string, limit: number): Promise<readonly ParticipantRecord[]> {
    const rows = await prisma().conversationParticipant.findMany({ where: { conversationId }, orderBy: { joinedAt: "asc" }, take: limit });
    return rows.map(convertParticipantRow);
  }

  public async listParticipantUserIds(conversationId: string): Promise<readonly string[]> {
    const rows = await prisma().conversationParticipant.findMany({ where: { conversationId }, select: { userId: true } });
    return rows.map((row) => row.userId);
  }

  public async addParticipants(conversationId: string, participants: readonly NewParticipant[], now: Date): Promise<readonly ParticipantRecord[]> {
    const existing = new Set(
      (await prisma().conversationParticipant.findMany({ where: { conversationId, userId: { in: participants.map((participant) => participant.userId) } }, select: { userId: true } }))
        .map((row) => row.userId),
    );
    const fresh = participants.filter((participant) => !existing.has(participant.userId));
    if (fresh.length === 0) return [];
    await prisma().$transaction([
      prisma().conversationParticipant.createMany({
        data: fresh.map((participant) => ({ conversationId, userId: participant.userId, role: participant.role, lastReadAt: now, joinedAt: now })),
        skipDuplicates: true,
      }),
      prisma().conversation.update({ where: { id: conversationId }, data: { memberCount: { increment: fresh.length } } }),
    ]);
    return fresh.map((participant) => ({ conversationId, userId: participant.userId, role: participant.role, lastReadAt: now, joinedAt: now }));
  }

  public async removeParticipant(conversationId: string, userId: string): Promise<boolean> {
    const removed = await prisma().conversationParticipant.deleteMany({ where: { conversationId, userId } });
    if (removed.count === 0) return false;
    await prisma().conversation.updateMany({ where: { id: conversationId, memberCount: { gt: 0 } }, data: { memberCount: { decrement: 1 } } });
    return true;
  }

  public async changeParticipantRole(conversationId: string, userId: string, role: ParticipantRole): Promise<void> {
    await prisma().conversationParticipant.updateMany({ where: { conversationId, userId }, data: { role } });
  }

  public async markRead(conversationId: string, userId: string, readAt: Date): Promise<void> {
    await prisma().conversationParticipant.updateMany({ where: { conversationId, userId, lastReadAt: { lt: readAt } }, data: { lastReadAt: readAt } });
  }
}
