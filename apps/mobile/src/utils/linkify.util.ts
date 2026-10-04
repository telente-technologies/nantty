export interface LinkifiedSegment {
  readonly text: string;
  readonly href: string | null;
}

const URL_IN_TEXT = /(?:https?:\/\/|www\.)[^\s<>"'`]+/gi;
const TRAILING_PUNCTUATION = /[.,!?;:'"*_~]+$/;
const ALLOWED_PRECEDING = /[\s([{<"'“‘,;!?]/;

const countOf = (text: string, character: string) => text.split(character).length - 1;

const trimTrailingPunctuation = (raw: string) => {
  let url = raw.replace(TRAILING_PUNCTUATION, "");
  while (url.endsWith(")") && countOf(url, "(") < countOf(url, ")")) url = url.slice(0, -1).replace(TRAILING_PUNCTUATION, "");
  return url;
};

export const normaliseLinkHref = (raw: string): string | null => {
  const candidate = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".") || url.hostname.endsWith(".")) return null;
    return candidate;
  } catch {
    return null;
  }
};

export const containsLink = (text: string) => /https?:\/\/|www\./i.test(text);

export const splitTextByUrls = (text: string): readonly LinkifiedSegment[] => {
  if (!containsLink(text)) return [{ text, href: null }];
  const segments: LinkifiedSegment[] = [];
  let position = 0;
  for (const match of text.matchAll(URL_IN_TEXT)) {
    const start = match.index;
    if (start > 0 && !ALLOWED_PRECEDING.test(text[start - 1]!) && !/^https?:/i.test(match[0])) continue;
    const display = trimTrailingPunctuation(match[0]);
    const href = display ? normaliseLinkHref(display) : null;
    if (!href) continue;
    if (start > position) segments.push({ text: text.slice(position, start), href: null });
    segments.push({ text: display, href });
    position = start + display.length;
  }
  if (position < text.length) segments.push({ text: text.slice(position), href: null });
  return segments.length > 0 ? segments : [{ text, href: null }];
};
