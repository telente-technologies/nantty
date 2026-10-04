import { randomUUID } from "node:crypto";

import type { Prisma, PrismaClient } from "../../../generated/prisma/client.js";
import type { HelpTopicOrigin, HelpTopicStatus } from "../../../enums/helpTopic.enum.js";
import type { HelpContentStore } from "../../../interfaces/helpContentStore.interface.js";
import type { HelpTopicRecord } from "../../../types/helpContent.type.js";
import { normalizeForSearch } from "../../../utils/textSimilarity.util.js";

type TopicStore = Pick<HelpContentStore,
  "listTopicsInCategory" | "findTopicCandidates" | "findTopicBySlug" | "findTopicById" | "findTopicBySeedKey" | "listTopicsByIds" | "listRelatedTopicIds" | "createTopic"
  | "updateTopic" | "setTopicStatus" | "deleteTopic" | "listTopicVersions" | "listAdminTopics" | "recordVote" | "findVote">;

type TopicRow = Prisma.HelpTopicGetPayload<object>;

export function mapTopicRow(row: TopicRow): HelpTopicRecord {
  return {
    id: row.id, categoryId: row.categoryId, slug: row.slug, locale: row.locale, title: row.title, summary: row.summary, bodyMarkdown: row.bodyMarkdown, tags: row.tags,
    status: row.status as HelpTopicStatus, origin: row.origin as HelpTopicOrigin, sourceTicketId: row.sourceTicketId, mergedIntoTopicId: row.mergedIntoTopicId,
    seedKey: row.seedKey, seedHash: row.seedHash, editedByStaff: row.editedByStaff, version: row.version, helpfulCount: row.helpfulCount, notHelpfulCount: row.notHelpfulCount,
    relatedQuestions: row.relatedQuestions, updatedByName: row.updatedByName, publishedAt: row.publishedAt, createdAt: row.createdAt, updatedAt: row.updatedAt,
  };
}

export function buildTopicSearchText(title: string, summary: string, tags: readonly string[], bodyMarkdown: string): string {
  return normalizeForSearch(`${title} ${summary} ${tags.join(" ")} ${bodyMarkdown}`).slice(0, 20_000);
}

async function replaceRelations(transaction: Prisma.TransactionClient, topicId: string, relatedTopicIds: readonly string[]): Promise<void> {
  await transaction.helpTopicRelation.deleteMany({ where: { topicId } });
  const unique = [...new Set(relatedTopicIds)].filter((id) => id !== topicId).slice(0, 8);
  if (unique.length === 0) return;
  const existing = await transaction.helpTopic.findMany({ where: { id: { in: unique } }, select: { id: true } });
  await transaction.helpTopicRelation.createMany({ data: existing.map((row) => ({ topicId, relatedTopicId: row.id })), skipDuplicates: true });
}

