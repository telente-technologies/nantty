export async function probeConnectivity(url = "/favicon.ico", timeoutMilliseconds = 4000): Promise<boolean> {
  if (typeof fetch === "undefined") return true;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMilliseconds);
  try {
    const separator = url.includes("?") ? "&" : "?";
    await fetch(`${url}${separator}probe=${Date.now()}`, { method: "HEAD", cache: "no-store", credentials: "omit", signal: controller.signal });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function isBrowserStorageAvailable(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const key = "__nantty_storage_probe__";
    window.localStorage.setItem(key, "1");
    window.localStorage.removeItem(key);
    return navigator.cookieEnabled !== false;
  } catch {
    return false;
  }
}

export function isLiveVideoSupported(): boolean {
  if (typeof window === "undefined") return true;
  return typeof (window as unknown as { RTCPeerConnection?: unknown }).RTCPeerConnection === "function";
}

export function measureClockSkewSeconds(serverDateHeader: string | null | undefined, nowMilliseconds = Date.now()): number {
  if (!serverDateHeader) return 0;
  const serverTime = Date.parse(serverDateHeader);
  return Number.isNaN(serverTime) ? 0 : Math.round((nowMilliseconds - serverTime) / 1000);
}

export function isClockSkewSignificant(skewSeconds: number, toleranceSeconds = 300): boolean {
  return Math.abs(skewSeconds) > toleranceSeconds;
}
