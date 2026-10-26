const urlInTextPattern = /https?:\/\/[^\s<>"'`]+/gi;
const trackingParameterPattern = /^(utm_[a-z]+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|igshid|si|ref_src|_hsenc|_hsmi)$/i;

export const defaultInternalHosts: readonly string[] = ["nantty.com", "zudomart.com", "app.zudomart.com", "zudomart.app"];

export function findUrlsInText(text: string): string[] {
  return (text.match(urlInTextPattern) ?? []).map((url) => url.replace(/[.,!?;:)\]}]+$/, ""));
}

function parseHttpUrl(rawUrl: string): URL | null {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function isInternalNanttyUrl(rawUrl: string, internalHosts: readonly string[] = defaultInternalHosts): boolean {
  const hostname = parseHttpUrl(rawUrl)?.hostname.toLowerCase().replace(/^www\./, "");
  return hostname !== undefined && internalHosts.some((host) => hostname === host || hostname.endsWith(`.${host}`));
}

export function findFirstExternalUrlInText(text: string, internalHosts: readonly string[] = defaultInternalHosts): string | null {
  return findUrlsInText(text).find((url) => parseHttpUrl(url) !== null && !isInternalNanttyUrl(url, internalHosts)) ?? null;
}

export function normalizeUrlForCache(rawUrl: string): string | null {
  const url = parseHttpUrl(rawUrl);
  if (url === null) return null;
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  if ((url.protocol === "http:" && url.port === "80") || (url.protocol === "https:" && url.port === "443")) url.port = "";
  for (const name of [...url.searchParams.keys()]) {
    if (trackingParameterPattern.test(name)) url.searchParams.delete(name);
  }
  url.searchParams.sort();
  const normalized = url.toString();
  return normalized.length > 2048 ? null : normalized;
}

export function readDisplayDomain(rawUrl: string): string {
  return parseHttpUrl(rawUrl)?.hostname.toLowerCase().replace(/^www\./, "") ?? rawUrl;
}
