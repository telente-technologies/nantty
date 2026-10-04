import { ApiError } from "@/errors/api.error";
import type { HelpTopicDetail, HelpTopicSummary } from "@/types/helpCentre.type";

import { mockHelpCategories, mockHelpTopicSeeds, type MockHelpTopicSeed } from "./helpCenterContent.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";

const votes = new Map<string, boolean>();
const baseCounts = new Map(mockHelpTopicSeeds.map((topic, index) => [topic.slug, 8 + index * 3]));

function toSummary(topic: MockHelpTopicSeed): HelpTopicSummary {
  const category = mockHelpCategories.find((entry) => entry.slug === topic.categorySlug);
  return { id: `ht_${topic.slug}`, slug: topic.slug, title: topic.title, summary: topic.summary, categorySlug: topic.categorySlug, categoryTitle: category?.title ?? "", tags: topic.tags, fromResolvedQuestion: false, sourceLabel: null, updatedAt: "2026-10-04T09:00:00.000Z" };
}

function toDetail(topic: MockHelpTopicSeed): HelpTopicDetail {
  const vote = votes.get(topic.slug) ?? null;
  return {
    ...toSummary(topic), bodyMarkdown: topic.bodyMarkdown, version: 1, relatedQuestions: 0, publishedAt: "2026-10-04T09:00:00.000Z",
    helpfulCount: (baseCounts.get(topic.slug) ?? 0) + (vote === true ? 1 : 0), notHelpfulCount: vote === false ? 1 : 0, viewerVote: vote, redirectedFromSlug: null,
    related: topic.related.flatMap((slug) => mockHelpTopicSeeds.filter((candidate) => candidate.slug === slug).map(toSummary)),
  };
}

const matches = (topic: MockHelpTopicSeed, term: string) => term.split(/\s+/).every((word) => `${topic.title} ${topic.summary} ${topic.tags.join(" ")} ${topic.bodyMarkdown}`.toLowerCase().includes(word));

export const helpCenterMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/help/categories", () => ({ items: mockHelpCategories.map((category) => ({ ...category, topicCount: mockHelpTopicSeeds.filter((topic) => topic.categorySlug === category.slug).length })) })),
  createMockRoute("GET", "/api/v1/help/categories/:categorySlug", ({ params }) => {
    const category = mockHelpCategories.find((entry) => entry.slug === params.categorySlug);
    if (!category) throw new ApiError(404, "Help category not found");
    const topics = mockHelpTopicSeeds.filter((topic) => topic.categorySlug === category.slug).map(toSummary);
    return { category: { ...category, topicCount: topics.length }, topics };
  }),
  createMockRoute("GET", "/api/v1/help/topics", ({ query }) => {
    const term = (query.get("q") ?? "").trim().toLowerCase();
    return { items: mockHelpTopicSeeds.filter((topic) => !term || matches(topic, term)).map(toSummary) };
  }),
  createMockRoute("GET", "/api/v1/help/topics/:topicSlug", ({ params }) => {
    const topic = mockHelpTopicSeeds.find((candidate) => candidate.slug === params.topicSlug);
    if (!topic) throw new ApiError(404, "Help topic not found");
    return toDetail(topic);
  }),
  createMockRoute("POST", "/api/v1/help/topics/:topicId/votes", ({ params, body }) => {
    const topic = mockHelpTopicSeeds.find((candidate) => `ht_${candidate.slug}` === params.topicId);
    if (!topic) throw new ApiError(404, "Help topic not found");
    votes.set(topic.slug, (body as { helpful: boolean }).helpful);
    const detail = toDetail(topic);
    return { helpfulCount: detail.helpfulCount, notHelpfulCount: detail.notHelpfulCount, viewerVote: votes.get(topic.slug) ?? false };
  }),
];
