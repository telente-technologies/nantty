import { searchResultLimit } from "../../../constants/support.constant.js";
import type { HelpContentStore } from "../../../interfaces/helpContentStore.interface.js";
import type { HelpTopicRecord } from "../../../types/helpContent.type.js";
import { extractKeywords, normalizeForSearch, trigramSimilarity } from "../../../utils/textSimilarity.util.js";

export function scoreTopicForQuery(topic: HelpTopicRecord, query: string, keywords: readonly string[]): number {
  const title = normalizeForSearch(topic.title);
  const summary = normalizeForSearch(topic.summary);
  const body = normalizeForSearch(topic.bodyMarkdown);
  const tags = topic.tags.map((tag) => normalizeForSearch(tag));
  let score = trigramSimilarity(query, topic.title) * 2;
  if (title.includes(normalizeForSearch(query))) score += 3;
  for (const keyword of keywords) {
    if (title.includes(keyword)) score += 2;
    if (tags.some((tag) => tag.includes(keyword))) score += 1.5;
    if (summary.includes(keyword)) score += 1;
    if (body.includes(keyword)) score += 0.5;
  }
  return score + Math.min(topic.helpfulCount, 50) / 100;
}

export async function searchPublishedTopics(store: HelpContentStore, query: string, locale: string, categoryId: string | undefined, limit = searchResultLimit): Promise<HelpTopicRecord[]> {
  const keywords = extractKeywords(query);
  if (keywords.length === 0) return [];
  const candidates = await store.findTopicCandidates(keywords, locale, ["published"], 200);
  return candidates
    .filter((topic) => categoryId === undefined || topic.categoryId === categoryId)
    .map((topic) => ({ topic, score: scoreTopicForQuery(topic, query, keywords) }))
    .filter((entry) => entry.score >= 1)
    .sort((first, second) => second.score - first.score || first.topic.title.localeCompare(second.topic.title))
    .slice(0, limit)
    .map((entry) => entry.topic);
}
