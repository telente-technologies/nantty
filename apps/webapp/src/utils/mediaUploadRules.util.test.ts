import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calculateBackoffDelayWithJitter, classifyPickedMedia, isRetryableUploadFailure, MediaValidationError, missingChunkIndexes, planUploadChunks, runTasksWithBoundedConcurrency, validatePickedMediaBeforeUpload,
} from "./mediaUploadRules.util";

const MEGABYTE = 1024 * 1024;

describe("media upload rules", () => {
  it("accepts the same photo and video formats as the app", () => {
    assert.equal(classifyPickedMedia("image/heic"), "image");
    assert.equal(classifyPickedMedia("video/quicktime"), "video");
    assert.equal(classifyPickedMedia("image/gif"), null);
  });

  it("rejects files the app rejects, with the app's copy", () => {
    assert.throws(() => validatePickedMediaBeforeUpload({ mimeType: "image/gif", sizeBytes: 10, durationSeconds: null }, "post"), /This photo format isn't supported./);
    assert.throws(() => validatePickedMediaBeforeUpload({ mimeType: "image/jpeg", sizeBytes: 41 * MEGABYTE, durationSeconds: null }, "post"), /This photo is too large./);
    assert.throws(() => validatePickedMediaBeforeUpload({ mimeType: "application/pdf", sizeBytes: 10, durationSeconds: null }, "post"), /Only photos and videos can be added./);
    assert.throws(() => validatePickedMediaBeforeUpload({ mimeType: "video/mp4", sizeBytes: 10, durationSeconds: 601 }, "post"), /Videos can be up to 10 minutes long./);
    assert.throws(() => validatePickedMediaBeforeUpload({ mimeType: "video/mp4", sizeBytes: 10, durationSeconds: 5 }, "avatar"), /Only photos can be used here./);
    assert.equal(validatePickedMediaBeforeUpload({ mimeType: "video/mp4", sizeBytes: 50 * MEGABYTE, durationSeconds: 30 }, "post"), "video");
  });

  it("uses one PUT under 8 MB and the server's part plan above it", () => {
    assert.deepEqual(planUploadChunks(5 * MEGABYTE, { chunkSizeBytes: 512, totalChunks: 9 }), { mode: "single", chunkSizeBytes: 5 * MEGABYTE, totalChunks: 1 });
    assert.deepEqual(planUploadChunks(40 * MEGABYTE, { mode: "multipart", partSizeBytes: 8 * MEGABYTE, partCount: 5, chunkSizeBytes: 1, totalChunks: 1 }), { mode: "multipart", chunkSizeBytes: 8 * MEGABYTE, totalChunks: 5 });
  });

  it("resumes only the parts the server has not stored", () => {
    assert.deepEqual(missingChunkIndexes(5, [0, 2]), [1, 3, 4]);
  });

  it("retries only transient failures", () => {
    assert.equal(isRetryableUploadFailure({ status: 503 }), true);
    assert.equal(isRetryableUploadFailure({ status: 0 }), true);
    assert.equal(isRetryableUploadFailure({ status: 422 }), false);
    assert.equal(isRetryableUploadFailure(new MediaValidationError("bad")), false);
    assert.equal(isRetryableUploadFailure(new DOMException("stop", "AbortError")), false);
    assert.equal(calculateBackoffDelayWithJitter(10, 600, 15_000, () => 1), 15_000);
  });

  it("runs at most N parts at once and reports the first failure", async () => {
    let running = 0;
    let peak = 0;
    await runTasksWithBoundedConcurrency([1, 2, 3, 4, 5, 6, 7, 8], 4, async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 2));
      running--;
    });
    assert.equal(peak, 4);
    await assert.rejects(runTasksWithBoundedConcurrency([1, 2, 3], 2, async (item) => { if (item === 2) throw new Error("part 2 failed"); }), /part 2 failed/);
  });
});
