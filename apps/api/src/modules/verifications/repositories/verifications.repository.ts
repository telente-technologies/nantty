import { randomUUID } from "node:crypto";

import type { Page, PageRequest } from "../../../types/pagination.type.js";
import { compareByNewestFirst, paginateSortedItems } from "../../../utils/pagination.util.js";
import type { NewVerification, VerificationFilter, VerificationPatch, VerificationRecord } from "../models/verifications.model.js";

export interface VerificationsRepository {
  findByProfileId(profileId: string): Promise<VerificationRecord | undefined>;
  findManyByProfileIds(profileIds: readonly string[]): Promise<readonly VerificationRecord[]>;
  create(input: NewVerification): Promise<VerificationRecord>;
  update(profileId: string, patch: VerificationPatch, updatedAt: Date): Promise<VerificationRecord>;
  list(filter: VerificationFilter, page: PageRequest): Promise<Page<VerificationRecord>>;
}

export class InMemoryVerificationsRepository implements VerificationsRepository {
  private readonly verifications = new Map<string, VerificationRecord>();

  public async findByProfileId(profileId: string): Promise<VerificationRecord | undefined> {
    return this.verifications.get(profileId);
  }

  public async findManyByProfileIds(profileIds: readonly string[]): Promise<readonly VerificationRecord[]> {
    return profileIds.flatMap((profileId) => this.verifications.get(profileId) ?? []);
  }

  public async create(input: NewVerification): Promise<VerificationRecord> {
    const now = new Date();
    const record: VerificationRecord = { ...input, id: randomUUID(), createdAt: now, updatedAt: now };
    this.verifications.set(record.profileId, record);
    return record;
  }

  public async update(profileId: string, patch: VerificationPatch, updatedAt: Date): Promise<VerificationRecord> {
    const existing = this.verifications.get(profileId);
    if (existing === undefined) throw new Error(`No verification for profile ${profileId}.`);
    const updated: VerificationRecord = { ...existing, ...patch, updatedAt };
    this.verifications.set(profileId, updated);
    return updated;
  }

  public async list(filter: VerificationFilter, page: PageRequest): Promise<Page<VerificationRecord>> {
    const matches = [...this.verifications.values()]
      .filter((record) => (filter.status === undefined || record.status === filter.status) && (filter.type === undefined || record.verificationType === filter.type))
      .sort(compareByNewestFirst);
    return paginateSortedItems(matches, page);
  }
}
