import { create } from "zustand";

export type ToastTone = "neutral" | "success" | "error";

interface ToastState {
  readonly message: string | null;
  readonly tone: ToastTone;
  readonly toastId: number;
  readonly showToast: (message: string, options?: { readonly tone?: ToastTone }) => void;
  readonly dismissToast: () => void;
}

const TOAST_DURATION_MS = 2800;
let dismissTimer: ReturnType<typeof setTimeout> | undefined;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  tone: "neutral",
  toastId: 0,
  showToast: (message, options) => {
    clearTimeout(dismissTimer);
    set((state) => ({ message, tone: options?.tone ?? "neutral", toastId: state.toastId + 1 }));
    dismissTimer = setTimeout(() => set({ message: null }), TOAST_DURATION_MS);
  },
  dismissToast: () => set({ message: null }),
}));

export const showToast = (message: string, options?: { readonly tone?: ToastTone }) => useToastStore.getState().showToast(message, options);
