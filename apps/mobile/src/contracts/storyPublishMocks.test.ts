import { resolveMockApiRequest } from "@/mocks";
import type { NewStoryInput, Story } from "@/types";

const createUploadedMediaId = async () =>
  (await resolveMockApiRequest<{ mediaId: string }>("POST", "/api/v1/media/uploads", { fileName: "story.jpg", mimeType: "image/jpeg", sizeBytes: 1000, purpose: "story" })).mediaId;

describe("story publish mocks", () => {
  it("publishes with the social contract of mediaId, sound and look only", async () => {
    const input: NewStoryInput = { mediaId: await createUploadedMediaId(), look: "warm" };
    expect(Object.keys(input).sort()).toEqual(["look", "mediaId"]);
    const story = await resolveMockApiRequest<Story & { look: string | null }>("POST", "/api/v1/stories", input);
    expect(story.media).toEqual(expect.objectContaining({ id: input.mediaId }));
    expect(story.look).toBe("warm");
  });

  it("refuses a story whose upload doesn't exist", async () => {
    await expect(resolveMockApiRequest("POST", "/api/v1/stories", { mediaId: "med_missing" })).rejects.toMatchObject({ code: "MEDIA_NOT_FOUND" });
  });
});
