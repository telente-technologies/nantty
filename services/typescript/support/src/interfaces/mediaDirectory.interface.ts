export interface MediaRecord {
  readonly id: string;
  readonly ownerId: string;
  readonly purpose: string;
  readonly kind: string;
  readonly status: string;
}

export interface MediaDirectory {
  findMedia(mediaId: string): Promise<MediaRecord | null>;
}
