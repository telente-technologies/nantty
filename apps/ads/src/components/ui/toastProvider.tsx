"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { NanttyIcon } from "./nanttyIcon";
import styles from "./toastProvider.module.css";

type ToastTone = "success" | "error" | "info";

interface ToastMessage {
  readonly id: number;
  readonly tone: ToastTone;
  readonly text: string;
}

interface ToastContextValue {
  readonly showToast: (text: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => undefined });

let nextToastId = 1;

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const showToast = useCallback((text: string, tone: ToastTone = "success") => {
    const id = nextToastId++;
    setToasts((current) => [...current.slice(-3), { id, tone, text }]);
    setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4500);
  }, []);
  const contextValue = useMemo(() => ({ showToast }), [showToast]);
  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className={styles.region} aria-live="polite" aria-atomic="false">
        {toasts.map((toast) => (
          <div key={toast.id} className={styles.toast} role={toast.tone === "error" ? "alert" : "status"}>
            {toast.tone === "info" ? null : <NanttyIcon name={toast.tone === "error" ? "warning20" : "check16"} size={16} className={styles[toast.tone]} />}
            {toast.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}
