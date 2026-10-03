const mimeFamilies: readonly (readonly string[])[] = [
  ["image/jpeg", "image/jpg", "image/pjpeg"],
  ["image/heic", "image/heif"],
  ["video/mp4", "video/quicktime", "audio/mp4", "audio/x-m4a"],
  ["audio/wav", "audio/x-wav", "audio/wave"],
  ["video/webm", "audio/webm"],
];

export function normalizeMimeType(mimeType: string): string {
  return (mimeType.split(";")[0] ?? "").trim().toLowerCase();
}

export function areMimeTypesCompatible(first: string, second: string): boolean {
  const left = normalizeMimeType(first);
  const right = normalizeMimeType(second);
  if (left === right) return true;
  return mimeFamilies.some((family) => family.includes(left) && family.includes(right));
}

const ascii = (bytes: Uint8Array, start: number, end: number) => String.fromCharCode(...bytes.subarray(start, end));
const startsWith = (bytes: Uint8Array, signature: readonly number[]) => signature.every((value, index) => bytes[index] === value);

const heicBrands = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1", "heif"]);

function sniffIsoBaseMedia(bytes: Uint8Array): string | undefined {
  if (bytes.length < 12 || ascii(bytes, 4, 8) !== "ftyp") return undefined;
  const brand = ascii(bytes, 8, 12).trim();
  if (brand === "avif" || brand === "avis") return "image/avif";
  if (heicBrands.has(brand)) return "image/heic";
  if (brand === "qt") return "video/quicktime";
  if (brand === "M4A" || brand === "M4B") return "audio/mp4";
  return "video/mp4";
}

export function sniffMimeType(bytes: Uint8Array): string | undefined {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF") {
    const form = ascii(bytes, 8, 12);
    if (form === "WEBP") return "image/webp";
    if (form === "WAVE") return "audio/wav";
    return undefined;
  }
  const isoBaseMedia = sniffIsoBaseMedia(bytes);
  if (isoBaseMedia !== undefined) return isoBaseMedia;
  if (startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])) return "video/webm";
  if (ascii(bytes, 0, 5) === "%PDF-") return "application/pdf";
  if (ascii(bytes, 0, 4) === "OggS") return "audio/ogg";
  if (ascii(bytes, 0, 3) === "ID3" || (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xe6) === 0xe2)) return "audio/mpeg";
  if (bytes[0] === 0xff && ((bytes[1] ?? 0) & 0xf6) === 0xf0) return "audio/aac";
  return undefined;
}

export function kindOfMimeType(mimeType: string): "image" | "video" | "audio" | "document" | undefined {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType === "application/pdf") return "document";
  return undefined;
}
