"use client";

import { useEffect, useState } from "react";

import { storeChatEngine } from "@/services/chatCrypto/storeChatEngine";
import { sendSellerApiRequest } from "@/services/clientApi.service";

export const inboxChangedEventName = "zudomart:inbox-changed";

export function announceInboxChanged(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(inboxChangedEventName));
}

export function useInboxUnreadCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let isCurrent = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const load = () => {
      sendSellerApiRequest<{ readonly unreadConversationsCount: number }>("/seller/conversations", { query: { filter: "unread", limit: 1 } })
        .then((page) => isCurrent && setCount(page.unreadConversationsCount))
        .catch(() => undefined);
    };
    const loadSoon = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(load, 500);
    };
    load();
    storeChatEngine.connectRealtime();
    const stopEvents = storeChatEngine.onEvent((event) => (event.type === "message.created" || event.type === "read") && loadSoon());
    const stopStatus = storeChatEngine.onStatus((status) => status === "live" && loadSoon());
    const poll = setInterval(() => storeChatEngine.realtimeStatus() !== "live" && document.visibilityState === "visible" && load(), 60_000);
    window.addEventListener(inboxChangedEventName, loadSoon);
    return () => {
      isCurrent = false;
      stopEvents();
      stopStatus();
      clearInterval(poll);
      if (timer) clearTimeout(timer);
      window.removeEventListener(inboxChangedEventName, loadSoon);
    };
  }, [enabled]);

  return count;
}
