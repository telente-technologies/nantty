import type { MentionDraft, MentionEntity, UserMentionEntity } from "@/types/mention.type";

export const MAXIMUM_MENTIONS_PER_CONTENT = 20;
export const MENTION_QUERY_PATTERN = /(^|\s)@([A-Za-z0-9._]{0,30})$/;

export interface ActiveMentionQuery {
  readonly atIndex: number;
  readonly query: string;
}

export interface MentionTokenToInsert {
  readonly label: string;
  readonly entityWithoutPosition: { readonly userId: string; readonly username: string } | { readonly type: "all" };
}

export interface MentionEditResult {
  readonly text: string;
  readonly mentions: readonly MentionEntity[];
  readonly caretPosition: number;
}

export interface MentionTextSegment {
  readonly text: string;
  readonly mention: MentionEntity | null;
}

export const isAllMention = (entity: MentionEntity): entity is Extract<MentionEntity, { type: "all" }> => "type" in entity && entity.type === "all";

export const isUserMention = (entity: MentionEntity): entity is UserMentionEntity => !isAllMention(entity);

export const findActiveMentionQuery = (text: string, caretPosition: number): ActiveMentionQuery | null => {
  const textBeforeCaret = text.slice(0, caretPosition);
  const match = MENTION_QUERY_PATTERN.exec(textBeforeCaret);
  if (!match) return null;
  return { atIndex: caretPosition - match[2]!.length - 1, query: match[2]! };
};

export const keepEntitiesMatchingEditedText = (previousText: string, nextText: string, mentions: readonly MentionEntity[]): readonly MentionEntity[] => {
  if (previousText === nextText) return mentions;
  const maximumPrefix = Math.min(previousText.length, nextText.length);
  let prefixLength = 0;
  while (prefixLength < maximumPrefix && previousText[prefixLength] === nextText[prefixLength]) prefixLength += 1;
  let suffixLength = 0;
  while (
    suffixLength < maximumPrefix - prefixLength &&
    previousText[previousText.length - 1 - suffixLength] === nextText[nextText.length - 1 - suffixLength]
  ) {
    suffixLength += 1;
  }
  const lengthChange = nextText.length - previousText.length;
  const editedRegionEndInPrevious = previousText.length - suffixLength;
  return mentions.flatMap((entity) => {
    if (entity.start + entity.length <= prefixLength) return [entity];
    if (entity.start >= editedRegionEndInPrevious) return [{ ...entity, start: entity.start + lengthChange }];
    return [];
  });
};

export const insertMentionToken = (
  text: string,
  mentions: readonly MentionEntity[],
  activeQuery: ActiveMentionQuery,
  caretPosition: number,
  token: MentionTokenToInsert,
): MentionEditResult => {
  const insertedText = `@${token.label} `;
  const nextText = text.slice(0, activeQuery.atIndex) + insertedText + text.slice(caretPosition);
  const lengthChange = insertedText.length - (caretPosition - activeQuery.atIndex);
  const shifted = mentions.map((entity) => (entity.start >= caretPosition ? { ...entity, start: entity.start + lengthChange } : entity));
  const created = { ...token.entityWithoutPosition, start: activeQuery.atIndex, length: token.label.length + 1 } as MentionEntity;
  return {
    text: nextText,
    mentions: [...shifted, created].sort((a, b) => a.start - b.start),
    caretPosition: activeQuery.atIndex + insertedText.length,
  };
};

export const splitTextByMentions = (text: string, mentions: readonly MentionEntity[] | undefined): readonly MentionTextSegment[] => {
  const ordered = [...(mentions ?? [])]
    .filter((entity) => entity.start >= 0 && entity.start + entity.length <= text.length)
    .sort((a, b) => a.start - b.start);
  const segments: MentionTextSegment[] = [];
  let cursor = 0;
  for (const entity of ordered) {
    if (entity.start < cursor) continue;
    if (entity.start > cursor) segments.push({ text: text.slice(cursor, entity.start), mention: null });
    segments.push({ text: text.slice(entity.start, entity.start + entity.length), mention: entity });
    cursor = entity.start + entity.length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), mention: null });
  return segments;
};

export const shiftMentionsAfterTrimmingStart = (text: string, mentions: readonly MentionEntity[]): MentionDraft => {
  const trimmedStartLength = text.length - text.trimStart().length;
  const trimmedText = text.trim();
  return {
    text: trimmedText,
    mentions: mentions
      .map((entity) => ({ ...entity, start: entity.start - trimmedStartLength }))
      .filter((entity) => entity.start >= 0 && entity.start + entity.length <= trimmedText.length),
  };
};
