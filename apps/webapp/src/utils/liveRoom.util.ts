const LIVE_POLL_INTERVAL_MS = 10_000;
const LIVE_REALTIME_SAFETY_POLL_MS = 60_000;

export type LiveRoomStatus = "live" | "upcoming" | "ended";

export function readLiveRoomStatus(status: string | null | undefined): LiveRoomStatus {
  if (status === "live") return "live";
  if (status === "upcoming" || status === "idle" || status === "connecting") return "upcoming";
  return "ended";
}

export function liveRoomBadgeLabel(status: LiveRoomStatus): string {
  return status === "live" ? "LIVE" : status === "upcoming" ? "Starting soon" : "Ended";
}

export function canPlayInBrowser(url: string | null | undefined): url is string {
  return typeof url === "string" && url.length > 0 && !/\.m3u8(\?|$)/i.test(url);
}

export function pollIntervalForLiveStatus(status: string | null | undefined, isRealtime = false): number | false {
  if (readLiveRoomStatus(status) === "ended") return false;
  return isRealtime ? LIVE_REALTIME_SAFETY_POLL_MS : LIVE_POLL_INTERVAL_MS;
}

export function shouldShowLiveRoomError(hasData: boolean, isError: boolean): boolean {
  return isError && !hasData;
}

export function orderProductsWithPinnedFirst<Product extends { readonly id: string }>(products: readonly Product[] | null | undefined, pinnedProductId: string | null | undefined): readonly Product[] {
  const list = products ?? [];
  if (!pinnedProductId) return list;
  const pinned = list.find((product) => product.id === pinnedProductId);
  return pinned ? [pinned, ...list.filter((product) => product !== pinned)] : list;
}

export type LiveVideoState = "signedOut" | "ownLive" | "mockPreview" | "connecting" | "waiting" | "playing" | "reconnecting" | "blocked" | "unavailable" | "ended";

const ROOM_DELETED = 5;
const ROOM_CLOSED = 10;
const PARTICIPANT_REMOVED = 4;
const CLIENT_INITIATED = 1;

export function stateAfterRoomDisconnect(reason: number | undefined): LiveVideoState | "retry" {
  if (reason === ROOM_DELETED || reason === ROOM_CLOSED) return "ended";
  if (reason === PARTICIPANT_REMOVED) return "unavailable";
  if (reason === CLIENT_INITIATED) return "connecting";
  return "retry";
}

export function canUseWebRtc(scope: { readonly RTCPeerConnection?: unknown } | undefined): boolean {
  return typeof scope?.RTCPeerConnection === "function";
}

export function liveVideoStateMessage(state: LiveVideoState): string | null {
  switch (state) {
    case "signedOut":
      return "Sign in to watch the live video.";
    case "ownLive":
      return "You're the host, so the video stays off here to keep your phone's stream connected.";
    case "mockPreview":
      return "Preview only: mock mode doesn't stream live video, so you see the cover photo.";
    case "waiting":
      return "Waiting for the host's video…";
    case "reconnecting":
      return "Reconnecting…";
    case "blocked":
      return "Your browser or network is blocking live video. Try another browser, or switch off a VPN or firewall.";
    case "unavailable":
      return "Live video isn't available right now. You can still chat and shop.";
    case "ended":
      return "This live has ended.";
    default:
      return null;
  }
}

export function readUrlHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "";
  }
}

// The CSP leaves LiveKit out when WEBAPP_LIVEKIT_URL isn't set; the browser then reports the blocked socket here.
export function isBlockedUriForHost(blockedUri: string, host: string): boolean {
  return host !== "" && readUrlHost(blockedUri) === host;
}
