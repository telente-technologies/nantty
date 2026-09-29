import type { MediaUpload, MediaUploadChunk } from "../../../generated/prisma/client.js";
import { isUniqueConstraintViolation } from "../../../databases/prisma.database.js";
import { prisma } from "../../../integrations/database.integration.js";
import type {
  MediaMimeType,
  MediaPurpose,
  NewUploadSessionInput,
  UploadChunkRecord,
  UploadSessionRecord,
  UploadSessionStatus,
} from "../models/mediaUpload.model.js";
import type { MediaUploadsRepository, UploadStatusChange } from "./mediaUploads.repository.js";

function convertUploadRowToRecord(row: MediaUpload): UploadSessionRecord {
  return {
    ...row,
    mimeType: row.mimeType as MediaMimeType,
    purpose: row.purpose as MediaPurpose,
    status: row.status as UploadSessionStatus,
  };
}

function convertChunkRowToRecord(row: MediaUploadChunk): UploadChunkRecord {
  return { uploadId: row.uploadId, chunkIndex: row.chunkIndex, sizeBytes: row.sizeBytes, sha256: row.sha256, storageKey: row.storageKey };
}

export class PrismaMediaUploadsRepository implements MediaUploadsRepository {
  public async create(input: NewUploadSessionInput): Promise<UploadSessionRecord> {
    return convertUploadRowToRecord(await prisma().mediaUpload.create({ data: { ...input } }));
  }

  public async findById(id: string): Promise<UploadSessionRecord | undefined> {
    const row = await prisma().mediaUpload.findUnique({ where: { id } });
    return row === null ? undefined : convertUploadRowToRecord(row);
  }

  public async listChunks(uploadId: string): Promise<readonly UploadChunkRecord[]> {
    const rows = await prisma().mediaUploadChunk.findMany({ where: { uploadId }, orderBy: { chunkIndex: "asc" } });
    return rows.map(convertChunkRowToRecord);
  }

  public async addChunkUnlessPresent(chunk: UploadChunkRecord): Promise<UploadChunkRecord> {
    try {
      return convertChunkRowToRecord(await prisma().mediaUploadChunk.create({ data: { ...chunk } }));
    } catch (error) {
      if (!isUniqueConstraintViolation(error)) throw error;
      const existing = await prisma().mediaUploadChunk.findUnique({ where: { uploadId_chunkIndex: { uploadId: chunk.uploadId, chunkIndex: chunk.chunkIndex } } });
      if (existing === null) throw error;
      return convertChunkRowToRecord(existing);
    }
  }

  public async changeStatusIfCurrent(id: string, from: readonly UploadSessionStatus[], to: UploadSessionStatus, change: UploadStatusChange = {}): Promise<boolean> {
    const result = await prisma().mediaUpload.updateMany({
      where: { id, status: { in: [...from] } },
      data: {
        status: to,
        ...(change.failureReason === undefined ? {} : { failureReason: change.failureReason }),
        ...(change.mediaId === undefined ? {} : { mediaId: change.mediaId }),
      },
    });
    return result.count === 1;
  }

  public async listUnfinishedCreatedBefore(cutoff: Date, limit: number): Promise<readonly UploadSessionRecord[]> {
    const rows = await prisma().mediaUpload.findMany({
      where: { status: { not: "completed" }, createdAt: { lt: cutoff } },
      orderBy: { createdAt: "asc" },
      take: limit,
    });
    return rows.map(convertUploadRowToRecord);
  }

  public async delete(id: string): Promise<void> {
    await prisma().mediaUpload.deleteMany({ where: { id } });
  }
}
