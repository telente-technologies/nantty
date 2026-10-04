import {
  EMPTY_CLIP_EDITS,
  buildClipCreateFields,
  clampTrim,
  moveItem,
  totalClipSeconds,
  validateClipDraft,
  type ClipDraftMedia,
} from "../clipDraft.util";

const photo = (jobId: string): ClipDraftMedia => ({ jobId, mediaType: "image", durationSeconds: null });
const video = (durationSeconds: number | null): ClipDraftMedia => ({ jobId: "v1", mediaType: "video", durationSeconds });

describe("clip draft", () => {
  it("builds a slideshow payload with per-photo durations in milliseconds", () => {
    const items = [photo("a"), photo("b")];
    const edits = { ...EMPTY_CLIP_EDITS, photoSeconds: { b: 5 }, transition: "slide" as const };
    expect(buildClipCreateFields(items, ["m1", "m2"], edits)).toEqual({
      media: [{ mediaId: "m1", type: "image" }, { mediaId: "m2", type: "image" }],
      slideshow: { durationsMs: [3000, 5000], transition: "slide" },
    });
    expect(totalClipSeconds(items, edits)).toBe(8);
  });

  it("sends a trim only when the video was actually shortened", () => {
    expect(buildClipCreateFields([video(40)], ["m1"], { ...EMPTY_CLIP_EDITS, trim: { startSeconds: 0, endSeconds: 40 } })).toEqual({ media: [{ mediaId: "m1", type: "video" }] });
    expect(buildClipCreateFields([video(40)], ["m1"], { ...EMPTY_CLIP_EDITS, trim: { startSeconds: 2, endSeconds: 30 } }).media[0]).toEqual({
      mediaId: "m1",
      type: "video",
      trim: { startMs: 2000, endMs: 30000 },
    });
  });

  it("keeps a trim inside the video and the 180 second cap", () => {
    expect(clampTrim({ startSeconds: 10, endSeconds: 500 }, 400)).toEqual({ startSeconds: 10, endSeconds: 190 });
    expect(clampTrim({ startSeconds: 39.5, endSeconds: 39.6 }, 40)).toEqual({ startSeconds: 39, endSeconds: 40 });
  });

  it("rejects empty, mixed and over-long drafts", () => {
    expect(validateClipDraft([], EMPTY_CLIP_EDITS)).toMatch(/Add a video/);
    expect(validateClipDraft([video(10), photo("a")], EMPTY_CLIP_EDITS)).toMatch(/not both/);
    const tooLong = { ...EMPTY_CLIP_EDITS, photoSeconds: Object.fromEntries(Array.from({ length: 10 }, (_, index) => [`p${index}`, 10])) };
    expect(validateClipDraft(Array.from({ length: 10 }, (_, index) => photo(`p${index}`)), tooLong)).toBeNull();
    expect(validateClipDraft([video(200)], EMPTY_CLIP_EDITS)).toMatch(/3 minutes/);
  });

  it("moves an item to a new position", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
    expect(moveItem(["a", "b"], 0, 5)).toEqual(["a", "b"]);
  });
});
