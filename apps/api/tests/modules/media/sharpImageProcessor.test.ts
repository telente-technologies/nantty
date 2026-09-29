import sharp from "sharp";
import { describe, expect, it } from "vitest";

import { UnprocessableMediaError } from "../../../src/modules/media/models/mediaProcessing.model.js";
import { SharpImageProcessor } from "../../../src/modules/media/services/sharpImageProcessor.service.js";

async function createJpegWithExif(width: number, height: number): Promise<Uint8Array> {
  const buffer = await sharp({ create: { width, height, channels: 3, background: { r: 200, g: 80, b: 40 } } })
    .jpeg()
    .withExif({ IFD0: { Copyright: "secret-owner", Make: "TestCam" } })
    .toBuffer();
  return new Uint8Array(buffer);
}

describe("SharpImageProcessor", () => {
  it("makes avif, webp and jpeg variants without upscaling and strips metadata", async () => {
    const processed = await new SharpImageProcessor().processImage(await createJpegWithExif(700, 350));
    expect(processed).toMatchObject({ width: 700, height: 350, blurhash: expect.any(String) });
    expect(processed.variants.map((variant) => `${variant.format}:${variant.width}`).sort()).toEqual(
      ["avif:320", "avif:640", "jpeg:320", "jpeg:640", "webp:320", "webp:640"],
    );
    for (const variant of processed.variants) {
      const metadata = await sharp(variant.bytes).metadata();
      expect(metadata.exif).toBeUndefined();
      expect(metadata.width).toBe(variant.width);
    }
  });

  it("keeps the original width when the image is smaller than every target", async () => {
    const processed = await new SharpImageProcessor().processImage(await createJpegWithExif(100, 60));
    expect(new Set(processed.variants.map((variant) => variant.width))).toEqual(new Set([100]));
  });

  it("rejects bytes that are not an image", async () => {
    await expect(new SharpImageProcessor().processImage(new TextEncoder().encode("not an image"))).rejects.toBeInstanceOf(UnprocessableMediaError);
  });
});
