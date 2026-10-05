export interface MediaDownloadVariant {
  readonly status: "ready" | "processing";
  readonly progress: number;
  readonly url?: string;
  readonly expiresAt?: string;
  readonly fileName?: string;
  readonly contentType?: string;
  readonly sizeBytes?: number;
  readonly retryAfterMs?: number;
}

export interface MediaDownloadVariantRequest {
  readonly mediaId: string;
  readonly requesterId: string;
  readonly watermarkHandle: string;
  readonly stripAudio: boolean;
}

export interface MediaDownloadVariantClient {
  requestDownloadVariant(request: MediaDownloadVariantRequest): Promise<MediaDownloadVariant>;
}
