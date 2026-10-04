import type { HttpRouterContext } from "@zudojs/http";

import { autoFaqRequiresReviewSettingKey, defaultPageSize, maximumPageSize } from "../../../constants/support.constant.js";
import type { HelpTopicOrigin, HelpTopicStatus } from "../../../enums/helpTopic.enum.js";
import { conflict, notFound } from "../../../errors/support.error.js";
import type { StaffAccess } from "../../tickets/services/staffAccess.service.js";
import { empty, flattenQuery, json, parseJsonBody, parseWithSchema, readPage, readUuidParam } from "../../../utils/http.util.js";
import { loadCategoryLookup, type HelpContentModuleDependencies } from "../helpContent.module.js";
import { createHelpTopicEditor } from "../services/helpTopicEditor.service.js";
import { presentCategory, presentTopicForStaff, presentTopicVersion } from "../services/helpTopicPresenter.service.js";
import { adminTopicQuerySchema, categoryBodySchema, mergeBodySchema, settingsBodySchema, topicBodySchema } from "../validators/helpContent.validator.js";

const editPermission = ["support:helpContent"] as const;
const readPermission = ["support:helpContent", "support:tickets", "support:assign"] as const;

export function createAdminHelpController({ store }: HelpContentModuleDependencies, access: StaffAccess) {
  const editor = createHelpTopicEditor(store);
  const topicId = (context: HttpRouterContext) => readUuidParam(context.params, "topicId", "Help topic");
  const categoryId = (context: HttpRouterContext) => readUuidParam(context.params, "categoryId", "Help category");
  const presentOne = async (topic: Parameters<typeof presentTopicForStaff>[0]) => presentTopicForStaff(topic, await loadCategoryLookup(store));
  const readCategoryInput = (raw: unknown) => {
    const body = parseWithSchema(categoryBodySchema, raw);
    return { slug: body.slug, title: body.title, description: body.description ?? "", iconName: body.iconName ?? "question", position: body.position ?? 0 };
  };
  return {
    listCategories: async (context: HttpRouterContext) => {
      await access.require(context, readPermission);
      const counts = await store.countPublishedTopicsByCategory("en");
      return json(200, { items: (await store.listCategories()).map((category) => presentCategory(category, counts.get(category.id) ?? 0)) });
    },
    createCategory: async (context: HttpRouterContext) => {
      await access.require(context, editPermission);
      const input = readCategoryInput(parseJsonBody(context.request.body));
      if ((await store.findCategoryBySlug(input.slug)) !== null) throw conflict("SLUG_TAKEN", "Another category already uses this address.");
      return json(201, presentCategory(await store.createCategory(input), 0));
    },
    updateCategory: async (context: HttpRouterContext) => {
      await access.require(context, editPermission);
      const input = readCategoryInput(parseJsonBody(context.request.body));
      const clash = await store.findCategoryBySlug(input.slug);
      if (clash !== null && clash.id !== categoryId(context)) throw conflict("SLUG_TAKEN", "Another category already uses this address.");
      const updated = await store.updateCategory(categoryId(context), input);
      if (updated === null) throw notFound("Help category");
      return json(200, presentCategory(updated, 0));
    },
    deleteCategory: async (context: HttpRouterContext) => {
      await access.require(context, editPermission);
      const outcome = await store.deleteCategory(categoryId(context));
      if (outcome === "missing") throw notFound("Help category");
      if (outcome === "has_topics") throw conflict("CATEGORY_NOT_EMPTY", "Move or delete the topics in this category first.");
      return empty(204);
    },
    listTopics: async (context: HttpRouterContext) => {
      await access.require(context, readPermission);
      const query = flattenQuery(context.query);
      const filters = parseWithSchema(adminTopicQuerySchema, { status: query["status"] || undefined, origin: query["origin"] || undefined, categoryId: query["categoryId"] || undefined, search: query["search"] || undefined });
      const page = readPage(query, maximumPageSize, defaultPageSize);
      const result = await store.listAdminTopics({ status: filters.status?.toLowerCase() as HelpTopicStatus | undefined, origin: filters.origin?.toLowerCase() as HelpTopicOrigin | undefined, categoryId: filters.categoryId, search: filters.search, ...page });
      const lookup = await loadCategoryLookup(store);
      return json(200, { items: result.items.map((topic) => presentTopicForStaff(topic, lookup)), total: result.total, ...page });
    },
    topic: async (context: HttpRouterContext) => {
      await access.require(context, readPermission);
      const topic = await store.findTopicById(topicId(context));
      if (topic === null) throw notFound("Help topic");
      const [versions, relatedTopicIds] = await Promise.all([store.listTopicVersions(topic.id), store.listRelatedTopicIds(topic.id)]);
      return json(200, { topic: await presentOne(topic), versions: versions.map(presentTopicVersion), relatedTopicIds });
    },
    createTopic: async (context: HttpRouterContext) => {
      const staff = await access.require(context, editPermission);
      return json(201, await presentOne(await editor.create(parseWithSchema(topicBodySchema, parseJsonBody(context.request.body)), staff.name)));
    },
    updateTopic: async (context: HttpRouterContext) => {
      const staff = await access.require(context, editPermission);
      return json(200, await presentOne(await editor.update(topicId(context), parseWithSchema(topicBodySchema, parseJsonBody(context.request.body)), staff.name)));
    },
    deleteTopic: async (context: HttpRouterContext) => {
      await access.require(context, editPermission);
      if (!(await store.deleteTopic(topicId(context)))) throw notFound("Help topic");
      return empty(204);
    },
    publish: async (context: HttpRouterContext) => {
      const staff = await access.require(context, editPermission);
      return json(200, await presentOne(await editor.setStatus(topicId(context), "published", staff.name)));
    },
    unpublish: async (context: HttpRouterContext) => {
      const staff = await access.require(context, editPermission);
      return json(200, await presentOne(await editor.setStatus(topicId(context), "unpublished", staff.name)));
    },
    merge: async (context: HttpRouterContext) => {
      const staff = await access.require(context, editPermission);
      const body = parseWithSchema(mergeBodySchema, parseJsonBody(context.request.body));
      return json(200, await presentOne(await editor.merge(topicId(context), body.targetTopicId, staff.name)));
    },
    autoTopics: async (context: HttpRouterContext) => {
      await access.require(context, readPermission);
      const page = readPage(flattenQuery(context.query), maximumPageSize, defaultPageSize);
      const result = await store.listAutoTopicLogs(page.page, page.pageSize);
      const topics = new Map((await store.listTopicsByIds(result.items.flatMap((entry) => (entry.topicId === null ? [] : [entry.topicId])))).map((topic) => [topic.id, topic]));
      const lookup = await loadCategoryLookup(store);
      return json(200, {
        ...page, total: result.total,
        items: result.items.map((entry) => ({
          id: entry.id, ticketId: entry.ticketId, ticketRef: entry.ticketRef, action: entry.action.toUpperCase(), similarity: entry.similarity, writer: entry.writer, note: entry.note, createdAt: entry.createdAt.toISOString(),
          topic: entry.topicId === null || !topics.has(entry.topicId) ? null : presentTopicForStaff(topics.get(entry.topicId)!, lookup),
        })),
      });
    },
    settings: async (context: HttpRouterContext) => {
      await access.require(context, readPermission);
      return json(200, { autoFaqRequiresReview: await store.readSetting(autoFaqRequiresReviewSettingKey, false) });
    },
    updateSettings: async (context: HttpRouterContext) => {
      const staff = await access.require(context, editPermission);
      const body = parseWithSchema(settingsBodySchema, parseJsonBody(context.request.body));
      await store.writeSetting(autoFaqRequiresReviewSettingKey, body.autoFaqRequiresReview, staff.name);
      return json(200, { autoFaqRequiresReview: body.autoFaqRequiresReview });
    },
  };
}
