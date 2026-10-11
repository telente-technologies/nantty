import { autoFaqDuplicateSectionThreshold, autoFaqMergeSimilarityThreshold, autoFaqRequiresReviewSettingKey, defaultLocale, fromResolvedQuestionLabel } from "../../../constants/support.constant.js";
import { helpCategorySlugByTicketCategory } from "../../../constants/helpCategories.constant.js";
import type { AutoTopicAction } from "../../../enums/helpTopic.enum.js";
import type { HelpAnswerDraft, HelpAnswerWriter } from "../../../interfaces/helpAnswerWriter.interface.js";
import type { HelpContentStore } from "../../../interfaces/helpContentStore.interface.js";
import type { HelpTopicRecord } from "../../../types/helpContent.type.js";
import type { TicketWithThread } from "../../../types/ticket.type.js";
import { neutraliseOffsiteMarkdownLinks } from "../../../utils/markdownLinks.util.js";
import { slugify } from "../../../utils/slug.util.js";
import { extractKeywords } from "../../../utils/textSimilarity.util.js";
import { findResidualPersonalData, scrubPersonalData, type ScrubContext } from "./personalDataScrubber.service.js";
import { draftHelpAnswerFromTemplate } from "./templateHelpAnswerWriter.service.js";
import { rankTopicsBySimilarity, relatedQuestionHeadings, scoreTopicSimilarity } from "./topicSimilarity.service.js";

export interface AutoFaqOutcome {
  readonly action: AutoTopicAction;
  readonly topicId: string | null;
  readonly similarity: number;
  readonly writer: string;
  readonly note: string;
}

export interface AutoFaqPublisherDependencies {
  readonly helpStore: HelpContentStore;
  readonly writer: HelpAnswerWriter;
}

const autoEditorName = "Zudomart Help";
const ticketReference = (ticket: TicketWithThread) => `SUP-${ticket.number}`;

function scrubContextFor(ticket: TicketWithThread): ScrubContext {
  const names = new Set<string>([ticket.requesterName, ...(ticket.assigneeName === null ? [] : [ticket.assigneeName])]);
  for (const message of ticket.messages) if (message.authorKind !== "system") names.add(message.authorName);
  names.delete("Zudomart Support");
  return { knownNames: [...names].filter((name) => name.trim() !== ""), knownUsernames: ticket.requesterUsername === "" ? [] : [ticket.requesterUsername] };
}

function scrubDraft(draft: HelpAnswerDraft, context: ScrubContext): HelpAnswerDraft {
  const clean = (text: string) => neutraliseOffsiteMarkdownLinks(scrubPersonalData(text, context).text);
  return { ...draft, title: clean(draft.title), summary: clean(draft.summary), question: clean(draft.question), answerMarkdown: clean(draft.answerMarkdown), tags: draft.tags.map(clean).filter((tag) => !tag.includes("[")) };
}

export function extractAnswerSection(markdown: string): string {
  const match = /## The answer\s*\n([\s\S]*?)(?=\n## |$)/.exec(markdown);
  return (match?.[1] ?? markdown).trim();
}

export class AutoFaqPublisher {
  public constructor(private readonly dependencies: AutoFaqPublisherDependencies) {}

  public async publishFromResolvedTicket(ticket: TicketWithThread): Promise<AutoFaqOutcome> {
    const outcome = await this.decide(ticket);
    await this.dependencies.helpStore.createAutoTopicLog({ ticketId: ticket.id, ticketRef: ticketReference(ticket), topicId: outcome.topicId, action: outcome.action, similarity: outcome.similarity, writer: outcome.writer, note: outcome.note });
    return outcome;
  }

