import type { MediaAssetView } from "../../../assets/models/mediaAsset.model.js";

export interface GetUploadSessionQuery {
  readonly ownerId: string;
  readonly uploadId: string;
}

export interface UploadSessionStatusView {
  readonly status: "uploading" | "processing" | "ready" | "failed";
  readonly uploadedChunks: readonly number[];
  readonly media?: MediaAssetView;
}
