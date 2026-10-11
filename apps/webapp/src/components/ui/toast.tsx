"use client";

import Link from "next/link";
import { create } from "zustand";

import styles from "./toast.module.css";

interface ToastMessage {
  readonly id: number;
  readonly text: string;
  readonly tone: "neutral" | "error";
  readonly actionLabel?: string;
  readonly actionHref?: string;
}

interface ToastStore {
  readonly toasts: readonly ToastMessage[];
  readonly showToast: (toast: Omit<ToastMessage, "id" | "tone"> & { readonly tone?: ToastMessage["tone"] }) => void;
  readonly dismissToast: (id: number) => void;
}

const toastVisibleMilliseconds = 3_600;
const actionToastVisibleMilliseconds = 7_000;
let nextToastId = 1;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  showToast: (toast) => {
    const id = nextToastId++;
    set((state) => ({ toasts: [...state.toasts.slice(-2), { tone: "neutral", ...toast, id }] }));
    setTimeout(() => get().dismissToast(id), toast.actionHref ? actionToastVisibleMilliseconds : toastVisibleMilliseconds);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export function showToast(toast: Parameters<ToastStore["showToast"]>[0]): void {
  useToastStore.getState().showToast(toast);
}

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);
  return (
    <div className={styles.viewport} role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={[styles.toast, toast.tone === "error" ? styles.toastError : ""].join(" ")}>
          <span className={styles.text}>{toast.text}</span>
          {toast.actionHref && toast.actionLabel ? (
            <Link href={toast.actionHref} className={styles.action} onClick={() => dismissToast(toast.id)}>
              {toast.actionLabel}
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}
