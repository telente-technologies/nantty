import type { MediaMimeType } from "./mediaUpload.model.js";

const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]);
const QUICKTIME_ATOMS = new Set(["moov", "mdat", "wide", "free", "skip", "pnot"]);

function bytesStartWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return bytes.byteLength >= offset + signature.length && signature.every((value, index) => bytes[offset + index] === value);
}

function readAscii(bytes: Uint8Array, offset: number, length: number): string {
  if (bytes.byteLength < offset + length) return "";
  return String.fromCharCode(...bytes.subarray(offset, offset + length));
}

function isMpegAudioFrameSync(bytes: Uint8Array): boolean {
  return bytes.byteLength >= 2 && bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe0) === 0xe0;
}

function readIsoBaseMediaBrand(bytes: Uint8Array): string | undefined {
  return readAscii(bytes, 4, 4) === "ftyp" ? readAscii(bytes, 8, 4) : undefined;
}

export function fileHeaderMatchesMimeType(header: Uint8Array, mimeType: MediaMimeType): boolean {
  const brand = readIsoBaseMediaBrand(header);
  switch (mimeType) {
    case "image/jpeg":
      return bytesStartWith(header, [0xff, 0xd8, 0xff]);
    case "image/png":
      return bytesStartWith(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/webp":
      return readAscii(header, 0, 4) === "RIFF" && readAscii(header, 8, 4) === "WEBP";
    case "image/heic":
      return brand !== undefined && HEIF_BRANDS.has(brand);
    case "video/mp4":
      return brand !== undefined && !HEIF_BRANDS.has(brand);
    case "video/quicktime":
      return (brand !== undefined && !HEIF_BRANDS.has(brand)) || QUICKTIME_ATOMS.has(readAscii(header, 4, 4));
    case "application/pdf":
      return readAscii(header, 0, 5) === "%PDF-";
    case "audio/mpeg":
      return readAscii(header, 0, 3) === "ID3" || isMpegAudioFrameSync(header);
    case "audio/aac":
      return readAscii(header, 0, 3) === "ID3" || bytesStartWith(header, [0xff, 0xf1]) || bytesStartWith(header, [0xff, 0xf9]);
    case "audio/mp4":
      return brand !== undefined && !HEIF_BRANDS.has(brand);
    case "audio/ogg":
      return readAscii(header, 0, 4) === "OggS";
    case "audio/webm":
      return bytesStartWith(header, [0x1a, 0x45, 0xdf, 0xa3]);
  }
}
