import { ApiError } from "@/errors/api.error";
import type { LinkedProfileItem, LinkedProfiles, StoreTeamRequest } from "@/types/brand.type";

import { mockBrandRecords } from "./brandDirectory.mock";
import { getSignedInMockUser } from "./fixtures.mock";
import { mockViewerHasBluePremium } from "./goldForBusinesses.mock";
import { createMockRoute, type MockRoute } from "./registry.mock";
import { findDirectoryStoreById } from "./storeDirectory.mock";

export function buildMockLinkedProfiles(): LinkedProfiles {
  const user = getSignedInMockUser();
  const store = user.storeId ? findDirectoryStoreById(user.storeId) : null;
  const items: LinkedProfileItem[] = [
    ...(store ? [{ kind: "store", profileId: store.id, storeId: store.id, status: "active", holdReason: null, name: store.name, handle: store.handle, showsMart: true, ownsStore: true, premiumNeeded: false } as const] : []),
    ...mockBrandRecords.filter((brand) => brand.ownerUserKey === user.id).map((brand) => ({ kind: "brand", profileId: brand.id, storeId: null, status: "active", holdReason: null, name: brand.name, handle: brand.handle, showsMart: brand.officialStoreId !== null, ownsStore: false, premiumNeeded: false } as const)),
  ];
  const premium = mockViewerHasBluePremium();
  const count = items.filter((item) => item.status === "active").length;
  const limit = premium ? 5 : 2;
  const hasRoom = count < limit;
  return {
    accountId: user.id,
    items,
    canCreate: premium
      ? { store: hasRoom && store === null, business: hasRoom, brand: hasRoom }
      : { store: store === null, business: store === null, brand: !items.some((item) => item.kind === "brand") },
    choiceRequired: false,
    businessProfiles: { count, limit, premiumLimit: 5, premium, premiumNeeded: false, storeUsed: store !== null },
  };
}

const mockStoreTeamRequests: StoreTeamRequest[] = [];

export const linkedProfilesMocks: MockRoute[] = [
  createMockRoute("GET", "/api/v1/users/me/linked-profiles", () => buildMockLinkedProfiles()),
  createMockRoute("POST", "/api/v1/users/me/linked-profiles/choose", () => {
    throw new ApiError(409, "Your profiles already follow the rule.", "NO_CHOICE_REQUIRED");
  }),
  createMockRoute("GET", "/api/v1/stores/team-requests", () => ({ data: mockStoreTeamRequests, nextCursor: null })),
  createMockRoute("POST", "/api/v1/stores/team-requests/:requestId/accept", ({ params }) => {
    const index = mockStoreTeamRequests.findIndex((item) => item.id === params.requestId);
    if (index === -1) throw new ApiError(404, "Team request not found", "TEAM_REQUEST_NOT_FOUND");
    mockStoreTeamRequests.splice(index, 1);
    return undefined;
  }),
  createMockRoute("POST", "/api/v1/stores/team-requests/:requestId/decline", ({ params }) => {
    const index = mockStoreTeamRequests.findIndex((item) => item.id === params.requestId);
    if (index === -1) throw new ApiError(404, "Team request not found", "TEAM_REQUEST_NOT_FOUND");
    mockStoreTeamRequests.splice(index, 1);
    return undefined;
  }),
];
