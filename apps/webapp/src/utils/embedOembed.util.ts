import { escapeHtml } from "./embedMarkup.util";
import { readProductIdFromSlug } from "./seoPaths.util";

export interface OembedTarget {
  readonly kind: "store" | "product";
  readonly id: string;
}

const knownSiteHosts = new Set(["nantty.com", "www.nantty.com", "web.nantty.com", "creator.nantty.com", "ads.nantty.com", "zudomart.com", "www.zudomart.com", "app.zudomart.com"]);

export function readOembedTarget(rawUrl: string | null, siteOrigin: string): OembedTarget | null {
  if (rawUrl === null || rawUrl.length > 2048) return null;
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }
  const allowedHosts = new Set([...knownSiteHosts, new URL(siteOrigin).host]);
  if (!["https:", "http:"].includes(parsed.protocol) || !allowedHosts.has(parsed.host)) return null;
  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length !== 2) return null;
  const [section = "", value = ""] = segments;
  if (section === "store" && /^[A-Za-z0-9_.~-]{1,100}$/.test(value)) return { kind: "store", id: value };
  if (section === "p") {
    const productId = readProductIdFromSlug(value);
    return productId === null ? null : { kind: "product", id: productId };
  }
  return null;
}

export function readOembedDimension(value: string | null, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, minimum), maximum) : fallback;
}

export function buildOembedIframeHtml(frameUrl: string, width: number, height: number, title: string): string {
  return `<iframe src="${escapeHtml(frameUrl)}" width="${width}" height="${height}" title="${escapeHtml(title)}" style="border:0;max-width:100%" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"></iframe>`;
}
