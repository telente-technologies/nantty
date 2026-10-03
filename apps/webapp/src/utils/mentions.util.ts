import { maximumMentionsPerText, type MentionEntity, type UserMentionEntity } from "@/types/mentions.type";

const mentionQueryBeforeCaretPattern = /(^|\s)@([A-Za-z0-9._]{0,30})$/;
const usernameCharacterPattern = /[A-Za-z0-9._]/;

export interface ActiveMentionQuery {
  readonly query: string;
  readonly start: number;
}

export interface MentionDraft {
  readonly userId: string;
  readonly username: string;
}

export function findActiveMentionQuery(text: string, caretPosition: number): ActiveMentionQuery | null {
  const match = mentionQueryBeforeCaretPattern.exec(text.slice(0, caretPosition));
  if (!match) return null;
  return { query: match[2] ?? "", start: caretPosition - (match[2]?.length ?? 0) - 1 };
}

export function insertMentionAtQuery(text: string, activeQuery: ActiveMentionQuery, username: string): { text: string; caretPosition: number } {
  const queryEnd = activeQuery.start + 1 + activeQuery.query.length;
  const inserted = `@${username} `;
  return { text: `${text.slice(0, activeQuery.start)}${inserted}${text.slice(queryEnd)}`, caretPosition: activeQuery.start + inserted.length };
}

export function buildMentionEntitiesFromText(text: string, chosenMentions: readonly MentionDraft[]): UserMentionEntity[] {
  const userIdByUsername = new Map(chosenMentions.map((mention) => [mention.username.toLowerCase(), mention]));
  const entities: UserMentionEntity[] = [];
  const mentionPattern = /@([A-Za-z0-9._]{1,30})/g;
  for (const match of text.matchAll(mentionPattern)) {
    const start = match.index ?? 0;
    const previousCharacter = start > 0 ? text[start - 1]! : " ";
    if (usernameCharacterPattern.test(previousCharacter)) continue;
    const chosen = userIdByUsername.get(match[1]!.toLowerCase());
    if (!chosen) continue;
    entities.push({ userId: chosen.userId, username: chosen.username, start, length: match[0].length });
    if (entities.length >= maximumMentionsPerText) break;
  }
  return entities;
}

export interface TextSegment {
  readonly text: string;
  readonly mention: MentionEntity | null;
}

export function splitTextIntoMentionSegments(text: string, mentions: readonly MentionEntity[] | undefined): TextSegment[] {
  const validMentions = [...(mentions ?? [])]
    .filter((mention) => mention.start >= 0 && mention.length > 1 && mention.start + mention.length <= text.length && text[mention.start] === "@")
    .sort((first, second) => first.start - second.start)
    .slice(0, maximumMentionsPerText);
  const segments: TextSegment[] = [];
  let cursor = 0;
  for (const mention of validMentions) {
    if (mention.start < cursor) continue;
    if (mention.start > cursor) segments.push({ text: text.slice(cursor, mention.start), mention: null });
    segments.push({ text: text.slice(mention.start, mention.start + mention.length), mention });
    cursor = mention.start + mention.length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), mention: null });
  return segments;
}

export function countMentionsInText(text: string, chosenMentions: readonly MentionDraft[]): number {
  return buildMentionEntitiesFromText(text, chosenMentions).length;
}
