import type { Post, QuotedPostSummary } from "@/types";

const POST_LINK_HOSTS = ["zudomart.com", "www.zudomart.com", "app.zudomart.com", "zudomart.app", "www.zudomart.app"];
const POST_PATH_KINDS = ["post", "posts", "clip", "clips"];
const COMMENT_QUERY_KEYS = ["comment", "commentid", "reply"];
const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const TRAILING_PUNCTUATION = /[.,!?;:)\]}'"]+$/;
const POST_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export interface PostLinkInText {
  readonly postId: string;
  readonly url: string;
}

export function readPostIdFromLink(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.port) return null;
  if (!POST_LINK_HOSTS.includes(url.hostname.toLowerCase())) return null;
  for (const key of url.searchParams.keys()) if (COMMENT_QUERY_KEYS.includes(key.toLowerCase())) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2 || !POST_PATH_KINDS.includes((segments[0] ?? "").toLowerCase())) return null;
  let id: string;
  try {
    id = decodeURIComponent(segments[1] ?? "");
  } catch {
    return null;
  }
  return POST_ID_PATTERN.test(id) ? id : null;
}

export function findFirstPostLinkInText(text: string): PostLinkInText | null {
  for (const match of text.match(URL_PATTERN) ?? []) {
    const url = match.replace(TRAILING_PUNCTUATION, "");
    const postId = readPostIdFromLink(url);
    if (postId) return { postId, url };
  }
  return null;
}

export function quotedSummaryFromPost(post: Post): QuotedPostSummary {
  const first = post.media[0];
  const thumbnailUrl = first ? (first.type === "video" ? first.posterUrl : (first.url ?? first.posterUrl)) : null;
  return {
    id: post.id,
    kind: post.kind,
    author: post.author,
    text: post.text,
    thumbnail: first && thumbnailUrl ? { type: first.type, url: thumbnailUrl, blurhash: first.blurhash ?? null } : null,
    mediaCount: post.media.length,
    createdAt: post.createdAt,
  };
}
