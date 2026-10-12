import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { keepLiveSaleAttributions, type SaleAttribution, type StoredSaleAttribution } from "@/utils/saleAttribution.util";

interface SaleAttributionState {
  readonly byProduct: Readonly<Record<string, StoredSaleAttribution>>;
  readonly remember: (productId: string, attribution: SaleAttribution, expiresAt?: number) => void;
}

const defaultWindowMilliseconds = 30 * 86_400_000;

export const useSaleAttributionStore = create<SaleAttributionState>()(
  persist(
    (set) => ({
      byProduct: {},
      remember: (productId, attribution, expiresAt = Date.now() + defaultWindowMilliseconds) =>
        set((state) => ({ byProduct: keepLiveSaleAttributions(state.byProduct, productId, attribution, expiresAt, Date.now()) })),
    }),
    { name: "zudomart.saleAttributions", storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export const rememberSaleAttribution = (productId: string, attribution: SaleAttribution | null, expiresAt?: number) => {
  if (attribution) useSaleAttributionStore.getState().remember(productId, attribution, expiresAt);
};
