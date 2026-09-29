import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type {
  ImageProcessor,
  ProcessedImage,
  ProcessedVideo,
  VideoProbeResult,
  VideoProcessor,
  VideoTranscodeRequest,
} from "../../../src/modules/media/models/mediaProcessing.model.js";
import { InMemoryMediaBlobStore } from "../../../src/modules/media/services/mediaBlobStore.service.js";
import type { MediaProcessingQueue } from "../../../src/modules/media/services/mediaProcessingQueue.service.js";
import { createTestApplication, type TestApplicationOptions } from "../../fixtures/testApplication.fixture.js";

export const TEST_CHUNK_SIZE = 1024;

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function buildPngBytes(totalBytes: number): Uint8Array {
  const bytes = new Uint8Array(totalBytes);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (let index = 8; index < totalBytes; index += 1) bytes[index] = (index * 31) % 251;
  return bytes;
}

export function buildMp4Bytes(totalBytes: number): Uint8Array {
  const bytes = new Uint8Array(totalBytes);
  bytes.set([0, 0, 0, 0x18, ...new TextEncoder().encode("ftypisom")]);
  return bytes;
}

export function buildPdfBytes(totalBytes: number): Uint8Array {
  const bytes = new Uint8Array(totalBytes).fill(0x20);
  bytes.set(new TextEncoder().encode("%PDF-1.7\n"));
  return bytes;
}

export class FakeImageProcessor implements ImageProcessor {
  public failuresBeforeSuccess = 0;
  public readonly attemptTimes: number[] = [];
  public gate: Promise<void> | undefined;

  public async processImage(original: Uint8Array): Promise<ProcessedImage> {
    this.attemptTimes.push(Date.now());
    if (this.gate !== undefined) await this.gate;
    if (this.failuresBeforeSuccess > 0) {
      this.failuresBeforeSuccess -= 1;
      throw new Error("temporary encoder failure");
    }
    const marker = sha256Hex(original).slice(0, 8);
    const variants = [320, 640].flatMap((width) =>
      (["avif", "webp", "jpeg"] as const).map((format) => ({ format, width, height: width / 2, bytes: new TextEncoder().encode(`${format}-${width}-${marker}`) })),
    );
    return { width: 800, height: 400, blurhash: "LEHV6nWB2yk8pyo0adR*.7kCMdnj", variants };
  }

  public async computeBlurhash(): Promise<string | null> {
    return "L00000fQfQfQfQfQfQfQfQfQfQfQ";
  }
}

export class FakeVideoProcessor implements VideoProcessor {
  public durationSeconds = 12;

  public async probeVideo(): Promise<VideoProbeResult> {
    return { width: 1920, height: 1080, durationSeconds: this.durationSeconds };
  }

  public async transcodeVideo(request: VideoTranscodeRequest): Promise<ProcessedVideo> {
    const write = async (relativePath: string, content: string) => {
      const localPath = join(request.outputDirectory, relativePath);
      await mkdir(join(localPath, ".."), { recursive: true });
      await writeFile(localPath, content);
      return localPath;
    };
    const hlsFiles = [
      { relativePath: "master.m3u8", localPath: await write("hls/master.m3u8", "#EXTM3U\n360p/index.m3u8\n"), contentType: "application/vnd.apple.mpegurl" },
      { relativePath: "360p/index.m3u8", localPath: await write("hls/360p/index.m3u8", "#EXTM3U\nsegment_0000.ts\n"), contentType: "application/vnd.apple.mpegurl" },
      { relativePath: "360p/segment_0000.ts", localPath: await write("hls/360p/segment_0000.ts", "segment"), contentType: "video/mp2t" },
    ];
    return {
      mp4: { relativePath: "video.mp4", localPath: await write("video.mp4", "mp4-bytes"), contentType: "video/mp4", width: 1920, height: 1080, bitrateKbps: 5128 },
      poster: { relativePath: "poster.jpg", localPath: await write("poster.jpg", "jpeg-bytes"), contentType: "image/jpeg", width: 1920, height: 1080 },
      hlsMasterRelativePath: "master.m3u8",
      hlsFiles,
      hlsRenditions: [{ width: 640, height: 360, bitrateKbps: 896 }],
    };
  }
}

export function createMediaTestApplication(options: TestApplicationOptions = {}) {
  const imageProcessor = new FakeImageProcessor();
  const videoProcessor = new FakeVideoProcessor();
  const blobs = new InMemoryMediaBlobStore();
  const app = createTestApplication({
    ...options,
    external: { mediaBlobStore: blobs, mediaProcessors: { image: imageProcessor, video: videoProcessor }, ...options.external },
  });
  const processingQueue = app.dependencies.ports.mediaProcessingQueue as MediaProcessingQueue;

  async function startUpload(accessToken: string, bytes: Uint8Array, overrides: Record<string, unknown> = {}) {
    const response = await app.client
      .post("/api/v1/media/uploads")
      .auth(accessToken)
      .send({ fileName: "photo.png", mimeType: "image/png", sizeBytes: bytes.byteLength, purpose: "post", ...overrides })
      .expect(201);
    return response.json<{ uploadId: string; chunkSizeBytes: number; totalChunks: number; uploadedChunks: number[] }>();
  }

  function sendChunk(accessToken: string, uploadId: string, chunkIndex: number, chunk: Uint8Array, hash = sha256Hex(chunk)) {
    return app.client
      .put(`/api/v1/media/uploads/${uploadId}/chunks/${chunkIndex}`)
      .auth(accessToken)
      .set("content-type", "application/octet-stream")
      .set("x-chunk-sha256", hash)
      .send(chunk);
  }

  function sliceChunk(bytes: Uint8Array, chunkIndex: number): Uint8Array {
    return bytes.subarray(chunkIndex * TEST_CHUNK_SIZE, (chunkIndex + 1) * TEST_CHUNK_SIZE);
  }

  async function uploadWholeFile(accessToken: string, bytes: Uint8Array, overrides: Record<string, unknown> = {}): Promise<string> {
    const upload = await startUpload(accessToken, bytes, overrides);
    for (let index = 0; index < upload.totalChunks; index += 1) await sendChunk(accessToken, upload.uploadId, index, sliceChunk(bytes, index)).expect(200);
    const completed = await app.client.post(`/api/v1/media/uploads/${upload.uploadId}/complete`).auth(accessToken).expect(202);
    return completed.json<{ mediaId: string }>().mediaId;
  }

  return { ...app, blobs, imageProcessor, videoProcessor, processingQueue, startUpload, sendChunk, sliceChunk, uploadWholeFile };
}
