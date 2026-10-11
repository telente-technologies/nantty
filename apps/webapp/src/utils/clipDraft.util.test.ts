import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildClipCreateFields, clampTrim, EMPTY_CLIP_EDITS, totalClipSeconds, validateClipDraft } from "./clipDraft.util";

const video = { localId: "v", mediaType: "video" as const, durationSeconds: 240 };
const photo = (localId: string) => ({ localId, mediaType: "image" as const, durationSeconds: null });

describe("clip draft", () => {
  it("needs media and refuses a mix of video and photos", () => {
    assert.equal(validateClipDraft([], EMPTY_CLIP_EDITS), "Add a video or photos to continue.");
    assert.equal(validateClipDraft([video, photo("p")], EMPTY_CLIP_EDITS), "A clip uses one video or a set of photos, not both.");
  });

  it("caps clips at 3 minutes and trims long videos", () => {
    assert.equal(validateClipDraft([video], EMPTY_CLIP_EDITS), "Clips can be up to 3 minutes long.");
    const trim = clampTrim({ startSeconds: 10, endSeconds: 400 }, 240);
    assert.deepEqual(trim, { startSeconds: 10, endSeconds: 190 });
    assert.equal(validateClipDraft([video], { ...EMPTY_CLIP_EDITS, trim }), null);
  });

  it("sends the trim with the video and a slideshow for photos", () => {
    const fields = buildClipCreateFields([video], ["m1"], { ...EMPTY_CLIP_EDITS, trim: { startSeconds: 2, endSeconds: 12 } });
    assert.deepEqual(fields.media, [{ mediaId: "m1", type: "video", trim: { startMs: 2000, endMs: 12000 } }]);
    const photos = buildClipCreateFields([photo("a"), photo("b")], ["m1", "m2"], { ...EMPTY_CLIP_EDITS, photoSeconds: { a: 5 } });
    assert.deepEqual(photos.slideshow, { durationsMs: [5000, 3000], transition: "crossfade" });
    assert.equal(totalClipSeconds([photo("a"), photo("b")], { ...EMPTY_CLIP_EDITS, photoSeconds: { a: 5 } }), 8);
  });

  it("omits an untouched trim", () => {
    const short = { ...video, durationSeconds: 30 };
    assert.deepEqual(buildClipCreateFields([short], ["m1"], { ...EMPTY_CLIP_EDITS, trim: { startSeconds: 0, endSeconds: 30 } }).media, [{ mediaId: "m1", type: "video" }]);
  });
});
