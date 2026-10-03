import type { SharedContentKind, SharedContentReference } from "@/types";

const INTERNAL_HOSTS = ["zudomart.app", "www.zudomart.app", "zudomart.com", "www.zudomart.com"];
const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const INTERNAL_PATH_KINDS: Record<string, SharedContentKind> = { product: "product", products: "product", post: "post", posts: "post", p: "post", clip: "clip", clips: "clip", u: "profile", live: "live", lives: "live", store: "store", stores: "store" };
const KNOWN_SHORTENER_DOMAINS = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "cutt.ly", "rb.gy", "shorturl.at"];
const SUSPICIOUS_TOP_LEVEL_DOMAINS = [".zip", ".mov", ".top", ".click", ".xyz", ".gq", ".tk"];

export type LinkRisk = "safe" | "shortened" | "suspicious";

const parseUrl = (rawUrl: string): URL | null => {
  try {
    return new URL(rawUrl);
  } catch {
    return null;
  }
};

export const findUrlsInText = (text: string): string[] => (text.match(URL_PATTERN) ?? []).map((url) => url.replace(/[.,!?)]+$/, ""));

export const readInternalReferenceFromUrl = (rawUrl: string): SharedContentReference | null => {
  const url = parseUrl(rawUrl);
  if (!url || !INTERNAL_HOSTS.includes(url.hostname.toLowerCase())) return null;
  const [pathKind, id] = url.pathname.split("/").filter(Boolean);
  const kind = pathKind ? INTERNAL_PATH_KINDS[pathKind] : undefined;
  return kind && id ? { kind, id: decodeURIComponent(id) } : null;
};

export const findFirstExternalUrl = (text: string): string | null =>
  findUrlsInText(text).find((url) => !readInternalReferenceFromUrl(url) && !!parseUrl(url)) ?? null;

export const findFirstInternalReference = (text: string): SharedContentReference | null => {
  for (const url of findUrlsInText(text)) {
    const reference = readInternalReferenceFromUrl(url);
    if (reference) return reference;
  }
  return null;
};

export const readFullDomain = (rawUrl: string) => parseUrl(rawUrl)?.hostname.replace(/^www\./, "") ?? rawUrl;

export const assessLinkRisk = (rawUrl: string): LinkRisk => {
  const hostname = parseUrl(rawUrl)?.hostname.toLowerCase();
  if (!hostname) return "suspicious";
  if (KNOWN_SHORTENER_DOMAINS.includes(hostname)) return "shortened";
  const looksSuspicious =
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
    hostname.includes("xn--") ||
    SUSPICIOUS_TOP_LEVEL_DOMAINS.some((suffix) => hostname.endsWith(suffix)) ||
    hostname.split(".").length > 4;
  return looksSuspicious ? "suspicious" : "safe";
};

export const buildInternalRoute = (reference: SharedContentReference, profileUserId?: string | null) => {
  switch (reference.kind) {
    case "product":
      return { name: "ProductDetail", params: { productId: reference.id } } as const;
    case "store":
      return { name: "Store", params: { storeId: reference.id } } as const;
    case "live":
      return { name: "Live", params: { liveId: reference.id } } as const;
    case "profile":
      return { name: "UserProfile", params: { userId: profileUserId ?? reference.id } } as const;
    default:
      return { name: "PostDetail", params: { postId: reference.id } } as const;
  }
};
