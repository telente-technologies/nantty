import { createFeedInteractionQueue, FEED_INTERACTIONS_BATCH_PATH, outcomeForStatus, type FeedInteraction, type SendOutcome } from "@/utils/feedInteractionQueue.util";

import { readCsrfTokenForRequests } from "./clientApi.service";

const PENDING_STORAGE_KEY = "zm.pendingFeedInteractions";
const isBrowser = typeof window !== "undefined";

async function sendBatch(events: readonly FeedInteraction[], options: { readonly keepalive: boolean }): Promise<SendOutcome> {
  const csrfToken = readCsrfTokenForRequests();
  try {
    const response = await fetch(`/bff${FEED_INTERACTIONS_BATCH_PATH}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json", ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}) },
      body: JSON.stringify({ events }),
      credentials: "same-origin",
      cache: "no-store",
      keepalive: options.keepalive,
    });
    return outcomeForStatus(response.status);
  } catch {
    return "retry";
  }
}

function loadPending(): readonly unknown[] {
  if (!isBrowser) return [];
  try {
    const saved: unknown = JSON.parse(window.localStorage.getItem(PENDING_STORAGE_KEY) ?? "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

function savePending(events: readonly unknown[]) {
  if (!isBrowser) return;
  try {
    if (events.length === 0) window.localStorage.removeItem(PENDING_STORAGE_KEY);
    else window.localStorage.setItem(PENDING_STORAGE_KEY, JSON.stringify(events));
  } catch {
    return;
  }
}

export const feedInteractionsService = createFeedInteractionQueue({
  send: sendBatch,
  load: loadPending,
  save: savePending,
  isOnline: () => !isBrowser || navigator.onLine !== false,
  schedule: (callback, delayMs) => {
    const timer = setTimeout(callback, delayMs);
    return () => clearTimeout(timer);
  },
});

if (isBrowser) {
  window.addEventListener("online", () => void feedInteractionsService.flush());
  window.addEventListener("pagehide", () => void feedInteractionsService.flushBeforeUnload());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void feedInteractionsService.flushBeforeUnload();
  });
}