  private async decide(ticket: TicketWithThread): Promise<AutoFaqOutcome> {
    const skip = (note: string): AutoFaqOutcome => ({ action: "skipped", topicId: null, similarity: 0, writer: "none", note });
    if (ticket.category === "safety") return skip("Safety tickets never become public topics.");
    const customerText = ticket.messages.filter((message) => message.authorKind === "customer").slice(0, 3).map((message) => message.body).join("\n");
    const agentText = ticket.messages.filter((message) => message.authorKind === "agent").map((message) => message.body).join("\n");
    if (customerText.trim().length < 10 || agentText.trim().length < 20) return skip("Needs a customer question and a staff answer.");
    const context = scrubContextFor(ticket);
    const scrubbed = { subject: scrubPersonalData(ticket.subject, context).text, question: scrubPersonalData(customerText, context).text, answer: scrubPersonalData(agentText, context).text };
    const inputResidue = findResidualPersonalData(`${scrubbed.subject}\n${scrubbed.question}\n${scrubbed.answer}`);
    const input = { category: ticket.category, locale: defaultLocale, ...scrubbed };
    const written = inputResidue.length === 0 ? await this.dependencies.writer.writeHelpAnswer(input) : null;
    const draft = scrubDraft(written ?? draftHelpAnswerFromTemplate(input), context);
    const outputResidue = findResidualPersonalData(`${draft.title}\n${draft.summary}\n${draft.answerMarkdown}`);
    const requiresReview = (await this.dependencies.helpStore.readSetting(autoFaqRequiresReviewSettingKey, false)) || inputResidue.length > 0 || outputResidue.length > 0;
    const residueNote = [...inputResidue, ...outputResidue].length > 0 ? `Possible personal data left (${[...new Set([...inputResidue, ...outputResidue])].join(", ")}); held for review.` : "";
    const candidates = await this.dependencies.helpStore.findTopicCandidates(extractKeywords(`${draft.title} ${draft.question}`).slice(0, 8), defaultLocale, ["published"], 40);
    const ranked = rankTopicsBySimilarity(draft, candidates);
    const best = ranked[0];
    if (best !== undefined && best.score >= autoFaqMergeSimilarityThreshold && !requiresReview) return this.appendRelatedQuestion(best.topic, best.score, draft, ticket);
    return this.createTopic(ticket, draft, requiresReview, ranked.filter((entry) => entry.score >= 0.2).slice(0, 3).map((entry) => entry.topic.id), best?.score ?? 0, residueNote);
  }

  private async appendRelatedQuestion(topic: HelpTopicRecord, similarity: number, draft: HelpAnswerDraft, ticket: TicketWithThread): Promise<AutoFaqOutcome> {
    const existingQuestions = [topic.title, ...relatedQuestionHeadings(topic.bodyMarkdown)];
    if (existingQuestions.some((question) => scoreTopicSimilarity(draft.title, question) >= autoFaqDuplicateSectionThreshold)) {
      return { action: "skipped", topicId: topic.id, similarity, writer: draft.writer, note: "Already answered by this topic." };
    }
    const section = [`## Related question: ${draft.title}`, extractAnswerSection(draft.answerMarkdown), `*${fromResolvedQuestionLabel}*`].join("\n\n");
    await this.dependencies.helpStore.updateTopic(topic.id, {
      bodyMarkdown: `${topic.bodyMarkdown.trimEnd()}\n\n${section}`,
      tags: [...new Set([...topic.tags, ...draft.tags])].slice(0, 12),
      editorName: autoEditorName,
      changeNote: `Related question added from ${ticketReference(ticket)}`,
      markEditedByStaff: false,
      relatedQuestionsIncrement: 1,
    });
    return { action: "appended", topicId: topic.id, similarity, writer: draft.writer, note: `Added as a related question to "${topic.title}".` };
  }

  private async createTopic(ticket: TicketWithThread, draft: HelpAnswerDraft, requiresReview: boolean, relatedTopicIds: readonly string[], similarity: number, note: string): Promise<AutoFaqOutcome> {
    const store = this.dependencies.helpStore;
    const category = (await store.findCategoryBySlug(helpCategorySlugByTicketCategory[ticket.category])) ?? (await store.listCategories())[0];
    if (category === undefined) return { action: "skipped", topicId: null, similarity, writer: draft.writer, note: "No help category exists yet." };
    const baseSlug = slugify(draft.title);
    let slug = baseSlug;
    for (let suffix = 2; (await store.findTopicBySlug(slug, defaultLocale)) !== null; suffix += 1) slug = `${baseSlug}-${suffix}`;
    const topic = await store.createTopic({
      categoryId: category.id, slug, locale: defaultLocale, title: draft.title, summary: draft.summary, bodyMarkdown: draft.answerMarkdown, tags: draft.tags,
      status: requiresReview ? "pending_review" : "published", origin: "resolved_question", sourceTicketId: ticket.id, seedKey: null, seedHash: null,
      editorName: autoEditorName, relatedTopicIds,
    });
    return { action: requiresReview ? "pending_review" : "created", topicId: topic.id, similarity, writer: draft.writer, note: note || (requiresReview ? "Waiting for an admin to review." : "Published automatically.") };
  }
}
