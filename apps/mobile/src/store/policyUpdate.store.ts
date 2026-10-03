import { create } from "zustand";

interface PolicyUpdateState {
  readonly dismissedPolicyVersionIds: readonly string[];
  readonly dismissPolicyBanner: (policyVersionIds: readonly string[]) => void;
}

export const usePolicyUpdateStore = create<PolicyUpdateState>((set) => ({
  dismissedPolicyVersionIds: [],
  dismissPolicyBanner: (policyVersionIds) => set((state) => ({ dismissedPolicyVersionIds: [...state.dismissedPolicyVersionIds, ...policyVersionIds] })),
}));
