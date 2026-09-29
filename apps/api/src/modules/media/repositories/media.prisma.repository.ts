import type { Media } from "../../../generated/prisma/client.js";
import { prisma } from "../../../integrations/database.integration.js";
import type { MediaContentType, MediaPurpose, MediaRecord, MediaStatus, NewMediaInput } from "../models/media.model.js";
import type { MediaRepository } from "./media.repository.js";

function convertMediaRowToRecord(row: Media): MediaRecord {
  return {
    ...row,
    purpose: row.purpose as MediaPurpose,
    contentType: row.contentType as MediaContentType,
    status: row.status as MediaStatus,
  };
}

export class PrismaMediaRepository implements MediaRepository {
  public async create(input: NewMediaInput): Promise<MediaRecord> {
    return convertMediaRowToRecord(await prisma().media.create({ data: { ...input } }));
  }

  public async findById(id: string): Promise<MediaRecord | undefined> {
    const row = await prisma().media.findUnique({ where: { id } });
    return row === null ? undefined : convertMediaRowToRecord(row);
  }

  public async markUploadedIfPending(id: string, size: number): Promise<boolean> {
    const result = await prisma().media.updateMany({ where: { id, status: "pending" }, data: { status: "uploaded", size } });
    return result.count === 1;
  }

  public async delete(id: string): Promise<boolean> {
    return (await prisma().media.deleteMany({ where: { id } })).count > 0;
  }
}
