import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";

import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { createHeicConverter } from "../../src/integrations/heicConverter.integration.js";
import { createJobMessageHandler, parseJobMessage } from "../../src/integrations/rabbitMqJobQueue.integration.js";
import { createSharpImageProcessor } from "../../src/integrations/sharpImageProcessor.integration.js";
import { PoisonMessageError } from "../../src/errors/poisonMessage.error.js";
import { runMediaPipeline } from "../../src/modules/assets/services/mediaPipeline.service.js";
import { createHarness, firstAttempt, testConfig } from "../fakes/pipelineHarness.js";

const heicBytes = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypheic"), Buffer.alloc(200, 1)]);
const jpeg = () => sharp({ create: { width: 800, height: 600, channels: 3, background: "#aa5522" } }).jpeg().toBuffer();

describe("heic handling", () => {
  it("converts through the worker tool when sharp cannot decode heic", async () => {
    const converted = await jpeg();
    const convertHeic = createHeicConverter({ heifConvertPath: "heif-convert", ffmpeg: testConfig().ffmpeg, run: async (_command, args) => { await writeFile(args.at(-1) as string, converted); return ""; } });
    const harness = createHarness({ images: createSharpImageProcessor({ convertHeic }) });
    const id = harness.seedUpload({ purpose: "post", mimeType: "image/heic", bytes: heicBytes });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(id)).toMatchObject({ status: "ready", width: 800, height: 600 });
  });

  it("falls back to ffmpeg when heif-convert is missing", async () => {
    const converted = await jpeg();
    const used: string[] = [];
    const convertHeic = createHeicConverter({ heifConvertPath: "heif-convert", ffmpeg: testConfig().ffmpeg, run: async (command, args) => { used.push(command); if (command === "heif-convert") throw new Error("ENOENT"); await writeFile(args.at(-1) as string, converted); return ""; } });
    expect(await convertHeic("/in.heic", `${process.env["TMPDIR"] ?? "/tmp"}/${randomUUID()}.jpg`)).toBe(true);
    expect(used).toEqual(["heif-convert", "ffmpeg"]);
  });

  it("rejects with UNSUPPORTED_IMAGE_FORMAT and a convert-to-jpeg hint when nothing can decode it", async () => {
    const harness = createHarness({ images: createSharpImageProcessor({ convertHeic: async () => false }) });
    const id = harness.seedUpload({ purpose: "post", mimeType: "image/heic", bytes: heicBytes });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(harness.db.assets.get(id)).toMatchObject({ status: "rejected", rejectionReason: "UNSUPPORTED_IMAGE_FORMAT" });
  });
});

describe("blurhash", () => {
  it("stores a blurhash for processed images", async () => {
    const harness = createHarness();
    const id = harness.seedUpload({ purpose: "post", mimeType: "image/jpeg", bytes: await jpeg() });
    await runMediaPipeline(harness.context, id, { attempt: firstAttempt, moderationApproved: false });
    expect(String(harness.db.assets.get(id)?.["blurhash"])).toMatch(/^[0-9A-Za-z#$%*+,\-.:;=?@[\]^_{|}~]{6,}$/);
  });
});

describe("job messages", () => {
  it("parses jobs, passes the delivery attempt and treats junk as poison", async () => {
    const seen: { payload: unknown; final: boolean }[] = [];
    const handle = createJobMessageHandler({ "media.process": async (payload, attempt) => { seen.push({ payload, final: attempt.isFinalAttempt }); } });
    await handle(JSON.stringify({ id: randomUUID(), type: "media.process", payload: { mediaId: "m" } }), 5);
    expect(seen).toEqual([{ payload: { mediaId: "m" }, final: true }]);
    await expect(handle("not json", 1)).rejects.toBeInstanceOf(PoisonMessageError);
    await expect(handle(JSON.stringify({ id: "x", type: "nope", payload: {} }), 1)).rejects.toBeInstanceOf(PoisonMessageError);
    expect(() => parseJobMessage("{}")).toThrow(PoisonMessageError);
  });
});
