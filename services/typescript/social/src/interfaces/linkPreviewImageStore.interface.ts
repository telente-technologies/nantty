export interface StoredLinkPreviewImage {
  readonly mediaId: string;
  readonly url: string;
}

export interface LinkPreviewImageStore {
  storeImage(bytes: Buffer, contentType: string): Promise<StoredLinkPreviewImage>;
}
