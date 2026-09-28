import { randomUUID } from "node:crypto";

import { DEFAULT_TOPICS } from "../../../constants/seed-data.constant.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { TopicRecord } from "../models/users.model.js";

export interface TopicsRepository {
  listAll(): Promise<readonly TopicRecord[]>;
  findManyByIds(ids: readonly string[]): Promise<readonly TopicRecord[]>;
  listSelectedTopicsForUser(userId: string): Promise<readonly TopicRecord[]>;
  replaceSelectedTopicsForUser(userId: string, topicIds: readonly string[]): Promise<void>;
}

export class InMemoryTopicsRepository implements TopicsRepository {
  private readonly topics: readonly TopicRecord[] = DEFAULT_TOPICS.map((topic, order) => ({ ...topic, id: randomUUID(), order }));
  private readonly selections = new Map<string, readonly string[]>();

  public async listAll(): Promise<readonly TopicRecord[]> {
    return this.topics;
  }

  public async findManyByIds(ids: readonly string[]): Promise<readonly TopicRecord[]> {
    return this.topics.filter((topic) => ids.includes(topic.id));
  }

  public async listSelectedTopicsForUser(userId: string): Promise<readonly TopicRecord[]> {
    return this.findManyByIds(this.selections.get(userId) ?? []);
  }

  public async replaceSelectedTopicsForUser(userId: string, topicIds: readonly string[]): Promise<void> {
    this.selections.set(userId, [...new Set(topicIds)]);
  }
}

export class PrismaTopicsRepository implements TopicsRepository {
  public async listAll(): Promise<readonly TopicRecord[]> {
    return prisma().topic.findMany({ orderBy: [{ order: "asc" }, { name: "asc" }] });
  }

  public async findManyByIds(ids: readonly string[]): Promise<readonly TopicRecord[]> {
    return prisma().topic.findMany({ where: { id: { in: [...ids] } } });
  }

  public async listSelectedTopicsForUser(userId: string): Promise<readonly TopicRecord[]> {
    const selections = await prisma().userTopic.findMany({ where: { userId } });
    return this.findManyByIds(selections.map((selection) => selection.topicId));
  }

  public async replaceSelectedTopicsForUser(userId: string, topicIds: readonly string[]): Promise<void> {
    await prisma().$transaction([
      prisma().userTopic.deleteMany({ where: { userId } }),
      prisma().userTopic.createMany({ data: [...new Set(topicIds)].map((topicId) => ({ userId, topicId })) }),
    ]);
  }
}
