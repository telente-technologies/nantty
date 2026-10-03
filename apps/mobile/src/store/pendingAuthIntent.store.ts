import { create } from "zustand";

export interface ReturnTarget {
  readonly name: string;
  readonly params?: object;
}

export interface PendingAuthIntent {
  readonly action: (() => void | Promise<void>) | null;
  readonly returnTo: ReturnTarget | null;
}

interface PendingAuthIntentState {
  readonly pendingIntent: PendingAuthIntent | null;
  readonly signInPromptReason: string | null;
  readonly rememberPendingIntent: (intent: PendingAuthIntent) => void;
  readonly takePendingIntent: () => PendingAuthIntent | null;
  readonly discardPendingIntent: () => void;
  readonly openSignInPrompt: (reason: string) => void;
  readonly closeSignInPrompt: () => void;
}

export const usePendingAuthIntentStore = create<PendingAuthIntentState>((set, get) => ({
  pendingIntent: null,
  signInPromptReason: null,
  rememberPendingIntent: (pendingIntent) => set({ pendingIntent }),
  takePendingIntent: () => {
    const { pendingIntent } = get();
    set({ pendingIntent: null });
    return pendingIntent;
  },
  discardPendingIntent: () => set({ pendingIntent: null }),
  openSignInPrompt: (signInPromptReason) => set({ signInPromptReason }),
  closeSignInPrompt: () => set({ signInPromptReason: null }),
}));