export function createHelpTopicPrismaRepository(prisma: PrismaClient): TopicStore {
  const findOne = async (where: Prisma.HelpTopicWhereUniqueInput) => {
    const row = await prisma.helpTopic.findUnique({ where });
    return row === null ? null : mapTopicRow(row);
  };
  return {
    listTopicsInCategory: async (categoryId, locale, statuses) =>
      (await prisma.helpTopic.findMany({ where: { categoryId, locale, status: { in: [...statuses] } }, orderBy: [{ origin: "desc" }, { title: "asc" }] })).map(mapTopicRow),
    async findTopicCandidates(keywords, locale, statuses, limit) {
      const terms = keywords.filter((keyword) => keyword.length >= 2).slice(0, 10);
      const rows = await prisma.helpTopic.findMany({
        where: { locale, status: { in: [...statuses] }, ...(terms.length === 0 ? {} : { OR: terms.flatMap((term) => [{ searchText: { contains: term } }, { tags: { has: term } }]) }) },
        take: limit,
        orderBy: { helpfulCount: "desc" },
      });
      return rows.map(mapTopicRow);
    },
    findTopicBySlug: (slug, locale) => findOne({ slug_locale: { slug, locale } }),
    findTopicById: (topicId) => findOne({ id: topicId }),
    findTopicBySeedKey: (seedKey) => findOne({ seedKey }),
    listTopicsByIds: async (topicIds) => (topicIds.length === 0 ? [] : (await prisma.helpTopic.findMany({ where: { id: { in: [...topicIds] } } })).map(mapTopicRow)),
    listRelatedTopicIds: async (topicId) => (await prisma.helpTopicRelation.findMany({ where: { topicId }, select: { relatedTopicId: true } })).map((row) => row.relatedTopicId),
    async createTopic(input) {
      const id = randomUUID();
      await prisma.$transaction(async (transaction) => {
        await transaction.helpTopic.create({
          data: {
            id, categoryId: input.categoryId, slug: input.slug, locale: input.locale, title: input.title, summary: input.summary, bodyMarkdown: input.bodyMarkdown, tags: [...input.tags],
            searchText: buildTopicSearchText(input.title, input.summary, input.tags, input.bodyMarkdown), status: input.status, origin: input.origin, sourceTicketId: input.sourceTicketId,
            seedKey: input.seedKey, seedHash: input.seedHash, relatedQuestions: input.relatedQuestions ?? 0, updatedByName: input.editorName, publishedAt: input.status === "published" ? new Date() : null,
          },
        });
        await transaction.helpTopicVersion.create({ data: { id: randomUUID(), topicId: id, version: 1, title: input.title, summary: input.summary, bodyMarkdown: input.bodyMarkdown, tags: [...input.tags], editedByName: input.editorName, changeNote: "Created" } });
        await replaceRelations(transaction, id, input.relatedTopicIds);
      });
      const created = await findOne({ id });
      if (created === null) throw new Error("topic vanished after create");
      return created;
    },
    async updateTopic(topicId, change) {
      const updated = await prisma.$transaction(async (transaction) => {
        const current = await transaction.helpTopic.findUnique({ where: { id: topicId } });
        if (current === null) return false;
        const next = {
          categoryId: change.categoryId ?? current.categoryId, slug: change.slug ?? current.slug, locale: change.locale ?? current.locale, title: change.title ?? current.title,
          summary: change.summary ?? current.summary, bodyMarkdown: change.bodyMarkdown ?? current.bodyMarkdown, tags: change.tags === undefined ? current.tags : [...change.tags],
        };
        const contentChanged = next.title !== current.title || next.summary !== current.summary || next.bodyMarkdown !== current.bodyMarkdown || next.tags.join("|") !== current.tags.join("|");
        const version = contentChanged ? current.version + 1 : current.version;
        await transaction.helpTopic.update({
          where: { id: topicId },
          data: {
            ...next, version, searchText: buildTopicSearchText(next.title, next.summary, next.tags, next.bodyMarkdown), updatedByName: change.editorName,
            ...(change.markEditedByStaff ? { editedByStaff: true } : {}), ...(change.seedHash === undefined ? {} : { seedHash: change.seedHash }),
            ...(change.relatedQuestionsIncrement === undefined ? {} : { relatedQuestions: { increment: change.relatedQuestionsIncrement } }),
          },
        });
        if (contentChanged) {
          await transaction.helpTopicVersion.create({ data: { id: randomUUID(), topicId, version, title: next.title, summary: next.summary, bodyMarkdown: next.bodyMarkdown, tags: next.tags, editedByName: change.editorName, changeNote: change.changeNote } });
        }
        if (change.relatedTopicIds !== undefined) await replaceRelations(transaction, topicId, change.relatedTopicIds);
        return true;
      });
      return updated ? findOne({ id: topicId }) : null;
    },
    async setTopicStatus(topicId, status, editorName, mergedIntoTopicId) {
      const result = await prisma.helpTopic.updateMany({
        where: { id: topicId },
        data: { status, updatedByName: editorName, ...(status === "published" ? { publishedAt: new Date() } : {}), ...(mergedIntoTopicId === undefined ? {} : { mergedIntoTopicId }) },
      });
      return result.count === 0 ? null : findOne({ id: topicId });
    },
    deleteTopic: async (topicId) => (await prisma.helpTopic.deleteMany({ where: { id: topicId } })).count === 1,
    listTopicVersions: async (topicId) =>
      (await prisma.helpTopicVersion.findMany({ where: { topicId }, orderBy: { version: "desc" }, take: 50 })).map((row) => ({
        version: row.version, title: row.title, summary: row.summary, bodyMarkdown: row.bodyMarkdown, tags: row.tags, editedByName: row.editedByName, changeNote: row.changeNote, createdAt: row.createdAt,
      })),
    async listAdminTopics(filter) {
      const search = filter.search?.trim();
      const where: Prisma.HelpTopicWhereInput = {
        ...(filter.status === undefined ? {} : { status: filter.status }),
        ...(filter.origin === undefined ? {} : { origin: filter.origin }),
        ...(filter.categoryId === undefined ? {} : { categoryId: filter.categoryId }),
        ...(search === undefined || search === "" ? {} : { OR: [{ title: { contains: search, mode: "insensitive" } }, { slug: { contains: search.toLowerCase() } }, { searchText: { contains: normalizeForSearch(search) } }] }),
      };
      const [rows, total] = await Promise.all([
        prisma.helpTopic.findMany({ where, orderBy: { updatedAt: "desc" }, skip: (filter.page - 1) * filter.pageSize, take: filter.pageSize }),
        prisma.helpTopic.count({ where }),
      ]);
      return { items: rows.map(mapTopicRow), total };
    },
    async recordVote(topicId, voterKey, helpful) {
      await prisma.$transaction(async (transaction) => {
        const previous = await transaction.helpTopicVote.findUnique({ where: { topicId_voterKey: { topicId, voterKey } } });
        if (previous?.helpful === helpful) return;
        await transaction.helpTopicVote.upsert({ where: { topicId_voterKey: { topicId, voterKey } }, create: { topicId, voterKey, helpful }, update: { helpful } });
        const delta = (wasHelpful: boolean | undefined, isHelpful: boolean) => ({
          helpfulCount: { increment: (isHelpful ? 1 : 0) - (wasHelpful === true ? 1 : 0) },
          notHelpfulCount: { increment: (isHelpful ? 0 : 1) - (wasHelpful === false ? 1 : 0) },
        });
        await transaction.helpTopic.update({ where: { id: topicId }, data: delta(previous?.helpful, helpful) });
      });
      return findOne({ id: topicId });
    },
    findVote: async (topicId, voterKey) => (await prisma.helpTopicVote.findUnique({ where: { topicId_voterKey: { topicId, voterKey } } }))?.helpful ?? null,
  };
}
