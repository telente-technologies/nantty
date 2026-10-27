import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface WidgetPreferencesState {
  readonly hideAmounts: boolean;
  readonly setHideAmounts: (hideAmounts: boolean) => void;
}

export const useWidgetPreferencesStore = create<WidgetPreferencesState>()(
  persist(
    (set) => ({
      hideAmounts: true,
      setHideAmounts: (hideAmounts) => set({ hideAmounts }),
    }),
    { name: "nantty.widgetPreferences", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
