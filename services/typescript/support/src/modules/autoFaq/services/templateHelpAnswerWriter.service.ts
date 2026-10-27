import type { HelpAnswerDraft, HelpAnswerDraftInput, HelpAnswerWriter } from "../../../interfaces/helpAnswerWriter.interface.js";
import { rankKeywordsByFrequency } from "../../../utils/textSimilarity.util.js";

const genericWordForPlaceholder: Readonly<Record<string, string>> = {
  "[link]": "a link", "[email]": "your email address", "[card number]": "your card", "[phone]": "your phone number", "[reference]": "the reference",
  "[order number]": "your order", "[amount]": "the amount", "[ip address]": "your device", "[date]": "that date", "[address]": "your address",
  "[username]": "the account", "[name]": "someone", "[number]": "the number",
};

const greetingLine = /^(?:hi|hello|hey|dear|good\s+(?:morning|afternoon|evening|day)|greetings)\b[^.!?\n]*[,.!]?\s*/i;
const signOffSentence = /(?:^|\s)(?:thanks|thank you|many thanks|regards|kind regards|best regards|cheers|sincerely)\b[^.!?]*(?:[.!?]|$)/gi;
const fillerSentence = /^(?:sorry for the (?:wait|delay)|thanks for (?:waiting|your patience|reaching out|contacting us)|i hope (?:you are|you're) well|apologies for the (?:wait|delay))[^.!?]*[.!?]?\s*/i;
const stepVerb = /^(?:go to|open|tap|click|select|choose|press|enter|type|upload|add|turn on|turn off|switch|scroll|find|sign in|log in|update|check|confirm)\b/i;

export function replacePlaceholdersWithGenericWords(text: string): string {
  return text.replace(/\[[a-z ]+\]/g, (placeholder) => genericWordForPlaceholder[placeholder] ?? "it").replace(/\bsomeone,?\s+(?=from (?:zudomart|nantty))/gi, "");
}

export function stripConversationalNoise(text: string): string {
  return text
    .split(/\n+/)
    .map((line) => line.replace(greetingLine, "").replace(fillerSentence, ""))
    .join("\n")
    .replace(signOffSentence, " ")
    .replace(/\bsomeone\b\s*$/i, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function splitSentences(text: string): string[] {
  return text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/).map((sentence) => sentence.trim()).filter((sentence) => sentence.length > 1);
}

function capitaliseFirst(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function clampAtWord(text: string, maximum: number): string {
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum).replace(/\s+\S*$/, "").replace(/[,;:]$/, "")}…`;
}

const interrogativeStart = /^(?:how|what|why|when|where|who|which|can|could|do|does|did|is|are|will|should|would|may)\b/i;

export function buildGeneralTitle(subject: string, question: string): string {
  const cleanQuestion = replacePlaceholdersWithGenericWords(stripConversationalNoise(question));
  const asked = splitSentences(cleanQuestion).find((sentence) => sentence.endsWith("?") && sentence.length <= 120 && sentence.split(" ").length >= 3);
  const cleanSubject = replacePlaceholdersWithGenericWords(subject).replace(/\s+/g, " ").trim().replace(/[.!]+$/, "");
  const chosen = asked ?? (interrogativeStart.test(cleanSubject) ? `${cleanSubject.replace(/\?*$/, "")}?` : cleanSubject);
  return clampAtWord(capitaliseFirst(chosen || "A question from our community"), 90);
}

function formatAnswerAsMarkdown(sentences: readonly string[]): string {
  const steps = sentences.filter((sentence) => stepVerb.test(sentence) || /\s>\s/.test(sentence));
  if (steps.length >= 2) {
    const intro = sentences.filter((sentence) => !steps.includes(sentence));
    return [...(intro.length > 0 ? [intro.join(" ")] : []), steps.map((step, index) => `${index + 1}. ${capitaliseFirst(step)}`).join("\n")].join("\n\n");
  }
  const paragraphs: string[] = [];
  for (let index = 0; index < sentences.length; index += 3) paragraphs.push(sentences.slice(index, index + 3).join(" "));
  return paragraphs.join("\n\n");
}

export function draftHelpAnswerFromTemplate(input: HelpAnswerDraftInput): HelpAnswerDraft {
  const question = replacePlaceholdersWithGenericWords(stripConversationalNoise(input.question));
  const answerSentences = splitSentences(replacePlaceholdersWithGenericWords(stripConversationalNoise(input.answer)));
  const title = buildGeneralTitle(input.subject, input.question);
  const summary = clampAtWord(answerSentences[0] ?? "Here is what our support team explained.", 160);
  const answerMarkdown = [
    "## The question",
    clampAtWord(question.replace(/\s+/g, " "), 600) || title,
    "## The answer",
    formatAnswerAsMarkdown(answerSentences) || summary,
    "## Still need help?",
    "If this does not solve it, open Help centre and choose Contact support. Tell us what you have already tried so we can help faster.",
  ].join("\n\n");
  return { title, summary, question: title, answerMarkdown, tags: rankKeywordsByFrequency(`${input.subject} ${question} ${answerSentences.join(" ")}`, 5), writer: "template" };
}

export const templateHelpAnswerWriter: HelpAnswerWriter = { writeHelpAnswer: async (input) => draftHelpAnswerFromTemplate(input) };
