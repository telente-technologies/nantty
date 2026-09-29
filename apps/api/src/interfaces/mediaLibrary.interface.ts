export type MediaLibraryItemType = "image" | "video" | "document" | "audio";
export type MediaLibraryItemStatus = "processing" | "ready" | "failed";

export interface MediaLibraryItem {
  readonly id: string;
  readonly ownerId: string;
  readonly purpose: string;
  readonly type: MediaLibraryItemType;
  readonly status: MediaLibraryItemStatus;
  readonly url: string | null;
  readonly posterUrl: string | null;
  readonly width: number | null;
  readonly height: number | null;
  readonly durationSeconds: number | null;
  readonly blurhash: string | null;
  readonly failureReason: string | null;
}

export interface MediaLibrary {
  findMediaByIds(mediaIds: readonly string[]): Promise<readonly MediaLibraryItem[]>;
}
