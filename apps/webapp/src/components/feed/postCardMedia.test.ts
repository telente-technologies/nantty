import assert from "node:assert/strict";
import test from "node:test";

import { canPlayInline, describeCarouselPosition, describePostImagePreview, describePostImageZoom, getAdjacentPostImageIndex, isHlsUrl, selectPostVideoSource } from "./postCardMedia.util";

test("image preview navigation wraps across available post images", () => {
  assert.equal(getAdjacentPostImageIndex(0, 3, -1), 2);
  assert.equal(getAdjacentPostImageIndex(2, 3, 1), 0);
  assert.equal(getAdjacentPostImageIndex(0, 0, 1), 0);
});

test("carousel position announcement matches the mobile item count and clamps safely", () => {
  assert.equal(describeCarouselPosition(1, 3), "Item 2 of 3");
  assert.equal(describeCarouselPosition(-1, 3), "Item 1 of 3");
  assert.equal(describeCarouselPosition(8, 3), "Item 3 of 3");
  assert.equal(describeCarouselPosition(0, 0), "");
});

test("image preview exposes a useful accessible position label", () => {
  assert.deepEqual(describePostImagePreview(1, 3), {
    buttonLabel: "Open post image 2 of 3",
    imageAlt: "Post image 2 of 3",
    positionLabel: "Image 2 of 3",
  });
  assert.equal(describePostImagePreview(-1, 0).imageAlt, "Post image");
});

test("image zoom control announces its action and pressed state", () => {
  assert.deepEqual(describePostImageZoom(false), { label: "Zoom image", pressed: false });
  assert.deepEqual(describePostImageZoom(true), { label: "Fit image to screen", pressed: true });
});

test("inline carousel playback mounts video media with a progressive or HLS source", () => {
  assert.equal(canPlayInline({ type: "video", url: "https://cdn.nantty.com/clip.mp4" }), true);
  assert.equal(canPlayInline({ type: "video", url: "https://cdn.nantty.com/clip.m3u8" }), true);
  assert.equal(canPlayInline({ type: "video", url: null, hlsUrl: "https://cdn.nantty.com/master.m3u8" }), true);
  assert.equal(canPlayInline({ type: "video", url: null, posterUrl: "https://cdn.nantty.com/poster.jpg" }), false);
  assert.equal(canPlayInline({ type: "image", url: "https://cdn.nantty.com/image.jpg" }), false);
});

test("native HLS browsers prefer the adaptive stream", () => {
  assert.equal(
    selectPostVideoSource({ type: "video", url: "https://cdn.nantty.com/clip.mp4", hlsUrl: "https://cdn.nantty.com/master.m3u8" }, true),
    "https://cdn.nantty.com/master.m3u8",
  );
  assert.equal(selectPostVideoSource({ type: "video", url: "https://cdn.nantty.com/clip.m3u8?token=abc" }, true), "https://cdn.nantty.com/clip.m3u8?token=abc");
});

test("browsers without native HLS use progressive media or fall back to the poster", () => {
  assert.equal(
    selectPostVideoSource({ type: "video", url: "https://cdn.nantty.com/clip.mp4", hlsUrl: "https://cdn.nantty.com/master.m3u8" }, false),
    "https://cdn.nantty.com/clip.mp4",
  );
  assert.equal(selectPostVideoSource({ type: "video", url: "https://cdn.nantty.com/clip.m3u8" }, false), null);
  assert.equal(selectPostVideoSource({ type: "video", url: null, hlsUrl: "https://cdn.nantty.com/master.m3u8" }, false), null);
});

test("a failed native HLS stream falls back to the progressive URL when available", () => {
  const media = { type: "video" as const, url: "https://cdn.nantty.com/clip.mp4", hlsUrl: "https://cdn.nantty.com/master.m3u8" };
  assert.equal(selectPostVideoSource(media, true), "https://cdn.nantty.com/master.m3u8");
  assert.equal(selectPostVideoSource(media, false), "https://cdn.nantty.com/clip.mp4");
});

test("HLS URL detection tolerates query strings and fragments", () => {
  assert.equal(isHlsUrl("https://cdn.nantty.com/master.m3u8?token=abc"), true);
  assert.equal(isHlsUrl("https://cdn.nantty.com/master.M3U8#variant"), true);
  assert.equal(isHlsUrl("https://cdn.nantty.com/clip.mp4"), false);
});
