import { resolveMockApiRequest } from "@/mocks";
import { buildClipMediaFromInput } from "@/mocks/clipCreate.mock";
import { sanitizeTaggedUserIds } from "@/mocks/postTags.mock";
import type { Media, NewPostInput, PostLocationTag, TagCandidate } from "@/types";

const photo = (url: string): Media => ({ type: "image", url, status: "ready" });
const baseInput: NewPostInput = { text: "", mediaIds: ["a", "b"], audience: "everyone", kind: "clip" };

describe("clip create mocks", () => {
  it("turns a photo slideshow into one processing video rendered server-side", () => {
    const media = buildClipMediaFromInput({ ...baseInput, slideshow: { durationsMs: [3000, 4000], transition: "crossfade" } }, [photo("p1"), photo("p2")], "render_1");
    expect(media).toEqual([expect.objectContaining({ id: "render_1", type: "video", status: "processing", posterUrl: "p1", durationSeconds: 7 })]);
  });

  it("rejects bad slideshow durations and over-long trims", () => {
    expect(() => buildClipMediaFromInput({ ...baseInput, slideshow: { durationsMs: [500, 3000], transition: "none" } }, [photo("p1"), photo("p2")], "r")).toThrow(/1 to 10 seconds/);
    const video: Media = { type: "video", url: "v", durationSeconds: 300, status: "ready" };
    expect(() => buildClipMediaFromInput({ ...baseInput, media: [{ mediaId: "a", type: "video", trim: { startMs: 0, endMs: 200_000 } }] }, [video], "r")).toThrow(/trim/);
  });

  it("searches places by text only", async () => {
    const result = await resolveMockApiRequest<{ places: PostLocationTag[] }>("GET", "/api/v1/places/search?q=lagos", undefined);
    expect(result.places.length).toBeGreaterThan(0);
  });

  it("hides blockers from tag search, marks people who turned tagging off, and caps tags at 20", async () => {
    const result = await resolveMockApiRequest<{ candidates: TagCandidate[] }>("GET", "/api/v1/tags/candidates?q=", undefined);
    expect(result.candidates.some((candidate) => candidate.user.id === "u_14")).toBe(false);
    expect(sanitizeTaggedUserIds("u_me", ["u_10", "u_14", "u_1"])).toEqual(["u_1"]);
    expect(() => sanitizeTaggedUserIds("u_me", Array.from({ length: 21 }, (_, index) => `u_${index}`))).toThrow(/20/);
  });
});
