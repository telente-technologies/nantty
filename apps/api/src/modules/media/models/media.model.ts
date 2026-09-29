export const MEDIA_PURPOSES = ["avatar", "banner", "product", "post", "clip", "story", "message"] as const;
export type MediaPurpose = (typeof MEDIA_PURPOSES)[number];

export const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const VIDEO_CONTENT_TYPES = ["video/mp4", "video/quicktime"] as const;
export const MEDIA_CONTENT_TYPES = [...IMAGE_CONTENT_TYPES, ...VIDEO_CONTENT_TYPES] as const;
export type MediaContentType = (typeof MEDIA_CONTENT_TYPES)[number];

export type MediaStatus = "pending" | "uploaded";

export interface MediaRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly key: string;
  readonly purpose: MediaPurpose;
  readonly contentType: MediaContentType;
  readonly maxBytes: number;
  readonly size: number | null;
  readonly status: MediaStatus;
  readonly createdAt: Date;
}

export type NewMediaInput = Pick<MediaRecord, "id" | "ownerId" | "key" | "purpose" | "contentType" | "maxBytes">;

const IMAGE_ONLY_PURPOSES: readonly MediaPurpose[] = ["avatar", "banner", "product"];
const VIDEO_ONLY_PURPOSES: readonly MediaPurpose[] = ["clip"];

export function isImageContentType(contentType: MediaContentType): boolean {
  return (IMAGE_CONTENT_TYPES as readonly string[]).includes(contentType);
}

export function purposeAllowsContentType(purpose: MediaPurpose, contentType: MediaContentType): boolean {
  if (IMAGE_ONLY_PURPOSES.includes(purpose)) return isImageContentType(contentType);
  if (VIDEO_ONLY_PURPOSES.includes(purpose)) return !isImageContentType(contentType);
  return true;
}

function bytesStartWith(bytes: Uint8Array, signature: readonly number[], offset = 0): boolean {
  return signature.every((value, index) => bytes[offset + index] === value);
}

function asciiCodes(text: string): readonly number[] {
  return [...text].map((character) => character.charCodeAt(0));
}

export function fileContentMatchesDeclaredType(bytes: Uint8Array, contentType: MediaContentType): boolean {
  if (contentType === "image/jpeg") return bytesStartWith(bytes, [0xff, 0xd8, 0xff]);
  if (contentType === "image/png") return bytesStartWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (contentType === "image/webp") return bytesStartWith(bytes, asciiCodes("RIFF")) && bytesStartWith(bytes, asciiCodes("WEBP"), 8);
  return bytesStartWith(bytes, asciiCodes("ftyp"), 4);
}
