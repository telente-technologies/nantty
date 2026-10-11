import { create } from "zustand";

interface AppGateState {
  readonly isUpdateRequired: boolean;
  readonly markUpdateRequired: () => void;
}

export const useAppGateStore = create<AppGateState>((set) => ({
  isUpdateRequired: false,
  markUpdateRequired: () => set({ isUpdateRequired: true }),
}));
