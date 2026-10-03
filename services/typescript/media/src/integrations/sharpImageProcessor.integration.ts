import { open as openFile } from "node:fs/promises";
import { join } from "node:path";

import { encode } from "blurhash";
import sharp, { type Metadata, type Sharp } from "sharp";

import { defaultImageWidths, imageWidthsByPurpose, squareCropPurposes } from "../constants/purposePolicy.constant.js";
import { maximumInputPixels } from "../constants/media.constant.js";
import { MediaRejectedError } from "../errors/media.error.js";
import { sniffMimeType } from "../utils/magicBytes.util.js";
import type { ImageProcessor, ProcessedFile, ProcessedMedia, ProcessingInput } from "../interfaces/mediaProcessors.interface.js";

const formats = [
  { format: "avif", contentType: "image/avif", encode: (pipeline: Sharp) => pipeline.avif({ quality: 55, effort: 3 }) },
  { format: "webp", contentType: "image/webp", encode: (pipeline: Sharp) => pipeline.webp({ quality: 78 }) },
  { format: "jpeg", contentType: "image/jpeg", encode: (pipeline: Sharp) => pipeline.flatten({ background: "#ffffff" }).jpeg({ quality: 82, progressive: true, mozjpeg: true }) },
] as const;

export function selectImageWidths(purposeWidths: readonly number[], orientedWidth: number): readonly number[] {
  const fitting = purposeWidths.filter((width) => width <= orientedWidth);
  const widths = fitting.length > 0 ? fitting : [Math.min(orientedWidth, Math.max(...purposeWidths))];
  return [...new Set(widths)].sort((left, right) => left - right);
}

export type HeicConverter = (inputPath: string, outputJpegPath: string) => Promise<boolean>;

async function headIsHeic(path: string): Promise<boolean> {
  const handle = await openFile(path, "r");
  try {
    const buffer = Buffer.alloc(32);
    await handle.read(buffer, 0, 32, 0);
    return sniffMimeType(buffer) === "image/heic";
  } finally {
    await handle.close();
  }
}

export async function computeBlurhash(source: Sharp): Promise<string | undefined> {
  try {
    const { data, info } = await source.clone().resize(32, 32, { fit: "inside" }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
  } catch {
    return undefined;
  }
}

export function createSharpImageProcessor(options: { readonly convertHeic?: HeicConverter } = {}): ImageProcessor {
  return {
    async processImage(input: ProcessingInput): Promise<ProcessedMedia> {
      let inputPath = input.inputPath;
      const open = () => sharp(inputPath, { limitInputPixels: maximumInputPixels, failOn: "error" });
      let metadata: Metadata;
      try {
        metadata = await open().metadata();
        if (metadata.format === "heif") await open().resize(8, 8).toBuffer();
      } catch (error) {
        if (!(await headIsHeic(input.inputPath))) throw new MediaRejectedError("UNDECODABLE_IMAGE", error instanceof Error ? error.message : "The image could not be decoded.");
        const convertedPath = join(input.workDirectory, "converted.jpg");
        if (options.convertHeic === undefined || !(await options.convertHeic(input.inputPath, convertedPath))) throw new MediaRejectedError("UNSUPPORTED_IMAGE_FORMAT", "HEIC photos must be converted to JPEG before upload.");
        inputPath = convertedPath;
        try {
          metadata = await open().metadata();
        } catch {
          throw new MediaRejectedError("UNSUPPORTED_IMAGE_FORMAT", "HEIC photos must be converted to JPEG before upload.");
        }
      }
      const swapped = (metadata.orientation ?? 1) >= 5;
      const orientedWidth = (swapped ? metadata.height : metadata.width) ?? 0;
      const orientedHeight = (swapped ? metadata.width : metadata.height) ?? 0;
      if (orientedWidth === 0 || orientedHeight === 0) throw new MediaRejectedError("UNDECODABLE_IMAGE");
      const widths = selectImageWidths(imageWidthsByPurpose[input.purpose] ?? defaultImageWidths, orientedWidth);
      const square = squareCropPurposes.has(input.purpose);
      const files: ProcessedFile[] = [];
      try {
        for (const width of widths) {
          for (const target of formats) {
            const resized = open().rotate().resize(square ? { width, height: width, fit: "cover" } : { width, withoutEnlargement: true });
            const { data, info } = await target.encode(resized).toBuffer({ resolveWithObject: true });
            files.push({ name: `w${width}.${target.format === "jpeg" ? "jpg" : target.format}`, contentType: target.contentType, format: target.format, width: info.width, height: info.height, isVariant: true, source: { buffer: data }, sizeBytes: data.byteLength });
          }
        }
      } catch (error) {
        throw new MediaRejectedError("UNDECODABLE_IMAGE", error instanceof Error ? error.message : "The image could not be re-encoded.");
      }
      const jpegs = files.filter((file) => file.format === "jpeg");
      const largestJpeg = jpegs.at(-1);
      if (largestJpeg !== undefined) files.push({ ...largestJpeg, name: "display.jpg", isVariant: false });
      const frame = largestJpeg?.source;
      const blurhash = await computeBlurhash(open().rotate());
      return { width: orientedWidth, height: orientedHeight, ...(blurhash === undefined ? {} : { blurhash }), files, moderationFrames: frame !== undefined && "buffer" in frame ? [frame.buffer] : [] };
    },
  };
}
