import { ApiError } from "@/errors/api.error";
import type { LinkedProfileItem, LinkedProfiles } from "@/types/brand.type";

import { mockBrandRecords } from "./brandDirectory.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { findDirectoryStoreById } from "./storeDirectory.mock";

export function buildMockLinkedProfiles(): LinkedProfiles {
  const user = getSignedInMockUser();
  const store = user.storeId ? findDirectoryStoreById(user.storeId) : null;
  const items: LinkedProfileItem[] = [
    ...(store ? [{ kind: "store", profileId: store.id, storeId: store.id, status: "active", holdReason: null, name: store.name, handle: store.handle, showsMart: true } as const] : []),
    ...mockBrandRecords.filter((brand) => brand.ownerUserKey === user.id).map((brand) => ({ kind: "brand", profileId: brand.id, storeId: null, status: "active", holdReason: null, name: brand.name, handle: brand.handle, showsMart: brand.officialStoreId !== null } as const)),
  ];
  return {
    accountId: user.id,
    items,
    canCreate: { store: store === null, business: store === null, brand: !items.some((item) => item.kind === "brand") },
    choiceRequired: false,
  };
}

export const linkedProfilesMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/users/me/linked-profiles", () => buildMockLinkedProfiles()),
  createMockRoute("POST", "/api/v1/users/me/linked-profiles/choose", () => {
    throw new ApiError(409, "Your profiles already follow the rule.", "NO_CHOICE_REQUIRED");
  }),
];
