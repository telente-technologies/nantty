export interface ModerationRequest {
  readonly mediaId: string;
  readonly ownerId: string;
  readonly purpose: string;
  readonly kind: "image" | "video";
  readonly frames: readonly Uint8Array[];
  readonly text?: string;
}

export interface ModerationResult {
  readonly score: number;
  readonly topCategory: string | null;
}

export interface ModerationClient {
  classify(request: ModerationRequest): Promise<ModerationResult>;
}
