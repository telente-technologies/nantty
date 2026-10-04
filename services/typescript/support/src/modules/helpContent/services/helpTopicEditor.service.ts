import { defaultLocale } from "../../../constants/support.constant.js";
import { badRequest, conflict, notFound } from "../../../errors/support.error.js";
import type { HelpContentStore } from "../../../interfaces/helpContentStore.interface.js";
import type { HelpTopicRecord } from "../../../types/helpContent.type.js";
import { slugify } from "../../../utils/slug.util.js";
import { assertSafeMarkdown } from "../validators/helpContent.validator.js";

export interface TopicEditorInput {
  readonly categoryId: string;
  readonly slug?: string;
  readonly title: string;
  readonly summary?: string;
  readonly bodyMarkdown: string;
  readonly tags?: readonly string[];
  readonly relatedTopicIds?: readonly string[];
  readonly status?: "DRAFT" | "PUBLISHED";
  readonly changeNote?: string;
}

const stillNeedHelpSection = /\n## Still need help\?[\s\S]*?(?=\n## |$)/;

function firstSentence(markdown: string): string {
  const text = markdown.replace(/^#+\s.*$/gm, "").replace(/[*_`>#-]/g, "").replace(/\s+/g, " ").trim();
  const sentence = /^(.{20,200}?[.!?])(\s|$)/.exec(text)?.[1] ?? text.slice(0, 160);
  return sentence;
}

export function createHelpTopicEditor(store: HelpContentStore) {
  const ensureCategory = async (categoryId: string) => {
    if ((await store.findCategoryById(categoryId)) === null) throw badRequest("VALIDATION_FAILED", "Choose an existing category.");
  };
  const ensureSlugFree = async (slug: string, exceptTopicId?: string) => {
    const existing = await store.findTopicBySlug(slug, defaultLocale);
    if (existing !== null && existing.id !== exceptTopicId) throw conflict("SLUG_TAKEN", "Another topic already uses this address.");
  };
  return {
    async create(input: TopicEditorInput, editorName: string): Promise<HelpTopicRecord> {
      assertSafeMarkdown(input.bodyMarkdown);
      await ensureCategory(input.categoryId);
      const slug = input.slug ?? slugify(input.title);
      await ensureSlugFree(slug);
      return store.createTopic({
        categoryId: input.categoryId, slug, locale: defaultLocale, title: input.title, summary: input.summary || firstSentence(input.bodyMarkdown), bodyMarkdown: input.bodyMarkdown,
        tags: input.tags ?? [], status: input.status === "PUBLISHED" ? "published" : "draft", origin: "editorial", sourceTicketId: null, seedKey: null, seedHash: null,
        editorName, relatedTopicIds: input.relatedTopicIds ?? [],
      });
    },
    async update(topicId: string, input: TopicEditorInput, editorName: string): Promise<HelpTopicRecord> {
      assertSafeMarkdown(input.bodyMarkdown);
      await ensureCategory(input.categoryId);
      if (input.slug !== undefined) await ensureSlugFree(input.slug, topicId);
      const updated = await store.updateTopic(topicId, {
        categoryId: input.categoryId, ...(input.slug === undefined ? {} : { slug: input.slug }), title: input.title, summary: input.summary || firstSentence(input.bodyMarkdown),
        bodyMarkdown: input.bodyMarkdown, ...(input.tags === undefined ? {} : { tags: input.tags }), ...(input.relatedTopicIds === undefined ? {} : { relatedTopicIds: input.relatedTopicIds }),
        editorName, changeNote: input.changeNote ?? "Edited", markEditedByStaff: true,
      });
      if (updated === null) throw notFound("Help topic");
      if (input.status === "PUBLISHED" && updated.status !== "published") return (await store.setTopicStatus(topicId, "published", editorName)) ?? updated;
      return updated;
    },
    async setStatus(topicId: string, status: "published" | "unpublished", editorName: string): Promise<HelpTopicRecord> {
      const topic = await store.findTopicById(topicId);
      if (topic === null) throw notFound("Help topic");
      if (topic.status === "merged") throw conflict("TOPIC_MERGED", "This topic was merged into another topic.");
      if (topic.status === status) throw conflict("NO_CHANGE", `This topic is already ${status}.`);
      return (await store.setTopicStatus(topicId, status, editorName)) ?? topic;
    },
    async merge(sourceTopicId: string, targetTopicId: string, editorName: string): Promise<HelpTopicRecord> {
      if (sourceTopicId === targetTopicId) throw badRequest("VALIDATION_FAILED", "Choose a different topic to merge into.");
      const [source, target] = await Promise.all([store.findTopicById(sourceTopicId), store.findTopicById(targetTopicId)]);
      if (source === null || target === null) throw notFound("Help topic");
      if (source.status === "merged" || target.status === "merged") throw conflict("TOPIC_MERGED", "Merged topics cannot be merged again.");
      const section = `## Related question: ${source.title}\n\n${source.bodyMarkdown.replace(stillNeedHelpSection, "").replace(/^## The question[\s\S]*?(?=\n## The answer)/, "").replace(/^\s*## The answer\s*\n/, "").trim()}`;
      const updated = await store.updateTopic(target.id, {
        bodyMarkdown: `${target.bodyMarkdown.trimEnd()}\n\n${section}`, tags: [...new Set([...target.tags, ...source.tags])].slice(0, 12), editorName,
        changeNote: `Merged "${source.title}"`, markEditedByStaff: true, relatedQuestionsIncrement: 1,
      });
      await store.setTopicStatus(source.id, "merged", editorName, target.id);
      return updated ?? target;
    },
  };
}
