const feedScrollStorageKey = "zudomart.webapp.feedScrollY";

export function rememberFeedScrollPosition(scrollY: number): void {
  try {
    window.sessionStorage.setItem(feedScrollStorageKey, String(Math.max(0, Math.round(scrollY))));
  } catch {
    return;
  }
}

export function takeRememberedFeedScrollPosition(): number | null {
  try {
    const stored = window.sessionStorage.getItem(feedScrollStorageKey);
    window.sessionStorage.removeItem(feedScrollStorageKey);
    const parsed = stored === null ? Number.NaN : Number(stored);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
