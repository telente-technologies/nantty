import type { ActingProfile, LinkedProfiles } from "@/types/brand.type";

export function profileShowsMart(acting: Pick<ActingProfile, "kind" | "showsMart"> | null | undefined, isSeller: boolean | undefined): boolean {
  if (acting?.kind === "business" || acting?.kind === "government") return false;
  if (acting?.kind === "brand") return acting.showsMart === true;
  return isSeller === true;
}

export function storeOrBusinessOf(linked: LinkedProfiles | undefined) {
  return linked?.items.find((item) => item.status === "active" && (item.kind === "store" || item.kind === "business")) ?? null;
}

export function brandOf(linked: LinkedProfiles | undefined) {
  return linked?.items.find((item) => item.status === "active" && item.kind === "brand") ?? null;
}

export const LINKED_KIND_LABELS = { store: "Store", business: "Business page", brand: "Brand" } as const;

export function blockedCreateCode(linked: LinkedProfiles | undefined, kind: "store" | "business" | "brand"): string | null {
  if (!linked) return null;
  if (linked.choiceRequired) return "PROFILE_ON_HOLD";
  if (kind === "brand") return linked.canCreate.brand ? null : "PROFILE_LIMIT_ONE_BRAND";
  return linked.canCreate[kind] ? null : "PROFILE_LIMIT_STORE_OR_BUSINESS";
}
