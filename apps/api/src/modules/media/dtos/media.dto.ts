import type { MediaRecord } from "../models/media.model.js";

export interface UploadInstructionsDto {
  readonly mediaId: string;
  readonly uploadUrl: string;
  readonly method: "PUT";
  readonly headers: Readonly<Record<string, string>>;
  readonly maxBytes: number;
  readonly expiresAt: string;
  readonly url: string;
}

export function convertMediaToDto(media: MediaRecord, url: string) {
  return {
    id: media.id,
    purpose: media.purpose,
    contentType: media.contentType,
    size: media.size,
    status: media.status,
    url,
    createdAt: media.createdAt.toISOString(),
  };
}

export type MediaDto = ReturnType<typeof convertMediaToDto>;
