export type LiveMediaStatus = "idle" | "connecting" | "connected" | "reconnecting" | "ended" | "removed" | "failed" | "unavailable";

export type LiveConnectionQuality = "excellent" | "good" | "poor" | "lost" | "unknown";

export type RoomDisconnectOutcome = "ended" | "removed" | "stopped" | "retry";

export const MAX_ROOM_RECONNECT_ATTEMPTS = 6;

const DISCONNECT_REASON = { clientInitiated: 1, duplicateIdentity: 2, participantRemoved: 4, roomDeleted: 5, roomClosed: 10 } as const;

export function classifyRoomDisconnect(reason: number | undefined): RoomDisconnectOutcome {
  switch (reason) {
    case DISCONNECT_REASON.roomDeleted:
    case DISCONNECT_REASON.roomClosed:
      return "ended";
    case DISCONNECT_REASON.participantRemoved:
    case DISCONNECT_REASON.duplicateIdentity:
      return "removed";
    case DISCONNECT_REASON.clientInitiated:
      return "stopped";
    default:
      return "retry";
  }
}

export function nextReconnectDelayMs(attempt: number): number {
  return Math.min(15_000, 1_000 * 2 ** Math.max(0, attempt));
}

export function readConnectionQuality(quality: string | undefined): LiveConnectionQuality {
  return quality === "excellent" || quality === "good" || quality === "poor" || quality === "lost" ? quality : "unknown";
}

export function isMediaFailureFinal(status: LiveMediaStatus): boolean {
  return status === "ended" || status === "removed" || status === "failed" || status === "unavailable";
}

// Tuned for Nigerian mobile data: 720p tops out at 1.2 Mbps, and viewers on weak links drop to 360p or 180p.
export const liveVideoProfile = {
  capture: { width: 1280, height: 720, frameRate: 24 },
  topLayer: { maxBitrate: 1_200_000, maxFramerate: 24 },
  simulcastLayers: [
    { width: 320, height: 180, maxBitrate: 150_000, maxFramerate: 15 },
    { width: 640, height: 360, maxBitrate: 450_000, maxFramerate: 20 },
  ],
  audioMaxBitrate: 32_000,
} as const;

export type LiveHostNotice = "reconnecting" | "mockPreview" | "noVideoEngine" | "videoFailed" | "backgroundPaused" | "weakConnection";

export interface LiveHostNoticeInput {
  readonly isHeartbeatReconnecting: boolean;
  readonly mediaMode: "livekit" | "mockPreview" | "noVideoEngine";
  readonly mediaStatus: LiveMediaStatus;
  readonly quality: LiveConnectionQuality;
  readonly wasPausedInBackground: boolean;
}

export function pickLiveHostNotice(input: LiveHostNoticeInput): LiveHostNotice | null {
  if (input.isHeartbeatReconnecting || input.mediaStatus === "reconnecting") return "reconnecting";
  if (input.mediaMode !== "livekit") return input.mediaMode;
  if (input.mediaStatus === "failed" || input.mediaStatus === "removed" || input.mediaStatus === "unavailable") return "videoFailed";
  if (input.wasPausedInBackground) return "backgroundPaused";
  if (input.quality === "poor" || input.quality === "lost") return "weakConnection";
  return null;
}
