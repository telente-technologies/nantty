import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface PolicyUpdateState {
  readonly dismissedPolicyVersionIds: readonly string[];
  readonly dismissPolicyBanner: (policyVersionIds: readonly string[]) => void;
}

export const usePolicyUpdateStore = create<PolicyUpdateState>()(
  persist(
    (set) => ({
      dismissedPolicyVersionIds: [],
      dismissPolicyBanner: (policyVersionIds) =>
        set((state) => ({ dismissedPolicyVersionIds: [...new Set([...state.dismissedPolicyVersionIds, ...policyVersionIds])] })),
    }),
    { name: "zudomart.policyDismissals", storage: createJSONStorage(() => AsyncStorage) },
  ),
);
