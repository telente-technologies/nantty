import { MediaValidationError, validateLocalMediaBeforeUpload } from "./mediaPreparation.service";

const STORY_VIDEO_LIMIT_BYTES = 100 * 1024 * 1024;

describe("Story video upload limits", () => {
  it("accepts a video at the 100 MiB limit", () => {
    expect(() => validateLocalMediaBeforeUpload({
      uri: "file:///story.mp4",
      mediaType: "video",
      mimeType: "video/mp4",
      fileName: "story.mp4",
      sizeBytes: STORY_VIDEO_LIMIT_BYTES,
      width: null,
      height: null,
      durationSeconds: 60,
    }, "story")).not.toThrow();
  });

  it("rejects a video one byte above the 100 MiB limit", () => {
    expect(() => validateLocalMediaBeforeUpload({
      uri: "file:///story.mp4",
      mediaType: "video",
      mimeType: "video/mp4",
      fileName: "story.mp4",
      sizeBytes: STORY_VIDEO_LIMIT_BYTES + 1,
      width: null,
      height: null,
      durationSeconds: 60,
    }, "story")).toThrow(MediaValidationError);
  });
});
