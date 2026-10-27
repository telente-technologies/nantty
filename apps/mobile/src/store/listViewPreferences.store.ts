import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { ConnectionFilter, ConnectionSort } from "@/components/profile/connectionSort.util";

export interface ConnectionListPreference {
  readonly sort: ConnectionSort;
  readonly filter: ConnectionFilter;
}

interface ListViewPreferencesState {
  readonly connectionsByScreen: Readonly<Record<string, ConnectionListPreference>>;
  readonly setConnectionPreference: (screenKey: string, preference: ConnectionListPreference) => void;
}

export const DEFAULT_CONNECTION_PREFERENCE: ConnectionListPreference = { sort: "recent", filter: "all" };

export const useListViewPreferencesStore = create<ListViewPreferencesState>()(
  persist(
    (set) => ({
      connectionsByScreen: {},
      setConnectionPreference: (screenKey, preference) =>
        set((state) => ({ connectionsByScreen: { ...state.connectionsByScreen, [screenKey]: preference } })),
    }),
    { name: "nantty.listViewPreferences", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
