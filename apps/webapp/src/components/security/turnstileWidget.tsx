"use client";

import { useEffect, useRef } from "react";

interface TurnstileRenderOptions {
  readonly sitekey: string;
  readonly action?: string;
  readonly theme?: "auto" | "light" | "dark";
  readonly callback: (token: string) => void;
  readonly "error-callback"?: () => void;
  readonly "expired-callback"?: () => void;
}

interface TurnstileApi {
  render(container: HTMLElement, options: TurnstileRenderOptions): string;
  remove(widgetId: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const turnstileScriptUrl = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptLoading: Promise<TurnstileApi> | null = null;

function loadTurnstileScript(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  scriptLoading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = turnstileScriptUrl;
    script.async = true;
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile did not load")));
    script.onerror = () => { scriptLoading = null; reject(new Error("Turnstile did not load")); };
    document.head.appendChild(script);
  });
  return scriptLoading;
}

export function TurnstileWidget({ siteKey, action, onToken, onError }: { readonly siteKey: string; readonly action: string; readonly onToken: (token: string) => void; readonly onError: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onToken, onError });

  useEffect(() => {
    callbacks.current = { onToken, onError };
  }, [onToken, onError]);

  useEffect(() => {
    let widgetId: string | null = null;
    let isCancelled = false;
    loadTurnstileScript()
      .then((turnstile) => {
        if (isCancelled || !containerRef.current) return;
        widgetId = turnstile.render(containerRef.current, {
          sitekey: siteKey, action, theme: "auto",
          callback: (token) => callbacks.current.onToken(token),
          "error-callback": () => callbacks.current.onError(),
          "expired-callback": () => callbacks.current.onError(),
        });
      })
      .catch(() => callbacks.current.onError());
    return () => {
      isCancelled = true;
      if (widgetId !== null) window.turnstile?.remove(widgetId);
    };
  }, [siteKey, action]);

  return <div ref={containerRef} />;
}
