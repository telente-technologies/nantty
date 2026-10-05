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

export interface DownloadTarget {
  readonly postId: string;
  readonly mediaId: string;
  readonly mediaType: "image" | "video";
}
