import { create } from "zustand";

export type ToastTone = "neutral" | "success" | "error";

export interface ToastAction {
  readonly label: string;
  readonly onPress: () => void;
}

interface ToastOptions {
  readonly tone?: ToastTone;
  readonly action?: ToastAction;
}

interface ToastState {
  readonly message: string | null;
  readonly action: ToastAction | null;
  readonly tone: ToastTone;
  readonly toastId: number;
  readonly showToast: (message: string, options?: ToastOptions) => void;
  readonly dismissToast: () => void;
}

const TOAST_DURATION_MS = 2800;
let dismissTimer: ReturnType<typeof setTimeout> | undefined;

export const useToastStore = create<ToastState>((set) => ({
  message: null,
  action: null,
  tone: "neutral",
  toastId: 0,
  showToast: (message, options) => {
    clearTimeout(dismissTimer);
    set((state) => ({ message, action: options?.action ?? null, tone: options?.tone ?? "neutral", toastId: state.toastId + 1 }));
    dismissTimer = setTimeout(() => set({ message: null, action: null }), TOAST_DURATION_MS);
  },
  dismissToast: () => set({ message: null, action: null }),
}));

export const showToast = (message: string, options?: ToastOptions) => useToastStore.getState().showToast(message, options);
