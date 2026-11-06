import { describe, expect, it } from "vitest";

import { purposePolicies, videoMimeTypes } from "../../src/constants/purposePolicy.constant.js";
import { MediaError } from "../../src/errors/media.error.js";
import { expectedChunkBytes, planUpload } from "../../src/utils/chunkPlan.util.js";
import { requireUploadAllowed } from "../../src/utils/purposePolicy.util.js";

const mebibyte = 1024 * 1024;

describe("upload allowlists per purpose", () => {
  it("allows Story video MIME types up to 100 MiB and 60 seconds", () => {
    const storyVideoRule = purposePolicies.story.rules.find((rule) => rule.kind === "video");

    expect(storyVideoRule).toMatchObject({
      mimeTypes: videoMimeTypes,
      maximumBytes: 100 * mebibyte,
      maximumDurationSeconds: 60,
    });
    for (const mimeType of videoMimeTypes) {
      expect(requireUploadAllowed("story", mimeType, 100 * mebibyte).kind).toBe("video");
    }
    expect(() => requireUploadAllowed("story", "video/mp4", 100 * mebibyte + 1)).toThrow(
      expect.objectContaining({ status: 413, code: "FILE_TOO_LARGE" }),
    );
  });

  it("accepts allowed type and size combinations", () => {
    expect(requireUploadAllowed("avatar", "image/jpeg", 2 * mebibyte).kind).toBe("image");
    expect(requireUploadAllowed("post", "video/mp4", 400 * mebibyte).kind).toBe("video");
    expect(requireUploadAllowed("voice", "audio/mp4", mebibyte).kind).toBe("audio");
    expect(requireUploadAllowed("kyc", "application/pdf", 5 * mebibyte).kind).toBe("document");
    expect(requireUploadAllowed("post", "image/jpg", mebibyte).kind).toBe("image");
    expect(requireUploadAllowed("post", "image/heif; charset=binary", mebibyte).kind).toBe("image");
  });

  it("rejects types that are not allowed for the purpose with 415", () => {
    for (const [purpose, mime] of [["avatar", "video/mp4"], ["kyc", "video/mp4"], ["clip", "image/png"], ["voice", "image/png"], ["post", "application/x-msdownload"], ["chat", "image/svg+xml"]] as const) {
      expect(() => requireUploadAllowed(purpose, mime, 1000)).toThrow(expect.objectContaining({ status: 415, code: "UNSUPPORTED_MEDIA_TYPE" }));
    }
  });

  it("enforces per purpose size caps with 413", () => {
    expect(() => requireUploadAllowed("avatar", "image/png", 6 * mebibyte)).toThrow(expect.objectContaining({ status: 413, code: "FILE_TOO_LARGE" }));
    expect(() => requireUploadAllowed("kyc", "application/pdf", 11 * mebibyte)).toThrow(MediaError);
    expect(() => requireUploadAllowed("clip", "video/mp4", 501 * mebibyte)).toThrow(MediaError);
  });

  it("keeps identity documents and chat private and the rest public", () => {
    expect(purposePolicies.kyc.isPrivate).toBe(true);
    expect(purposePolicies.chat.isPrivate).toBe(true);
    expect(purposePolicies.chat.retentionDays).toBe(30);
    expect(purposePolicies.post.isPrivate).toBe(false);
    expect(purposePolicies.kyc.moderate).toBe(false);
  });
});

describe("upload plan selection", () => {
  it("uses a single PUT below 8 MB", () => {
    expect(planUpload(1)).toMatchObject({ mode: "single", partCount: 1, partSizeBytes: 1 });
    expect(planUpload(8 * mebibyte - 1)).toMatchObject({ mode: "single" });
  });

  it("uses 8 MB parts with parallelism for 8 to 100 MB", () => {
    expect(planUpload(8 * mebibyte)).toMatchObject({ mode: "multipart", partSizeBytes: 8 * mebibyte, partCount: 1, recommendedParallelism: 4 });
    expect(planUpload(100 * mebibyte)).toMatchObject({ mode: "multipart", partSizeBytes: 8 * mebibyte, partCount: 13 });
  });

  it("uses 16 to 64 MB parts above 100 MB keeping the part count at or below 200", () => {
    expect(planUpload(101 * mebibyte)).toMatchObject({ partSizeBytes: 16 * mebibyte, partCount: 7 });
    expect(planUpload(500 * mebibyte)).toMatchObject({ partSizeBytes: 16 * mebibyte, partCount: 32 });
    expect(planUpload(4000 * mebibyte)).toMatchObject({ partSizeBytes: 32 * mebibyte, partCount: 125 });
    expect(planUpload(8000 * mebibyte)).toMatchObject({ partSizeBytes: 64 * mebibyte, partCount: 125 });
  });

  it("sizes the last part to the remainder", () => {
    const plan = planUpload(20 * mebibyte);
    expect(expectedChunkBytes(0, 20 * mebibyte, plan.partSizeBytes, plan.partCount)).toBe(8 * mebibyte);
    expect(expectedChunkBytes(2, 20 * mebibyte, plan.partSizeBytes, plan.partCount)).toBe(4 * mebibyte);
  });
});
