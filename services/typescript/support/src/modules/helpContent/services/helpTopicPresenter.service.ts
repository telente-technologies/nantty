import { fromResolvedQuestionLabel } from "../../../constants/support.constant.js";
import type { HelpCategoryRecord, HelpTopicRecord, HelpTopicVersionRecord } from "../../../types/helpContent.type.js";

export type CategoryLookup = ReadonlyMap<string, HelpCategoryRecord>;

export function presentCategory(category: HelpCategoryRecord, topicCount: number) {
  return { id: category.id, slug: category.slug, title: category.title, description: category.description, iconName: category.iconName, position: category.position, topicCount };
}

export function presentTopicSummary(topic: HelpTopicRecord, categories: CategoryLookup) {
  const category = categories.get(topic.categoryId);
  return {
    id: topic.id, slug: topic.slug, title: topic.title, summary: topic.summary, categorySlug: category?.slug ?? "", categoryTitle: category?.title ?? "", tags: topic.tags,
    fromResolvedQuestion: topic.origin === "resolved_question", sourceLabel: topic.origin === "resolved_question" ? fromResolvedQuestionLabel : null, updatedAt: topic.updatedAt.toISOString(),
  };
}

export function presentTopicDetail(topic: HelpTopicRecord, categories: CategoryLookup, related: readonly HelpTopicRecord[], viewerVote: boolean | null, redirectedFromSlug: string | null) {
  return {
    ...presentTopicSummary(topic, categories), locale: topic.locale, bodyMarkdown: topic.bodyMarkdown, version: topic.version, helpfulCount: topic.helpfulCount,
    notHelpfulCount: topic.notHelpfulCount, relatedQuestions: topic.relatedQuestions, publishedAt: topic.publishedAt?.toISOString() ?? null,
    related: related.filter((entry) => entry.status === "published").map((entry) => presentTopicSummary(entry, categories)), viewerVote, redirectedFromSlug,
  };
}

export function presentTopicForStaff(topic: HelpTopicRecord, categories: CategoryLookup) {
  return {
    ...presentTopicSummary(topic, categories), categoryId: topic.categoryId, locale: topic.locale, bodyMarkdown: topic.bodyMarkdown, status: topic.status.toUpperCase(),
    origin: topic.origin.toUpperCase(), sourceTicketId: topic.sourceTicketId, mergedIntoTopicId: topic.mergedIntoTopicId, editedByStaff: topic.editedByStaff, version: topic.version,
    helpfulCount: topic.helpfulCount, notHelpfulCount: topic.notHelpfulCount, relatedQuestions: topic.relatedQuestions, updatedByName: topic.updatedByName,
    publishedAt: topic.publishedAt?.toISOString() ?? null, createdAt: topic.createdAt.toISOString(),
  };
}

export function presentTopicVersion(version: HelpTopicVersionRecord) {
  return { ...version, tags: [...version.tags], createdAt: version.createdAt.toISOString() };
}
