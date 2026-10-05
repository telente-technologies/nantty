export interface DownloadVariantView {
  readonly status: "ready" | "processing";
  readonly progress: number;
  readonly url?: string;
  readonly expiresAt?: string;
  readonly fileName?: string;
  readonly contentType?: string;
  readonly sizeBytes?: number;
  readonly retryAfterMs?: number;
}
