import { readProductIdFromSlug } from "@/config/webAppLinks.config";
import type { SharedContentKind, SharedContentReference } from "@/types";

const INTERNAL_HOSTS = ["zudomart.app", "www.zudomart.app", "zudomart.com", "www.zudomart.com", "app.zudomart.com"];
const URL_PATTERN = /https?:\/\/[^\s<>"']+/gi;
const INTERNAL_PATH_KINDS: Record<string, SharedContentKind> = { product: "product", products: "product", post: "post", posts: "post", p: "product", clip: "clip", clips: "clip", u: "profile", live: "live", lives: "live", store: "store", stores: "store" };
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
  const segments = url.pathname.split("/").filter(Boolean);
  const [pathKind, id] = segments;
  if (segments.length === 1 && pathKind && /^@?[A-Za-z0-9._]{3,30}$/.test(pathKind) && !INTERNAL_PATH_KINDS[pathKind]) return { kind: "profile", id: pathKind.replace(/^@/, "") };
  const kind = pathKind ? INTERNAL_PATH_KINDS[pathKind] : undefined;
  if (!kind || !id) return null;
  return { kind, id: pathKind === "p" ? readProductIdFromSlug(id) : decodeURIComponent(id) };
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

export const isWebUrl = (rawUrl: string): boolean => {
  const protocol = parseUrl(rawUrl)?.protocol;
  return protocol === "http:" || protocol === "https:";
};

export const assessLinkRisk = (rawUrl: string): LinkRisk => {
  const hostname = parseUrl(rawUrl)?.hostname.toLowerCase();
  if (!hostname || !isWebUrl(rawUrl)) return "suspicious";
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
      return profileUserId ? ({ name: "UserProfile", params: { userId: profileUserId } } as const) : ({ name: "UserProfileByUsername", params: { username: reference.id } } as const);
    default:
      return { name: "PostDetail", params: { postId: reference.id } } as const;
  }
};
