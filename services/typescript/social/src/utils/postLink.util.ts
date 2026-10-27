export const nanttyPostLinkHosts: readonly string[] = ["nantty.com", "www.nantty.com", "app.nantty.com", "nantty.com", "www.nantty.com", "app.nantty.com", "nantty.app", "www.nantty.app"];

/** @deprecated Use nanttyPostLinkHosts; legacy links remain accepted. */
export const nanttyPostLinkHosts = nanttyPostLinkHosts;

const urlPattern = /https?:\/\/[^\s<>"']+/gi;
const trailingPunctuationPattern = /[.,!?;:)\]}'"]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const postPathKinds = new Set(["post", "posts", "clip", "clips"]);
const commentQueryKeys = ["comment", "commentid", "reply"];

export interface PostLinkMatch {
  readonly postId: string;
  readonly url: string;
  readonly start: number;
  readonly end: number;
}

export function readPostIdFromUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username !== "" || url.password !== "" || url.port !== "") return null;
  if (!nanttyPostLinkHosts.includes(url.hostname.toLowerCase())) return null;
  if ([...url.searchParams.keys()].some((key) => commentQueryKeys.includes(key.toLowerCase()))) return null;
  const segments = url.pathname.split("/").filter((segment) => segment !== "");
  if (segments.length !== 2) return null;
  const [kind, id] = segments as [string, string];
  if (!postPathKinds.has(kind.toLowerCase())) return null;
  let decoded: string;
  try {
    decoded = decodeURIComponent(id);
  } catch {
    return null;
  }
  return uuidPattern.test(decoded) ? decoded.toLowerCase() : null;
}

export function findFirstPostLink(text: string): PostLinkMatch | null {
  for (const match of text.matchAll(urlPattern)) {
    const url = match[0].replace(trailingPunctuationPattern, "");
    const postId = readPostIdFromUrl(url);
    if (postId === null) continue;
    const start = match.index ?? 0;
    return { postId, url, start, end: start + url.length };
  }
  return null;
}

export function stripTrailingPostLink(text: string, link: PostLinkMatch): string {
  if (text.slice(link.end).trim() !== "") return text;
  return text.slice(0, link.start).trimEnd();
}
