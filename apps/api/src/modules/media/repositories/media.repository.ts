import type { MediaRecord, NewMediaInput } from "../models/media.model.js";

export interface MediaRepository {
  create(input: NewMediaInput): Promise<MediaRecord>;
  findById(id: string): Promise<MediaRecord | undefined>;
  markUploadedIfPending(id: string, size: number): Promise<boolean>;
  delete(id: string): Promise<boolean>;
}

export class InMemoryMediaRepository implements MediaRepository {
  private readonly media = new Map<string, MediaRecord>();

  public async create(input: NewMediaInput): Promise<MediaRecord> {
    const record: MediaRecord = { ...input, size: null, status: "pending", createdAt: new Date() };
    this.media.set(record.id, record);
    return record;
  }

  public async findById(id: string): Promise<MediaRecord | undefined> {
    return this.media.get(id);
  }

  public async markUploadedIfPending(id: string, size: number): Promise<boolean> {
    const record = this.media.get(id);
    if (record === undefined || record.status !== "pending") return false;
    this.media.set(id, { ...record, size, status: "uploaded" });
    return true;
  }

  public async delete(id: string): Promise<boolean> {
    return this.media.delete(id);
  }
}
