export interface UploadChunkCommand {
  readonly ownerId: string;
  readonly uploadId: string;
  readonly chunkIndex: number;
  readonly bytes: Uint8Array;
  readonly sha256: string | undefined;
}
