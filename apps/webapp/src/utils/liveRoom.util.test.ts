import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { canPlayInBrowser, canUseWebRtc, isBlockedUriForHost, liveRoomBadgeLabel, readUrlHost, liveVideoStateMessage, orderProductsWithPinnedFirst, pollIntervalForLiveStatus, readLiveRoomStatus, shouldShowLiveRoomError, stateAfterRoomDisconnect } from "./liveRoom.util";

describe("live room viewer", () => {
  it("keeps a working room on screen when one poll fails", () => {
    assert.equal(shouldShowLiveRoomError(true, true), false);
    assert.equal(shouldShowLiveRoomError(false, true), true);
    assert.equal(shouldShowLiveRoomError(false, false), false);
  });

  it("treats upcoming lives as not ended and stops polling once ended", () => {
    assert.equal(readLiveRoomStatus("upcoming"), "upcoming");
    assert.equal(liveRoomBadgeLabel(readLiveRoomStatus("upcoming")), "Starting soon");
    assert.equal(liveRoomBadgeLabel(readLiveRoomStatus("ended")), "Ended");
    assert.equal(pollIntervalForLiveStatus("ended"), false);
    assert.equal(pollIntervalForLiveStatus("live"), 10_000);
  });

  it("never hands an HLS playlist to a plain video element", () => {
    assert.equal(canPlayInBrowser("https://cdn.test/live/index.m3u8?token=1"), false);
    assert.equal(canPlayInBrowser("https://cdn.test/replay.mp4"), true);
    assert.equal(canPlayInBrowser(null), false);
  });

  it("puts the pinned product first and tolerates missing products", () => {
    const products = [{ id: "a" }, { id: "b" }, { id: "c" }];
    assert.deepEqual(orderProductsWithPinnedFirst(products, "c").map((product) => product.id), ["c", "a", "b"]);
    assert.deepEqual(orderProductsWithPinnedFirst(undefined, "c"), []);
    assert.deepEqual(orderProductsWithPinnedFirst(products, "missing").map((product) => product.id), ["a", "b", "c"]);
  });
});

describe("live room video", () => {
  it("ends the player when the room closes and retries on network drops", () => {
    assert.equal(stateAfterRoomDisconnect(5), "ended");
    assert.equal(stateAfterRoomDisconnect(10), "ended");
    assert.equal(stateAfterRoomDisconnect(4), "unavailable");
    assert.equal(stateAfterRoomDisconnect(14), "retry");
    assert.equal(stateAfterRoomDisconnect(undefined), "retry");
  });

  it("detects when WebRTC is missing and explains it", () => {
    assert.equal(canUseWebRtc({ RTCPeerConnection: function RTCPeerConnection() {} }), true);
    assert.equal(canUseWebRtc({}), false);
    assert.equal(canUseWebRtc(undefined), false);
    assert.match(liveVideoStateMessage("blocked") ?? "", /blocking live video/);
    assert.equal(liveVideoStateMessage("playing"), null);
  });
});

describe("live video under the CSP", () => {
  it("recognises a socket blocked by the content security policy", () => {
    assert.equal(readUrlHost("wss://livekit.zudomart.com"), "livekit.zudomart.com");
    assert.equal(isBlockedUriForHost("wss://livekit.zudomart.com/rtc?access_token=x", "livekit.zudomart.com"), true);
    assert.equal(isBlockedUriForHost("https://evil.example/x", "livekit.zudomart.com"), false);
    assert.equal(isBlockedUriForHost("inline", "livekit.zudomart.com"), false);
    assert.equal(isBlockedUriForHost("wss://livekit.zudomart.com", ""), false);
  });
});
