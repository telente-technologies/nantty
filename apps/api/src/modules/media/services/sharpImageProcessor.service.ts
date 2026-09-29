import { encode } from "blurhash";
import type { Sharp } from "sharp";

import {
  IMAGE_VARIANT_WIDTHS,
  UnprocessableMediaError,
  type ImageProcessor,
  type ImageVariantFormat,
  type ProcessedImage,
  type ProcessedImageVariant,
} from "../models/mediaProcessing.model.js";

const MAX_INPUT_PIXELS = 100_000_000;
const BLURHASH_SIZE = 32;

type SharpFactory = (input: Uint8Array, options: { limitInputPixels: number; failOn: "error" }) => Sharp;

let sharpFactory: SharpFactory | undefined;

async function loadSharp(): Promise<SharpFactory> {
  if (sharpFactory === undefined) sharpFactory = (await import("sharp")).default as unknown as SharpFactory;
  return sharpFactory;
}

function chooseVariantWidths(originalWidth: number): readonly number[] {
  const widths = IMAGE_VARIANT_WIDTHS.filter((width) => width <= originalWidth);
  return widths.length > 0 ? widths : [originalWidth];
}

function encodeInFormat(pipeline: Sharp, format: ImageVariantFormat): Sharp {
  if (format === "avif") return pipeline.avif({ quality: 50, effort: 4 });
  if (format === "webp") return pipeline.webp({ quality: 78 });
  return pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: 80, mozjpeg: true, progressive: true });
}

export class SharpImageProcessor implements ImageProcessor {
  public async processImage(original: Uint8Array): Promise<ProcessedImage> {
    const createPipeline = await loadSharp();
    const orientedSource = await this.decodeAndOrient(createPipeline, original);
    const { width, height } = orientedSource.info;
    const variants: ProcessedImageVariant[] = [];
    for (const targetWidth of chooseVariantWidths(width)) {
      for (const format of ["avif", "webp", "jpeg"] as const) {
        const resized = createPipeline(orientedSource.data, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" }).resize({ width: targetWidth, withoutEnlargement: true });
        const output = await encodeInFormat(resized, format).toBuffer({ resolveWithObject: true });
        variants.push({ format, width: output.info.width, height: output.info.height, bytes: new Uint8Array(output.data) });
      }
    }
    return { width, height, blurhash: await this.computeBlurhash(orientedSource.data), variants };
  }

  public async computeBlurhash(image: Uint8Array): Promise<string | null> {
    const createPipeline = await loadSharp();
    try {
      const { data, info } = await createPipeline(image, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
        .resize(BLURHASH_SIZE, BLURHASH_SIZE, { fit: "inside" })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
    } catch {
      return null;
    }
  }

  private async decodeAndOrient(createPipeline: SharpFactory, original: Uint8Array) {
    try {
      return await createPipeline(original, { limitInputPixels: MAX_INPUT_PIXELS, failOn: "error" })
        .rotate()
        .png({ compressionLevel: 1 })
        .toBuffer({ resolveWithObject: true });
    } catch {
      throw new UnprocessableMediaError("This image could not be read.");
    }
  }
}
