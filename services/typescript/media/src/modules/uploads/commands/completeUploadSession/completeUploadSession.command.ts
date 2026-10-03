export interface CompleteUploadSessionCommand {
  readonly ownerId: string;
  readonly lookup: { readonly uploadId: string } | { readonly mediaId: string };
}

export interface CompletedUploadView {
  readonly mediaId: string;
  readonly status: "processing";
}
