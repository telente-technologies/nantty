import { symbolLeftHalfPath, symbolPath, symbolRightHalfPath, symbolTileRadius, symbolViewBox, wordmarkPath, wordmarkSmallPath } from "../constants/brandWordmark.constant.js";

export const zudomartBrandColour = "#3A2BFF";

const handlePattern = /^[a-z0-9._]{1,30}$/;

export function normalizeWatermarkHandle(handle: string): string | undefined {
  const trimmed = handle.trim().replace(/^@/, "").toLowerCase();
  return handlePattern.test(trimmed) ? trimmed : undefined;
}

export interface WatermarkBox {
  readonly width: number;
  readonly height: number;
  readonly margin: number;
}

const watermarkViewBoxHeight = 72;
const textLeft = 78;
const wordmarkSlot = { top: 9, height: 30 };
const signatureAspect = wordmarkSmallPath.width / wordmarkSmallPath.height;

function watermarkViewBoxWidth(handle: string): number {
  const wordmarkWidth = wordmarkSlot.height * signatureAspect;
  const handleWidth = 19 * 0.6 * (handle.length + 1);
  return Math.ceil(textLeft + Math.max(wordmarkWidth, handleWidth) + 12);
}

const toEven = (value: number) => Math.max(2, Math.round(value / 2) * 2);

export function computeWatermarkBox(frameWidth: number, frameHeight: number, handle: string, heightRatio: number): WatermarkBox {
  const shortSide = Math.min(frameWidth, frameHeight);
  const height = toEven(Math.min(120, Math.max(24, shortSide * heightRatio)));
  const width = toEven((height * watermarkViewBoxWidth(handle)) / watermarkViewBoxHeight);
  return { width: Math.min(width, toEven(frameWidth * 0.6)), height, margin: Math.max(8, Math.round(height * 0.35)) };
}

export interface WordmarkPlacement {
  readonly left: number;
  readonly top: number;
  readonly height: number;
}

export function computeWatermarkWordmarkPlacement(box: WatermarkBox, handle: string): WordmarkPlacement {
  const scale = Math.min(box.width / watermarkViewBoxWidth(handle), box.height / watermarkViewBoxHeight);
  const offsetY = (box.height - watermarkViewBoxHeight * scale) / 2;
  return { left: Math.round(textLeft * scale), top: Math.round(offsetY + wordmarkSlot.top * scale), height: Math.max(6, Math.round(wordmarkSlot.height * scale)) };
}

const escapeXml = (text: string) => text.replace(/[<>&'"]/g, (character) => `&#${character.charCodeAt(0)};`);

function symbolTile(x: number, y: number, size: number): string {
  const scale = size / symbolViewBox;
  return `<g transform="translate(${x} ${y}) scale(${scale.toFixed(5)})"><rect width="${symbolViewBox}" height="${symbolViewBox}" rx="${symbolTileRadius}" fill="${zudomartBrandColour}"/>`
    + `<path d="${symbolPath}" fill="#FFFFFF"/></g>`;
}

export function buildBrandWatermarkSvg(box: WatermarkBox, handle: string, opacity: number): string {
  const viewBoxWidth = watermarkViewBoxWidth(handle);
  const shadow = `stroke="rgba(0,0,0,0.45)" stroke-width="2" paint-order="stroke"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${box.width}" height="${box.height}" viewBox="0 0 ${viewBoxWidth} ${watermarkViewBoxHeight}" preserveAspectRatio="xMinYMid meet">`
    + `<g opacity="${opacity}"><rect x="2" y="2" width="${viewBoxWidth - 4}" height="${watermarkViewBoxHeight - 4}" rx="18" fill="rgba(0,0,0,0.28)"/>${symbolTile(8, 8, 56)}`
    + `<text x="${textLeft}" y="62" font-size="19" font-weight="600" fill="#FFFFFF" ${shadow} font-family="DejaVu Sans, Arial, sans-serif">@${escapeXml(handle)}</text></g></svg>`;
}

export interface EndCardSize {
  readonly width: number;
  readonly height: number;
}

export function computeEndCardLogoSize(frameWidth: number, frameHeight: number): EndCardSize {
  const width = toEven(Math.min(frameWidth * 0.62, frameHeight * 0.9));
  return { width, height: toEven(width * 0.5) };
}

const endCardWordmark = { top: 96, height: 40 };
const endCardSymbol = { top: 10, height: 70 };

export function computeEndCardWordmarkPlacement(size: EndCardSize): WordmarkPlacement & { readonly width: number } {
  const scale = size.width / 320;
  const height = Math.max(8, Math.round(endCardWordmark.height * scale));
  const width = Math.round(height * (wordmarkPath.width / wordmarkPath.height));
  return { left: Math.round((size.width - width) / 2), top: Math.round(endCardWordmark.top * scale), height, width };
}

export type SymbolHalf = "left" | "right";

export function buildEndCardSymbolHalfSvg(size: EndCardSize, half: SymbolHalf): string {
  const symbolScale = endCardSymbol.height / 408;
  const offsetX = 160 - 512 * symbolScale;
  const offsetY = endCardSymbol.top - 308 * symbolScale;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 320 160">`
    + `<path d="${half === "left" ? symbolLeftHalfPath : symbolRightHalfPath}" fill="#FFFFFF" transform="translate(${offsetX.toFixed(2)} ${offsetY.toFixed(2)}) scale(${symbolScale.toFixed(5)})"/></svg>`;
}

export function buildEndCardLogoSvg(size: EndCardSize, handle: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 320 160">`
    + `<text x="160" y="156" font-size="14" font-weight="600" text-anchor="middle" fill="rgba(255,255,255,0.85)" font-family="DejaVu Sans, Arial, sans-serif">@${escapeXml(handle)}</text></svg>`;
}
