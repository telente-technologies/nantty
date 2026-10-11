import type { LinkedProfiles } from "@/types/brand.type";

export const LINKED_KIND_LABELS = { store: "Store", business: "Business page", brand: "Brand" } as const;

export function activeStoreOrBusiness(linked: LinkedProfiles | undefined) {
  return linked?.items.find((item) => item.status === "active" && item.kind !== "brand") ?? null;
}

export function activeBrand(linked: LinkedProfiles | undefined) {
  return linked?.items.find((item) => item.status === "active" && item.kind === "brand") ?? null;
}
