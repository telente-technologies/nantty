import { randomUUID } from "node:crypto";

import { prisma } from "../../../integrations/database.integration.js";
import type { FeedInteractionKind, FeedInteractionRecord } from "../models/feeds.model.js";

export interface FeedInteractionsRepository {
  record(userId: string, postId: string, kind: FeedInteractionKind, createdAt: Date): Promise<FeedInteractionRecord>;
  listRecentForUser(userId: string, limit: number): Promise<readonly FeedInteractionRecord[]>;
}

export class InMemoryFeedInteractionsRepository implements FeedInteractionsRepository {
  private readonly interactions: FeedInteractionRecord[] = [];

  public async record(userId: string, postId: string, kind: FeedInteractionKind, createdAt: Date): Promise<FeedInteractionRecord> {
    const interaction = { id: randomUUID(), userId, postId, kind, createdAt };
    this.interactions.push(interaction);
    return interaction;
  }

  public async listRecentForUser(userId: string, limit: number): Promise<readonly FeedInteractionRecord[]> {
    return this.interactions
      .filter((interaction) => interaction.userId === userId)
      .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
      .slice(0, limit);
  }
}

export class PrismaFeedInteractionsRepository implements FeedInteractionsRepository {
  public async record(userId: string, postId: string, kind: FeedInteractionKind, createdAt: Date): Promise<FeedInteractionRecord> {
    const row = await prisma().feedInteraction.create({ data: { userId, postId, kind, createdAt } });
    return { ...row, kind };
  }

  public async listRecentForUser(userId: string, limit: number): Promise<readonly FeedInteractionRecord[]> {
    const rows = await prisma().feedInteraction.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: limit });
    return rows.map((row) => ({ ...row, kind: row.kind as FeedInteractionKind }));
  }
}
