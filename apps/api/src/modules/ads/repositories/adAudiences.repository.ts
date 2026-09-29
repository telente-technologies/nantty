import { randomUUID } from "node:crypto";

import type { CustomAudienceChanges, CustomAudienceRecord, NewCustomAudienceInput } from "../models/adAudiences.model.js";

export interface AdAudiencesRepository {
  createAudience(input: NewCustomAudienceInput, now: Date): Promise<CustomAudienceRecord>;
  findAudience(audienceId: string): Promise<CustomAudienceRecord | undefined>;
  listAudiences(accountId: string): Promise<readonly CustomAudienceRecord[]>;
  updateAudience(audienceId: string, changes: CustomAudienceChanges, now: Date): Promise<CustomAudienceRecord>;
  deleteAudience(audienceId: string): Promise<void>;
  replaceCustomerListHashes(audienceId: string, hashes: readonly string[]): Promise<void>;
  countCustomerListHashes(audienceId: string): Promise<number>;
}

export class InMemoryAdAudiencesRepository implements AdAudiencesRepository {
  private readonly audiences = new Map<string, CustomAudienceRecord>();
  private readonly hashes = new Map<string, readonly string[]>();

  public async createAudience(input: NewCustomAudienceInput, now: Date): Promise<CustomAudienceRecord> {
    const audience = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    this.audiences.set(audience.id, audience);
    return audience;
  }

  public async findAudience(audienceId: string): Promise<CustomAudienceRecord | undefined> {
    return this.audiences.get(audienceId);
  }

  public async listAudiences(accountId: string): Promise<readonly CustomAudienceRecord[]> {
    return [...this.audiences.values()].filter((audience) => audience.accountId === accountId).sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id));
  }

  public async updateAudience(audienceId: string, changes: CustomAudienceChanges, now: Date): Promise<CustomAudienceRecord> {
    const audience = this.audiences.get(audienceId);
    if (audience === undefined) throw new Error(`Audience ${audienceId} does not exist.`);
    const updated = { ...audience, ...changes, updatedAt: now };
    this.audiences.set(audienceId, updated);
    return updated;
  }

  public async deleteAudience(audienceId: string): Promise<void> {
    this.audiences.delete(audienceId);
    this.hashes.delete(audienceId);
  }

  public async replaceCustomerListHashes(audienceId: string, hashes: readonly string[]): Promise<void> {
    this.hashes.set(audienceId, [...new Set(hashes)]);
  }

  public async countCustomerListHashes(audienceId: string): Promise<number> {
    return this.hashes.get(audienceId)?.length ?? 0;
  }
}
