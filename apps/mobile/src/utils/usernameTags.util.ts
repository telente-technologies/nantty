export interface UsernameTagMatch {
  readonly start: number;
  readonly length: number;
  readonly username: string;
}

const USERNAME_TAG_PATTERN = /(^|[\s([{<"'“‘,;!?])@([A-Za-z0-9._]{1,30})(?![A-Za-z0-9_@])/g;
const TRAILING_DOTS = /\.+$/;

export const findUsernameTags = (text: string): readonly UsernameTagMatch[] => {
  if (!text.includes("@")) return [];
  const matches: UsernameTagMatch[] = [];
  for (const match of text.matchAll(USERNAME_TAG_PATTERN)) {
    const username = match[2]!.replace(TRAILING_DOTS, "");
    if (!username || username.toLowerCase() === "all") continue;
    matches.push({ start: match.index + match[1]!.length, length: username.length + 1, username });
  }
  return matches;
};

export interface TaggedTextSegment<TEntity> {
  readonly text: string;
  readonly entity: TEntity | null;
  readonly username: string | null;
}

interface PositionedEntity {
  readonly start: number;
  readonly length: number;
}

export const splitTextByTags = <TEntity extends PositionedEntity>(text: string, entities: readonly TEntity[] | undefined): readonly TaggedTextSegment<TEntity>[] => {
  const covered = [...(entities ?? [])]
    .filter((entity) => entity.start >= 0 && entity.length > 0 && entity.start + entity.length <= text.length)
    .sort((a, b) => a.start - b.start);
  const spans: { start: number; end: number; entity: TEntity | null; username: string | null }[] = [];
  let cursor = 0;
  for (const entity of covered) {
    if (entity.start < cursor) continue;
    spans.push({ start: entity.start, end: entity.start + entity.length, entity, username: null });
    cursor = entity.start + entity.length;
  }
  for (const tag of findUsernameTags(text)) {
    const end = tag.start + tag.length;
    if (spans.some((span) => tag.start < span.end && end > span.start)) continue;
    spans.push({ start: tag.start, end, entity: null, username: tag.username });
  }
  spans.sort((a, b) => a.start - b.start);
  const segments: TaggedTextSegment<TEntity>[] = [];
  let position = 0;
  for (const span of spans) {
    if (span.start > position) segments.push({ text: text.slice(position, span.start), entity: null, username: null });
    segments.push({ text: text.slice(span.start, span.end), entity: span.entity, username: span.username });
    position = span.end;
  }
  if (position < text.length) segments.push({ text: text.slice(position), entity: null, username: null });
  return segments;
};
