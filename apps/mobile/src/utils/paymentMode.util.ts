import type { CartSellerGroup } from "@/types";

export function canPayDirectly(group: CartSellerGroup): boolean {
  return group.store?.verified === true;
}

export function describeStoreTrust(group: CartSellerGroup): string {
  const store = group.store;
  if (store?.successRate != null) return `${Math.round(store.successRate * 100)}% success rate`;
  return store?.ratingCount ? `${(store.rating ?? 0).toFixed(1)} rating (${store.ratingCount})` : "New store";
}

export function directChoicesFor(groups: readonly CartSellerGroup[], chosen: Readonly<Record<string, "escrow" | "direct">>): Record<string, "escrow" | "direct"> {
  return Object.fromEntries(groups.filter(canPayDirectly).map((group) => [group.storeId, chosen[group.storeId] ?? "escrow"] as const));
}
