import { create } from "zustand";

import { useAuthStore } from "@/store/auth.store";

type PendingAction = () => void;

interface AuthPromptState {
  readonly isOpen: boolean;
  readonly reason: string;
  readonly pendingAction: PendingAction | null;
  readonly isWaitingToReplay: boolean;
  readonly openAuthPrompt: (reason: string, pendingAction?: PendingAction | null) => void;
  readonly closeAuthPrompt: () => void;
  readonly markSignedInAndWaitToReplay: () => void;
  readonly takePendingActionForReplay: () => PendingAction | null;
}

export const useAuthPromptStore = create<AuthPromptState>((set, get) => ({
  isOpen: false,
  reason: "",
  pendingAction: null,
  isWaitingToReplay: false,
  openAuthPrompt: (reason, pendingAction = null) => set({ isOpen: true, reason, pendingAction, isWaitingToReplay: false }),
  closeAuthPrompt: () => set({ isOpen: false, pendingAction: get().isWaitingToReplay ? get().pendingAction : null }),
  markSignedInAndWaitToReplay: () => set({ isOpen: false, isWaitingToReplay: true }),
  takePendingActionForReplay: () => {
    const action = get().pendingAction;
    set({ pendingAction: null, isWaitingToReplay: false });
    return action;
  },
}));

export function requireAuthThen(action: PendingAction, reason = "Sign in to continue."): void {
  if (useAuthStore.getState().user) {
    action();
    return;
  }
  useAuthPromptStore.getState().openAuthPrompt(reason, action);
}
