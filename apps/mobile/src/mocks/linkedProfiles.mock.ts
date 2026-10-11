import { ApiError } from "@/errors/api.error";
import type { LinkedProfileItem, LinkedProfiles } from "@/types/brand.type";

import { isBrandSelling, mockBrandRecords } from "./brandDirectory.mock";
import { mockBusinessProfiles } from "./businessProfiles.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { findDirectoryStoreById } from "./storeDirectory.mock";

const retiredProfileIds = new Set<string>();
const keptProfileIds = new Set<string>();

function rawItems(): LinkedProfileItem[] {
  const user = getSignedInMockUser();
  const store = user.storeId ? findDirectoryStoreById(user.storeId) : null;
  const stores: LinkedProfileItem[] = store ? [{ kind: "store", profileId: store.id, storeId: store.id, status: "active", holdReason: null, name: store.name, handle: store.handle, showsMart: true }] : [];
  const businesses: LinkedProfileItem[] = mockBusinessProfiles.map((profile) => ({ kind: "business", profileId: profile.id, storeId: null, status: "active", holdReason: null, name: profile.name, handle: profile.handle, showsMart: false }));
  const brands: LinkedProfileItem[] = mockBrandRecords
    .filter((brand) => brand.ownerUserKey === user.id)
    .map((brand) => ({ kind: "brand", profileId: brand.id, storeId: null, status: "active", holdReason: null, name: brand.name, handle: brand.handle, showsMart: isBrandSelling(brand) }));
  return [...stores, ...businesses, ...brands];
}

function withRuleApplied(items: readonly LinkedProfileItem[]): LinkedProfileItem[] {
  let slotTaken = false;
  let brandTaken = false;
  return items.map((item) => {
    if (retiredProfileIds.has(item.profileId)) return { ...item, status: "retired", holdReason: "Not kept when choosing profiles.", showsMart: false };
    const isBrand = item.kind === "brand";
    const taken = isBrand ? brandTaken : slotTaken;
    if (isBrand) brandTaken = true;
    else slotTaken = true;
    if (!taken || keptProfileIds.has(item.profileId)) return item;
    return { ...item, status: "held", holdReason: "Your account has more profiles than the rule allows. Choose which to keep.", showsMart: false };
  });
}

export function buildMockLinkedProfiles(): LinkedProfiles {
  const items = withRuleApplied(rawItems());
  const active = items.filter((item) => item.status === "active");
  const hasSlot = active.some((item) => item.kind !== "brand");
  return {
    accountId: getSignedInMockUser().id,
    items,
    canCreate: { store: !hasSlot, business: !hasSlot, brand: !active.some((item) => item.kind === "brand") },
    choiceRequired: items.some((item) => item.status === "held"),
  };
}

export function isRetiredMockProfile(profileId: string): boolean {
  return retiredProfileIds.has(profileId);
}

export function assertMockCanCreate(kind: "store" | "business" | "brand"): void {
  const linked = buildMockLinkedProfiles();
  if (kind === "brand" && !linked.canCreate.brand) throw new ApiError(409, "You can have one Brand.", "PROFILE_LIMIT_ONE_BRAND");
  if (kind !== "brand" && !linked.canCreate[kind]) throw new ApiError(409, "You can have one Store or one Business page, not both.", "PROFILE_LIMIT_STORE_OR_BUSINESS");
}

export const linkedProfilesMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/users/me/linked-profiles", () => buildMockLinkedProfiles()),
  createMockRoute("POST", "/api/v1/users/me/linked-profiles/choose", ({ body }) => {
    const keep = new Set((body as { keep?: readonly string[] }).keep ?? []);
    const linked = buildMockLinkedProfiles();
    if (!linked.choiceRequired) throw new ApiError(409, "Your profiles already follow the rule.", "NO_CHOICE_REQUIRED");
    const candidates = linked.items.filter((item) => item.status !== "retired");
    if ([...keep].some((id) => !candidates.some((item) => item.profileId === id))) throw new ApiError(400, "Choose from your own profiles.", "VALIDATION_FAILED");
    if (candidates.filter((item) => keep.has(item.profileId) && item.kind !== "brand").length > 1) throw new ApiError(409, "You can have one Store or one Business page, not both.", "PROFILE_LIMIT_STORE_OR_BUSINESS");
    if (candidates.filter((item) => keep.has(item.profileId) && item.kind === "brand").length > 1) throw new ApiError(409, "You can have one Brand.", "PROFILE_LIMIT_ONE_BRAND");
    for (const item of candidates) {
      if (keep.has(item.profileId)) keptProfileIds.add(item.profileId);
      else retiredProfileIds.add(item.profileId);
    }
    return buildMockLinkedProfiles();
  }),
];
