"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { ZudoIcon } from "./zudoIcon";
import styles from "./toastProvider.module.css";

type ToastTone = "success" | "error" | "info";

interface ToastMessage {
  readonly id: number;
  readonly tone: ToastTone;
  readonly text: string;
}

interface ToastApi {
  readonly showToast: (text: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastApi>({ showToast: () => undefined });

export function ToastProvider({ children }: { readonly children: ReactNode }) {
  const [messages, setMessages] = useState<readonly ToastMessage[]>([]);

  const showToast = useCallback((text: string, tone: ToastTone = "success") => {
    const id = Date.now() + Math.random();
    setMessages((current) => [...current.slice(-3), { id, tone, text }]);
    setTimeout(() => setMessages((current) => current.filter((message) => message.id !== id)), tone === "error" ? 7000 : 4500);
  }, []);

  const api = useMemo(() => ({ showToast }), [showToast]);
  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region} role="status" aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={styles.toast}>
            {message.tone === "info" ? null : <ZudoIcon name={message.tone === "error" ? "warning20" : "check16"} className={styles[message.tone]} />}
            {message.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastContext);
}
