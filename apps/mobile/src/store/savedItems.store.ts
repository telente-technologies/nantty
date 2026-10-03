import { create } from "zustand";

import type { SaveTarget } from "@/types";

export const saveTargetKey = (target: SaveTarget) => `${target.type}:${target.targetId}`;

interface SavedItemsState {
  readonly savedStateByTargetKey: Readonly<Record<string, boolean>>;
  readonly recordSavedState: (target: SaveTarget, isSaved: boolean) => void;
}

export const useSavedItemsStore = create<SavedItemsState>()((set) => ({
  savedStateByTargetKey: {},
  recordSavedState: (target, isSaved) => set((state) => ({ savedStateByTargetKey: { ...state.savedStateByTargetKey, [saveTargetKey(target)]: isSaved } })),
}));
