import { readMockDatabase, type MockAdAccountRecord } from "@/mocks/mockDatabase.mock";
import type { LinkedBusinessProfile } from "@/types/adAccount.type";
import type { PromotableDestination, PromotableDestinationKind } from "@/types/creative.type";

const suspendedDemoStoresByOwnerUserId: Record<string, readonly { readonly storeId: string; readonly name: string; readonly handle: string }[]> = {
  usr_adaeze: [{ storeId: "st_ifebeauty", name: "Ife Beauty", handle: "ife.beauty" }],
};

const suspendedStoreReason = "This store is suspended. Its ads pause until it is reinstated.";

function presentOwnedStore(store: LinkedBusinessProfile): PromotableDestination {
  return { kind: "store", id: store.storeId, name: store.storeName, handle: store.handle, avatarUrl: store.logoUrl, verified: store.goldVerified, ...(store.goldVerified ? { checkmarkColor: "gold" } : {}), private: false, available: true, eligible: true, ineligibleReason: null };
}

function listPromotableStores(account: MockAdAccountRecord): PromotableDestination[] {
  const ownedStores = readMockDatabase().accounts.filter((candidate) => candidate.ownerUserId === account.ownerUserId).flatMap((candidate) => (candidate.business ? [candidate.business] : []));
  const linkedAndOwnedStores = account.business ? [account.business, ...ownedStores] : ownedStores;
  const uniqueStores = linkedAndOwnedStores.filter((store, index) => linkedAndOwnedStores.findIndex((candidate) => candidate.storeId === store.storeId) === index);
  const suspendedStores = (suspendedDemoStoresByOwnerUserId[account.ownerUserId] ?? []).map((store): PromotableDestination => ({ kind: "store", id: store.storeId, name: store.name, handle: store.handle, avatarUrl: null, verified: false, private: false, available: false, eligible: false, ineligibleReason: suspendedStoreReason }));
  return [...uniqueStores.map(presentOwnedStore), ...suspendedStores];
}

function listPromotableProfiles(account: MockAdAccountRecord): PromotableDestination[] {
  const owner = readMockDatabase().users.find((user) => user.id === account.ownerUserId);
  if (!owner) return [];
  return [{ kind: "profile", id: owner.id, name: owner.name, handle: owner.username, avatarUrl: owner.avatarUrl, verified: false, private: false, available: true, eligible: true, ineligibleReason: null }];
}

export function listMockPromotableDestinations(account: MockAdAccountRecord, kind: PromotableDestinationKind): PromotableDestination[] {
  return kind === "store" ? listPromotableStores(account) : listPromotableProfiles(account);
}

export function canMockAccountPromoteDestination(account: MockAdAccountRecord, kind: PromotableDestinationKind, targetId: string | null): boolean {
  return listMockPromotableDestinations(account, kind).some((destination) => destination.eligible && destination.id === targetId);
}
