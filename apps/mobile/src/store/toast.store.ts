import { create } from "zustand";

interface ToastState {
  readonly message: string | null;
  readonly showToast: (message: string) => void;
  readonly dismissToast: () => void;
}

const TOAST_DURATION_MS = 2500;
let dismissTimer: ReturnType<typeof setTimeout> | undefined;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  showToast: (message) => {
    clearTimeout(dismissTimer);
    set({ message });
    dismissTimer = setTimeout(() => set({ message: null }), TOAST_DURATION_MS);
  },
  dismissToast: () => set({ message: null }),
}));

export const showToast = (message: string) => useToastStore.getState().showToast(message);
