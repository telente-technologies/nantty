import type { ParsedLinkMetadata } from "../models/linkPreview.model.js";

const metaTagPattern = /<meta\s[^>]*>/gi;
const linkTagPattern = /<link\s[^>]*>/gi;
const attributePattern = /([a-zA-Z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;
const namedEntities: Readonly<Record<string, string>> = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", "#39": "'" };

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z0-9]+);/gi, (match, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16) || 32);
    if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10) || 32);
    return namedEntities[lower] ?? match;
  });
}

function readAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of tag.matchAll(attributePattern)) {
    const name = match[1]?.toLowerCase();
    if (name !== undefined && !attributes.has(name)) attributes.set(name, match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function cleanText(value: string | undefined | null, maximumLength: number): string | null {
  if (value === undefined || value === null) return null;
  const decoded = decodeHtmlEntities(value);
  const text: string[] = [];
  let insideTag = false;
  for (let index = 0; index < decoded.length; index += 1) {
    const character = decoded[index];
    if (insideTag) {
      if (character === ">") insideTag = false;
      continue;
    }
    if (character === "<") {
      const next = decoded[index + 1];
      if (next !== undefined && /[A-Za-z/!?]/.test(next)) insideTag = true;
      continue;
    }
    if (character !== ">") text.push(character);
  }
  const cleaned = text.join("").replace(/\s+/g, " ").trim();
  if (cleaned === "") return null;
  return cleaned.length > maximumLength ? `${cleaned.slice(0, maximumLength - 1).trimEnd()}…` : cleaned;
}

export function resolveHttpUrl(value: string | null | undefined, baseUrl: URL): string | null {
  if (value === null || value === undefined || value.trim() === "") return null;
  try {
    const resolved = new URL(decodeHtmlEntities(value.trim()), baseUrl);
    return resolved.protocol === "http:" || resolved.protocol === "https:" ? resolved.toString() : null;
  } catch {
    return null;
  }
}

export function parseLinkPreviewMetadata(html: string, baseUrl: URL): ParsedLinkMetadata {
  const head = html.slice(0, 512 * 1024);
  const meta = new Map<string, string>();
  for (const tag of head.match(metaTagPattern) ?? []) {
    const attributes = readAttributes(tag);
    const key = (attributes.get("property") ?? attributes.get("name") ?? attributes.get("itemprop") ?? "").toLowerCase();
    const content = attributes.get("content");
    if (key !== "" && content !== undefined && !meta.has(key)) meta.set(key, content);
  }
  let oembedUrl: string | null = null;
  for (const tag of head.match(linkTagPattern) ?? []) {
    const attributes = readAttributes(tag);
    if ((attributes.get("type") ?? "").toLowerCase() === "application/json+oembed") {
      oembedUrl = resolveHttpUrl(attributes.get("href"), baseUrl);
      break;
    }
  }
  const documentTitle = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  return {
    title: cleanText(meta.get("og:title") ?? meta.get("twitter:title") ?? documentTitle, 200),
    description: cleanText(meta.get("og:description") ?? meta.get("twitter:description") ?? meta.get("description"), 300),
    siteName: cleanText(meta.get("og:site_name") ?? meta.get("application-name"), 80),
    imageUrl: resolveHttpUrl(meta.get("og:image:secure_url") ?? meta.get("og:image") ?? meta.get("og:image:url") ?? meta.get("twitter:image") ?? meta.get("twitter:image:src"), baseUrl),
    oembedUrl,
  };
}

export function parseOembedMetadata(json: unknown, baseUrl: URL): Pick<ParsedLinkMetadata, "title" | "siteName" | "imageUrl"> {
  const record = typeof json === "object" && json !== null ? (json as Record<string, unknown>) : {};
  const readString = (key: string) => (typeof record[key] === "string" ? (record[key] as string) : null);
  return {
    title: cleanText(readString("title") ?? readString("author_name"), 200),
    siteName: cleanText(readString("provider_name"), 80),
    imageUrl: resolveHttpUrl(readString("thumbnail_url"), baseUrl),
  };
}
