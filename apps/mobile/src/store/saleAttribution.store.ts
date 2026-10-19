import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { keepLiveSaleAttributions, type SaleAttribution, type StoredSaleAttribution } from "@/utils/saleAttribution.util";

interface SaleAttributionState {
  readonly byProduct: Readonly<Record<string, StoredSaleAttribution>>;
  readonly visitorId: string | null;
  readonly remember: (productId: string, attribution: SaleAttribution, expiresAt?: number) => void;
  readonly ensureVisitorId: () => string;
}

const defaultWindowMilliseconds = 30 * 86_400_000;

export const useSaleAttributionStore = create<SaleAttributionState>()(
  persist(
    (set, get) => ({
      byProduct: {},
      visitorId: null,
      ensureVisitorId: () => {
        const existing = get().visitorId;
        if (existing) return existing;
        const created = Crypto.randomUUID();
        set({ visitorId: created });
        return created;
      },
      remember: (productId, attribution, expiresAt = Date.now() + defaultWindowMilliseconds) =>
        set((state) => ({ byProduct: keepLiveSaleAttributions(state.byProduct, productId, attribution, expiresAt, Date.now()) })),
    }),
    { name: "zudomart.saleAttributions", storage: createJSONStorage(() => AsyncStorage) },
  ),
);

export const rememberSaleAttribution = (productId: string, attribution: SaleAttribution | null, expiresAt?: number) => {
  if (attribution) useSaleAttributionStore.getState().remember(productId, attribution, expiresAt);
};
