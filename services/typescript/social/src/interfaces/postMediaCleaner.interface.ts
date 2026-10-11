export interface PostMediaCleaner {
  deleteMedia(mediaIds: readonly string[], reason: string): Promise<void>;
}
