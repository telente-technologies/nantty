import type { Media } from "./models.type";

export type DownloadableMedia = Media & { readonly id: string };

export interface PostMediaDownload {
  readonly status: "ready" | "processing";
  readonly progress: number;
  readonly url?: string;
  readonly expiresAt?: string;
  readonly fileName?: string;
  readonly contentType?: string;
  readonly sizeBytes?: number;
  readonly retryAfterMs?: number;
}

export interface DownloadSettings {
  readonly allowDownloads: boolean;
}
