import type { LiveMedia } from "../media/liveMedia.hook";
import { readLiveKitStageState } from "../media/liveKitStage.util";

const video = { participant: {}, publication: {}, source: "camera" } as never;

function media(overrides: { status?: string; hostVideo?: unknown; cameraTrackRef?: unknown; isCameraOn?: boolean; hostInRoom?: boolean }): LiveMedia {
  const room = { remoteParticipants: new Map(overrides.hostInRoom ? [["host-1", {}]] : []) };
  return {
    mode: "livekit",
    connection: { status: overrides.status ?? "connected", room, runtime: {}, quality: "good", canPublish: true, revision: 1, retry: () => undefined },
    host: { cameraTrackRef: overrides.cameraTrackRef, isCameraOn: overrides.isCameraOn ?? true, isMicOn: true, facing: "user", wasPausedInBackground: false },
    viewer: { hostVideo: overrides.hostVideo, isAudioMuted: true, toggleAudio: () => undefined },
  } as unknown as LiveMedia;
}

describe("LiveKit stage state", () => {
  it("shows the host's video to viewers once it arrives, with the loader before that", () => {
    expect(readLiveKitStageState(media({ status: "connecting" }), false, "host-1")).toBe("connecting");
    expect(readLiveKitStageState(media({ hostInRoom: false }), false, "host-1")).toBe("waitingForHost");
    expect(readLiveKitStageState(media({ hostInRoom: true }), false, "host-1")).toBe("cameraOff");
    expect(readLiveKitStageState(media({ hostVideo: video }), false, "host-1")).toBe("video");
  });

  it("shows the host their own camera, or the cover when they turn it off", () => {
    expect(readLiveKitStageState(media({ cameraTrackRef: video }), true, "host-1")).toBe("video");
    expect(readLiveKitStageState(media({ isCameraOn: false }), true, "host-1")).toBe("cameraOff");
    expect(readLiveKitStageState(media({ isCameraOn: true }), true, "host-1")).toBe("connecting");
  });

  it("falls back to the cover with a retry when video can't connect", () => {
    for (const status of ["failed", "removed", "unavailable"]) expect(readLiveKitStageState(media({ status }), false, "host-1")).toBe("unavailable");
  });
});
