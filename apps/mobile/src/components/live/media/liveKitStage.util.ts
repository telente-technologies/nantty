import type { LiveMedia } from "./liveMedia.hook";

export type LiveKitStageState = "video" | "connecting" | "waitingForHost" | "cameraOff" | "unavailable";

export function readLiveKitStageState(media: LiveMedia, isPublisher: boolean, hostId: string): LiveKitStageState {
  const { status, room } = media.connection;
  const video = isPublisher ? media.host.cameraTrackRef : media.viewer.hostVideo;
  if (video) return "video";
  if (status === "failed" || status === "removed" || status === "unavailable") return "unavailable";
  if (status !== "connected" || !room) return "connecting";
  if (isPublisher) return media.host.isCameraOn ? "connecting" : "cameraOff";
  return room.remoteParticipants.has(hostId) ? "cameraOff" : "waitingForHost";
}
