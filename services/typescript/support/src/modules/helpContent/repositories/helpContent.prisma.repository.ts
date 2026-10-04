import { randomUUID } from "node:crypto";

import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import type { AutoTopicAction } from "../../../enums/helpTopic.enum.js";
import type { HelpContentStore } from "../../../interfaces/helpContentStore.interface.js";
import type { AutoTopicLogRecord, HelpCategoryRecord } from "../../../types/helpContent.type.js";
import { createHelpTopicPrismaRepository } from "./helpTopic.prisma.repository.js";

const mapCategory = (row: HelpCategoryRecord): HelpCategoryRecord => ({ id: row.id, slug: row.slug, title: row.title, description: row.description, iconName: row.iconName, position: row.position });

const mapLog = (row: Prisma.AutoTopicLogGetPayload<object>): AutoTopicLogRecord => ({
  id: row.id, ticketId: row.ticketId, ticketRef: row.ticketRef, topicId: row.topicId, action: row.action as AutoTopicAction, similarity: row.similarity, writer: row.writer, note: row.note, createdAt: row.createdAt,
});

export function createHelpContentPrismaRepository(prisma: PrismaClient): HelpContentStore {
  return {
    ...createHelpTopicPrismaRepository(prisma),
    listCategories: async () => (await prisma.helpCategory.findMany({ orderBy: [{ position: "asc" }, { title: "asc" }] })).map(mapCategory),
    async countPublishedTopicsByCategory(locale) {
      const groups = await prisma.helpTopic.groupBy({ by: ["categoryId"], where: { locale, status: "published" }, _count: { _all: true } });
      return new Map(groups.map((group) => [group.categoryId, group._count._all]));
    },
    findCategoryBySlug: async (slug) => {
      const row = await prisma.helpCategory.findUnique({ where: { slug } });
      return row === null ? null : mapCategory(row);
    },
    findCategoryById: async (categoryId) => {
      const row = await prisma.helpCategory.findUnique({ where: { id: categoryId } });
      return row === null ? null : mapCategory(row);
    },
    createCategory: async (input) => mapCategory(await prisma.helpCategory.create({ data: { id: randomUUID(), ...input } })),
    async updateCategory(categoryId, input) {
      const result = await prisma.helpCategory.updateMany({ where: { id: categoryId }, data: input });
      if (result.count === 0) return null;
      const row = await prisma.helpCategory.findUnique({ where: { id: categoryId } });
      return row === null ? null : mapCategory(row);
    },
    async deleteCategory(categoryId) {
      const category = await prisma.helpCategory.findUnique({ where: { id: categoryId }, select: { id: true, _count: { select: { topics: true } } } });
      if (category === null) return "missing";
      if (category._count.topics > 0) return "has_topics";
      await prisma.helpCategory.delete({ where: { id: categoryId } });
      return "deleted";
    },
    createAutoTopicLog: async (entry) =>
      mapLog(await prisma.autoTopicLog.upsert({ where: { ticketId: entry.ticketId }, create: { id: randomUUID(), ...entry }, update: { ...entry, createdAt: new Date() } })),
    async listAutoTopicLogs(page, pageSize) {
      const [rows, total] = await Promise.all([prisma.autoTopicLog.findMany({ orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }), prisma.autoTopicLog.count()]);
      return { items: rows.map(mapLog), total };
    },
    async readSetting<T>(key: string, fallback: T): Promise<T> {
      const row = await prisma.supportSetting.findUnique({ where: { key } });
      return row === null ? fallback : (row.value as T);
    },
    async writeSetting(key, value, updatedBy) {
      await prisma.supportSetting.upsert({ where: { key }, create: { key, value: value as Prisma.InputJsonValue, updatedBy }, update: { value: value as Prisma.InputJsonValue, updatedBy } });
    },
  };
}
