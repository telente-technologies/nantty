import sharp from "sharp";

import { wordmarkPath, wordmarkSmallPath, type BrandPath } from "../constants/brandWordmark.constant.js";

export type WordmarkStyle = "badge" | "endCard";

export interface WordmarkRaster {
  readonly png: Buffer;
  readonly width: number;
  readonly height: number;
  readonly bleed: number;
}

const opticalSmallMaxHeight = 28;
const maximumCachedRasters = 64;
const warmBadgeHeights = [10, 12, 14, 16, 20, 24, 30, 36, 42, 50];
const warmEndCardHeights = [48, 64, 84, 96];
const cache = new Map<string, Promise<WordmarkRaster>>();

export function buildWordmarkRasterSvg(path: BrandPath, height: number, outline: boolean): { readonly svg: string; readonly width: number; readonly height: number; readonly bleed: number } {
  const scale = height / path.height;
  const strokeUnits = outline ? path.height * 0.07 : 0;
  const bleed = Math.ceil((strokeUnits / 2) * scale);
  const width = Math.ceil(path.width * scale) + bleed * 2;
  const totalHeight = height + bleed * 2;
  const pad = bleed / scale;
  const stroke = outline ? ` stroke="rgba(0,0,0,0.45)" stroke-width="${strokeUnits.toFixed(1)}" stroke-linejoin="round" paint-order="stroke"` : "";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="${(-pad).toFixed(2)} ${(-pad).toFixed(2)} ${(width / scale).toFixed(2)} ${(totalHeight / scale).toFixed(2)}">`
    + `<path d="${path.d}" fill="#FFFFFF"${stroke}/></svg>`;
  return { svg, width, height: totalHeight, bleed };
}

async function rasterise(height: number, style: WordmarkStyle): Promise<WordmarkRaster> {
  const path = height <= opticalSmallMaxHeight ? wordmarkSmallPath : wordmarkPath;
  const built = buildWordmarkRasterSvg(path, height, style === "badge");
  const png = await sharp(Buffer.from(built.svg)).png().toBuffer();
  return { png, width: built.width, height: built.height, bleed: built.bleed };
}

export function getWordmarkRaster(height: number, style: WordmarkStyle): Promise<WordmarkRaster> {
  const rounded = Math.max(6, Math.round(height));
  const key = `${style}:${rounded}`;
  const cached = cache.get(key);
  if (cached) return cached;
  if (cache.size >= maximumCachedRasters) cache.delete(cache.keys().next().value as string);
  const pending = rasterise(rounded, style);
  pending.catch(() => cache.delete(key));
  cache.set(key, pending);
  return pending;
}

export async function warmBrandWordmarkAssets(): Promise<void> {
  await Promise.all([...warmBadgeHeights.map((height) => getWordmarkRaster(height, "badge")), ...warmEndCardHeights.map((height) => getWordmarkRaster(height, "endCard"))]);
}

export async function withOpacity(png: Buffer, opacity: number): Promise<Buffer> {
  return sharp(png).ensureAlpha().linear([1, 1, 1, opacity], [0, 0, 0, 0]).png().toBuffer();
}
