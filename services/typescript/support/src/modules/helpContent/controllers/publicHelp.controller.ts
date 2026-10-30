import type { HttpRouterContext } from "@nantty/fastify-platform";

import { defaultLocale, searchResultLimit } from "../../../constants/support.constant.js";
import { canonicalHelpTopicSlugs } from "../../../constants/helpTopicSlugAliases.constant.js";
import { notFound } from "../../../errors/support.error.js";
import { findViewerAccountId, requireViewerAccountId } from "../../../middlewares/principal.middleware.js";
import type { HelpTopicRecord } from "../../../types/helpContent.type.js";
import { flattenQuery, json, parseJsonBody, parseWithSchema, readUuidParam } from "../../../utils/http.util.js";
import { loadCategoryLookup, type HelpContentModuleDependencies } from "../helpContent.module.js";
import { searchPublishedTopics } from "../services/helpTopicSearch.service.js";
import { presentCategory, presentTopicDetail, presentTopicSummary } from "../services/helpTopicPresenter.service.js";
import { publicTopicQuerySchema, voteBodySchema } from "../validators/helpContent.validator.js";

const readLocale = (context: HttpRouterContext) => (/^[a-z]{2}(?:-[A-Z]{2})?$/.test(String(context.query["locale"] ?? "")) ? String(context.query["locale"]).slice(0, 2) : defaultLocale);

export function createPublicHelpController({ store }: HelpContentModuleDependencies) {
  const findPublishedTopic = async (slug: string, locale: string): Promise<{ readonly topic: HelpTopicRecord; readonly redirectedFromSlug: string | null } | null> => {
    const topic = await store.findTopicBySlug(slug, locale);
    if (topic?.status === "merged" && topic.mergedIntoTopicId !== null) {
      const target = await store.findTopicById(topic.mergedIntoTopicId);
      return target?.status === "published" ? { topic: target, redirectedFromSlug: topic.slug } : null;
    }
    if (topic !== null) return topic.status === "published" ? { topic, redirectedFromSlug: null } : null;
    const canonicalSlug = canonicalHelpTopicSlugs[slug];
    if (canonicalSlug === undefined) return null;
    const canonicalTopic = await store.findTopicBySlug(canonicalSlug, locale);
    return canonicalTopic?.status === "published" ? { topic: canonicalTopic, redirectedFromSlug: slug } : null;
  };
  return {
    categories: async (context: HttpRouterContext) => {
      const counts = await store.countPublishedTopicsByCategory(readLocale(context));
      return json(200, { items: (await store.listCategories()).map((category) => presentCategory(category, counts.get(category.id) ?? 0)).filter((category) => category.topicCount > 0) });
    },
    category: async (context: HttpRouterContext) => {
      const category = await store.findCategoryBySlug(context.params["categorySlug"] ?? "");
      if (category === null) throw notFound("Help category");
      const topics = await store.listTopicsInCategory(category.id, readLocale(context), ["published"]);
      const lookup = new Map([[category.id, category]]);
      return json(200, { category: presentCategory(category, topics.length), topics: topics.map((topic) => presentTopicSummary(topic, lookup)) });
    },
    topics: async (context: HttpRouterContext) => {
      const query = parseWithSchema(publicTopicQuerySchema, flattenQuery(context.query));
      const locale = readLocale(context);
      const lookup = await loadCategoryLookup(store);
      const category = query.category === undefined || query.category === "" ? undefined : [...lookup.values()].find((entry) => entry.slug === query.category);
      const limit = query.limit ?? searchResultLimit;
      const term = query.q?.trim() ?? "";
      const topics = term === ""
        ? (await store.findTopicCandidates([], locale, ["published"], 200)).filter((topic) => category === undefined || topic.categoryId === category.id).slice(0, limit)
        : await searchPublishedTopics(store, term, locale, category?.id, limit);
      return json(200, { items: topics.map((topic) => presentTopicSummary(topic, lookup)) });
    },
    topic: async (context: HttpRouterContext) => {
      const found = await findPublishedTopic(context.params["topicSlug"] ?? "", readLocale(context));
      if (found === null) throw notFound("Help topic");
      const viewer = findViewerAccountId(context);
      const [lookup, relatedIds, viewerVote] = await Promise.all([loadCategoryLookup(store), store.listRelatedTopicIds(found.topic.id), viewer === undefined ? null : store.findVote(found.topic.id, viewer)]);
      const related = await store.listTopicsByIds(relatedIds);
      return json(200, presentTopicDetail(found.topic, lookup, related, viewerVote, found.redirectedFromSlug));
    },
    vote: async (context: HttpRouterContext) => {
      const accountId = requireViewerAccountId(context);
      const body = parseWithSchema(voteBodySchema, parseJsonBody(context.request.body));
      const topic = await store.findTopicById(readUuidParam(context.params, "topicId", "Help topic"));
      if (topic === null || topic.status !== "published") throw notFound("Help topic");
      const updated = await store.recordVote(topic.id, accountId, body.helpful);
      return json(200, { helpfulCount: updated?.helpfulCount ?? topic.helpfulCount, notHelpfulCount: updated?.notHelpfulCount ?? topic.notHelpfulCount, viewerVote: body.helpful });
    },
  };
}
