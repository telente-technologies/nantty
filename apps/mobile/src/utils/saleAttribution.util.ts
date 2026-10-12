export type SaleAttributionSource = "post" | "clip" | "live" | "link";

export interface SaleAttribution {
  readonly source: SaleAttributionSource;
  readonly id: string;
}

export interface StoredSaleAttribution extends SaleAttribution {
  readonly expiresAt: number;
}

const attributionSources: readonly SaleAttributionSource[] = ["post", "clip", "live", "link"];
const maximumRememberedProducts = 50;
const affiliateLinkIdPattern = /^[A-Za-z0-9_-]{1,80}$/;

export const isAffiliateLinkId = (value: unknown): value is string => typeof value === "string" && affiliateLinkIdPattern.test(value);

export const attributionSourceForPostKind = (kind: string | null | undefined): SaleAttributionSource => (kind === "clip" ? "clip" : "post");

export function keepLiveSaleAttributions(current: Readonly<Record<string, StoredSaleAttribution>>, productId: string, attribution: SaleAttribution, expiresAt: number, now: number): Record<string, StoredSaleAttribution> {
  const kept = Object.entries(current).filter(([key, stored]) => key !== productId && stored.expiresAt > now).slice(-(maximumRememberedProducts - 1));
  if (!productId || !attribution.id || !attributionSources.includes(attribution.source) || expiresAt <= now) return Object.fromEntries(kept);
  return Object.fromEntries([...kept, [productId, { source: attribution.source, id: attribution.id, expiresAt }]]);
}

export function readLiveSaleAttribution(byProduct: Readonly<Record<string, StoredSaleAttribution>>, productId: string, now: number): SaleAttribution | null {
  const stored = byProduct[productId];
  if (!stored || stored.expiresAt <= now || !attributionSources.includes(stored.source) || typeof stored.id !== "string") return null;
  return { source: stored.source, id: stored.id };
}
