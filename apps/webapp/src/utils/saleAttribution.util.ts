export type SaleAttributionSource = "post" | "clip" | "live" | "link";

export interface SaleAttribution {
  readonly source: SaleAttributionSource;
  readonly id: string;
}

interface StoredSaleAttribution extends SaleAttribution {
  readonly expiresAt: number;
}

interface AttributionStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const storageKey = "zudomart.saleAttributions";
const defaultWindowMilliseconds = 30 * 86_400_000;
const maximumRememberedProducts = 50;
const attributionSources: readonly SaleAttributionSource[] = ["post", "clip", "live", "link"];

function browserStorage(): AttributionStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

function readAll(storage: AttributionStorage | null): Record<string, StoredSaleAttribution> {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(storageKey) ?? "{}");
    return parsed && typeof parsed === "object" ? (parsed as Record<string, StoredSaleAttribution>) : {};
  } catch {
    return {};
  }
}

export function rememberSaleAttribution(productId: string, attribution: SaleAttribution, expiresAt = Date.now() + defaultWindowMilliseconds, storage = browserStorage()): void {
  if (!storage || !productId || !attribution.id || !attributionSources.includes(attribution.source)) return;
  const now = Date.now();
  const all = readAll(storage);
  const current = all[productId];
  if (current && current.expiresAt > now && (current.source !== attribution.source || current.id !== attribution.id)) return;
  const kept = Object.entries(all).filter(([key, stored]) => key !== productId && stored.expiresAt > now).slice(-(maximumRememberedProducts - 1));
  try {
    storage.setItem(storageKey, JSON.stringify(Object.fromEntries([...kept, [productId, { source: attribution.source, id: attribution.id, expiresAt }]])));
  } catch {
    return;
  }
}

export function readSaleAttribution(productId: string, storage = browserStorage(), now = Date.now()): SaleAttribution | null {
  const stored = readAll(storage)[productId];
  if (!stored || stored.expiresAt <= now || !attributionSources.includes(stored.source) || typeof stored.id !== "string") return null;
  return { source: stored.source, id: stored.id };
}

export const attributionSourceForPostKind = (kind: string | null | undefined): SaleAttributionSource => (kind === "clip" ? "clip" : "post");

export function appendAffiliateParameter(path: string, affiliateLinkId: string | undefined): string {
  return affiliateLinkId && /^[A-Za-z0-9_-]{1,80}$/.test(affiliateLinkId) ? `${path}${path.includes("?") ? "&" : "?"}aff=${affiliateLinkId}` : path;
}

const visitorIdKey = "zudomart.visitorId";

export function readOrCreateVisitorId(storage = browserStorage()): string | null {
  try {
    const existing = storage?.getItem(visitorIdKey);
    if (existing && /^[A-Za-z0-9-]{8,80}$/.test(existing)) return existing;
    if (!storage || typeof crypto === "undefined" || typeof crypto.randomUUID !== "function") return null;
    const created = crypto.randomUUID();
    storage.setItem(visitorIdKey, created);
    return created;
  } catch {
    return null;
  }
}
