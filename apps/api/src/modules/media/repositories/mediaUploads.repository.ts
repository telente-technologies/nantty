import type { NewUploadSessionInput, UploadChunkRecord, UploadSessionRecord, UploadSessionStatus } from "../models/mediaUpload.model.js";

export interface UploadStatusChange {
  readonly failureReason?: string;
  readonly mediaId?: string;
}

export interface MediaUploadsRepository {
  create(input: NewUploadSessionInput): Promise<UploadSessionRecord>;
  findById(id: string): Promise<UploadSessionRecord | undefined>;
  listChunks(uploadId: string): Promise<readonly UploadChunkRecord[]>;
  addChunkUnlessPresent(chunk: UploadChunkRecord): Promise<UploadChunkRecord>;
  changeStatusIfCurrent(id: string, from: readonly UploadSessionStatus[], to: UploadSessionStatus, change?: UploadStatusChange): Promise<boolean>;
  listUnfinishedCreatedBefore(cutoff: Date, limit: number): Promise<readonly UploadSessionRecord[]>;
  delete(id: string): Promise<void>;
}

export class InMemoryMediaUploadsRepository implements MediaUploadsRepository {
  private readonly uploads = new Map<string, UploadSessionRecord>();
  private readonly chunks = new Map<string, Map<number, UploadChunkRecord>>();

  public async create(input: NewUploadSessionInput): Promise<UploadSessionRecord> {
    const record: UploadSessionRecord = { ...input, status: "uploading", failureReason: null, mediaId: null, updatedAt: input.createdAt };
    this.uploads.set(record.id, record);
    this.chunks.set(record.id, new Map());
    return record;
  }

  public async findById(id: string): Promise<UploadSessionRecord | undefined> {
    return this.uploads.get(id);
  }

  public async listChunks(uploadId: string): Promise<readonly UploadChunkRecord[]> {
    return [...(this.chunks.get(uploadId)?.values() ?? [])].sort((left, right) => left.chunkIndex - right.chunkIndex);
  }

  public async addChunkUnlessPresent(chunk: UploadChunkRecord): Promise<UploadChunkRecord> {
    const chunksForUpload = this.chunks.get(chunk.uploadId) ?? new Map<number, UploadChunkRecord>();
    this.chunks.set(chunk.uploadId, chunksForUpload);
    const existing = chunksForUpload.get(chunk.chunkIndex);
    if (existing !== undefined) return existing;
    chunksForUpload.set(chunk.chunkIndex, chunk);
    return chunk;
  }

  public async changeStatusIfCurrent(id: string, from: readonly UploadSessionStatus[], to: UploadSessionStatus, change: UploadStatusChange = {}): Promise<boolean> {
    const record = this.uploads.get(id);
    if (record === undefined || !from.includes(record.status)) return false;
    this.uploads.set(id, {
      ...record,
      status: to,
      failureReason: change.failureReason ?? record.failureReason,
      mediaId: change.mediaId ?? record.mediaId,
      updatedAt: new Date(),
    });
    return true;
  }

  public async listUnfinishedCreatedBefore(cutoff: Date, limit: number): Promise<readonly UploadSessionRecord[]> {
    return [...this.uploads.values()]
      .filter((upload) => upload.status !== "completed" && upload.createdAt < cutoff)
      .slice(0, limit);
  }

  public async delete(id: string): Promise<void> {
    this.uploads.delete(id);
    this.chunks.delete(id);
  }
}
