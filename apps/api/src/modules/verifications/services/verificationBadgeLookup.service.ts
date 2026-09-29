import type { VerificationBadge, VerificationBadgeLookup } from "../../../interfaces/verificationBadge.interface.js";
import type { VerificationRecord } from "../models/verifications.model.js";
import type { VerificationsRepository } from "../repositories/verifications.repository.js";

export function convertVerificationToBadge(record: VerificationRecord): VerificationBadge {
  return { status: record.status, type: record.verificationType, color: record.color, tier: record.tier, badgeVisible: record.badgeVisible };
}

export class RepositoryVerificationBadgeLookup implements VerificationBadgeLookup {
  public constructor(private readonly verifications: VerificationsRepository) {}

  public async findVerificationBadges(profileIds: readonly string[]): Promise<ReadonlyMap<string, VerificationBadge>> {
    if (profileIds.length === 0) return new Map();
    const records = await this.verifications.findManyByProfileIds([...new Set(profileIds)]);
    return new Map(records.map((record) => [record.profileId, convertVerificationToBadge(record)]));
  }
}
