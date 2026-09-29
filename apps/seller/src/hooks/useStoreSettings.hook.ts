"use client";

import { createContext, useContext } from "react";

import type { StoreLocation, StoreSettings } from "@/types/store.type";

export interface StoreContextValue {
  readonly settings: StoreSettings | null;
  readonly locations: StoreLocation[];
  readonly selectedLocationId: string | null;
  readonly selectLocation: (locationId: string) => Promise<void>;
  readonly reloadStoreContext: () => void;
}

export const StoreContext = createContext<StoreContextValue>({
  settings: null,
  locations: [],
  selectedLocationId: null,
  selectLocation: async () => undefined,
  reloadStoreContext: () => undefined,
});

export function useStoreContext(): StoreContextValue {
  return useContext(StoreContext);
}
