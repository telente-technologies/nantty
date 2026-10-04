import type { HelpAnswerDraft } from "../../../interfaces/helpAnswerWriter.interface.js";
import type { HelpTopicRecord } from "../../../types/helpContent.type.js";
import { extractKeywords, jaccardSimilarity, trigramSimilarity } from "../../../utils/textSimilarity.util.js";

export function scoreTopicSimilarity(first: string, second: string): number {
  return 0.6 * trigramSimilarity(first, second) + 0.4 * jaccardSimilarity(extractKeywords(first), extractKeywords(second));
}

export function relatedQuestionHeadings(markdown: string): string[] {
  return [...markdown.matchAll(/^## Related question:\s*(.+)$/gm)].map((match) => (match[1] ?? "").trim()).filter(Boolean);
}

export function scoreDraftAgainstTopic(draft: Pick<HelpAnswerDraft, "title" | "question" | "tags">, topic: HelpTopicRecord): number {
  const titleScore = Math.max(scoreTopicSimilarity(draft.title, topic.title), ...relatedQuestionHeadings(topic.bodyMarkdown).map((heading) => scoreTopicSimilarity(draft.title, heading)));
  const draftWords = extractKeywords(`${draft.title} ${draft.question} ${draft.tags.join(" ")}`);
  const topicWords = extractKeywords(`${topic.title} ${topic.summary} ${topic.tags.join(" ")}`);
  return Math.min(1, Math.max(titleScore, 0.7 * titleScore + 0.3 * jaccardSimilarity(draftWords, topicWords)));
}

export function rankTopicsBySimilarity(draft: Pick<HelpAnswerDraft, "title" | "question" | "tags">, topics: readonly HelpTopicRecord[]): { readonly topic: HelpTopicRecord; readonly score: number }[] {
  return topics
    .filter((topic) => topic.status === "published")
    .map((topic) => ({ topic, score: Math.round(scoreDraftAgainstTopic(draft, topic) * 1000) / 1000 }))
    .sort((first, second) => second.score - first.score || first.topic.slug.localeCompare(second.topic.slug));
}
