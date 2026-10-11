import { classifyRoomDisconnect, liveVideoProfile, nextReconnectDelayMs, pickLiveHostNotice, readConnectionQuality, type LiveHostNoticeInput } from "../liveMediaPolicy.util";

const calm: LiveHostNoticeInput = { isHeartbeatReconnecting: false, mediaMode: "livekit", mediaStatus: "connected", quality: "good", wasPausedInBackground: false };

describe("live media policy", () => {
  it("treats a deleted or closed room as the live ending, and a kick as removal", () => {
    expect(classifyRoomDisconnect(5)).toBe("ended");
    expect(classifyRoomDisconnect(10)).toBe("ended");
    expect(classifyRoomDisconnect(4)).toBe("removed");
    expect(classifyRoomDisconnect(2)).toBe("removed");
    expect(classifyRoomDisconnect(1)).toBe("stopped");
  });

  it("retries every network-shaped disconnect with a capped backoff", () => {
    for (const reason of [undefined, 0, 3, 6, 7, 9, 14, 15]) expect(classifyRoomDisconnect(reason)).toBe("retry");
    expect([0, 1, 2, 3, 4, 5].map(nextReconnectDelayMs)).toEqual([1000, 2000, 4000, 8000, 15000, 15000]);
  });

  it("caps the stream at 720p and 1.2 Mbps with 180p and 360p layers for weak networks", () => {
    expect(liveVideoProfile.capture.height).toBe(720);
    expect(liveVideoProfile.topLayer.maxBitrate).toBeLessThanOrEqual(1_200_000);
    expect(liveVideoProfile.simulcastLayers.map((layer) => layer.height)).toEqual([180, 360]);
  });

  it("shows the reconnecting banner for either the heartbeat or LiveKit, ahead of every other notice", () => {
    expect(pickLiveHostNotice(calm)).toBeNull();
    expect(pickLiveHostNotice({ ...calm, isHeartbeatReconnecting: true, quality: "poor" })).toBe("reconnecting");
    expect(pickLiveHostNotice({ ...calm, mediaStatus: "reconnecting", wasPausedInBackground: true })).toBe("reconnecting");
  });

  it("says plainly when nothing is streaming", () => {
    expect(pickLiveHostNotice({ ...calm, mediaMode: "mockPreview", mediaStatus: "idle" })).toBe("mockPreview");
    expect(pickLiveHostNotice({ ...calm, mediaMode: "noVideoEngine", mediaStatus: "idle" })).toBe("noVideoEngine");
    expect(pickLiveHostNotice({ ...calm, mediaStatus: "failed" })).toBe("videoFailed");
    expect(pickLiveHostNotice({ ...calm, wasPausedInBackground: true })).toBe("backgroundPaused");
    expect(pickLiveHostNotice({ ...calm, quality: "lost" })).toBe("weakConnection");
  });

  it("only trusts known connection quality values", () => {
    expect(readConnectionQuality("excellent")).toBe("excellent");
    expect(readConnectionQuality("bogus")).toBe("unknown");
    expect(readConnectionQuality(undefined)).toBe("unknown");
  });
});
