import type { InternalLinkKind, InternalLinkReference } from "@/types/linkPreview.type";

const urlInTextPattern = /https?:\/\/[^\s<>"'`]+/gi;
const internalPathKinds: Readonly<Record<string, InternalLinkKind>> = { p: "product", product: "product", products: "product", store: "store", stores: "store", live: "live", lives: "live", post: "post", posts: "post", u: "profile", user: "profile" };
const shortenerDomains = ["bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "cutt.ly", "rb.gy", "shorturl.at"];
const suspiciousTopLevelDomains = [".zip", ".mov", ".top", ".click", ".xyz", ".gq", ".tk"];

export type LinkRisk = "safe" | "shortened" | "suspicious";

function parseHttpUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

function readInternalHosts(): readonly string[] {
  const siteHost = parseHttpUrl(process.env.NEXT_PUBLIC_SITE_URL ?? "")?.hostname;
  return ["zudomart.com", "app.zudomart.com", "zudomart.app", ...(siteHost ? [siteHost] : [])];
}

export function findUrlsInText(text: string): string[] {
  return (text.match(urlInTextPattern) ?? []).map((url) => url.replace(/[.,!?;:)\]}]+$/, ""));
}

function readProductIdFromSlugSegment(segment: string): string {
  const uuid = segment.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i)?.[1];
  return uuid ?? segment.slice(segment.lastIndexOf("-") + 1);
}

export function readInternalReferenceFromUrl(rawUrl: string): InternalLinkReference | null {
  const url = parseHttpUrl(rawUrl);
  const hostname = url?.hostname.toLowerCase().replace(/^www\./, "");
  if (!url || !hostname || !readInternalHosts().includes(hostname)) return null;
  const segments = url.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  if (segments.length === 1 && /^@?[A-Za-z0-9._]{3,30}$/.test(segments[0]!)) return { kind: "profile", id: segments[0]!.replace(/^@/, "") };
  const kind = segments[0] ? internalPathKinds[segments[0]] : undefined;
  if (!kind || !segments[1]) return null;
  return { kind, id: segments[0] === "p" ? readProductIdFromSlugSegment(segments[1]) : segments[1] };
}

export function findFirstInternalReference(text: string): InternalLinkReference | null {
  for (const url of findUrlsInText(text)) {
    const reference = readInternalReferenceFromUrl(url);
    if (reference) return reference;
  }
  return null;
}

export function findFirstExternalUrl(text: string): string | null {
  return findUrlsInText(text).find((url) => parseHttpUrl(url) !== null && readInternalReferenceFromUrl(url) === null) ?? null;
}

export function readDisplayDomain(rawUrl: string): string {
  return parseHttpUrl(rawUrl)?.hostname.replace(/^www\./, "") ?? rawUrl;
}

export function assessLinkRisk(rawUrl: string): LinkRisk {
  const hostname = parseHttpUrl(rawUrl)?.hostname.toLowerCase();
  if (!hostname) return "suspicious";
  if (shortenerDomains.includes(hostname)) return "shortened";
  const looksSuspicious = /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.includes("xn--") || suspiciousTopLevelDomains.some((suffix) => hostname.endsWith(suffix)) || hostname.split(".").length > 4;
  return looksSuspicious ? "suspicious" : "safe";
}
