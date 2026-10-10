import { useQuery } from "@tanstack/react-query";

import { useMyProfileQuery } from "@/components/profile/profileQueries.hook";
import { storesService } from "@/services/sellers/stores.service";
import { useActingProfileStore } from "@/store/actingProfile.store";
import type { MyStoreSummary } from "@/types/commerce.type";

export interface LiveHostStore {
  readonly storeId: string | null;
  readonly storeName: string | null;
  readonly isLoading: boolean;
}

export const pickLiveHostStore = (stores: readonly MyStoreSummary[], preferredStoreId: string | null | undefined): MyStoreSummary | null =>
  stores.find((store) => store.storeId === preferredStoreId) ?? stores.find((store) => store.isCurrent) ?? stores[0] ?? null;

export function useLiveHostStore(): LiveHostStore {
  const actingProfile = useActingProfileStore((state) => state.actingProfile);
  const profile = useMyProfileQuery().data;
  const isSeller = Boolean(profile?.isSeller);
  const stores = useQuery({ queryKey: ["my-stores"], queryFn: storesService.fetchMyStores, enabled: isSeller, staleTime: 5 * 60_000 });
  const preferredStoreId = actingProfile?.kind === "store" ? actingProfile.id : profile?.storeId;
  const store = pickLiveHostStore(stores.data ?? [], preferredStoreId);
  return { storeId: store?.storeId ?? null, storeName: store?.storeName ?? null, isLoading: isSeller && stores.isPending };
}
