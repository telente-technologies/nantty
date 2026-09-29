import type { VerificationRecord } from "../models/verifications.model.js";
import { convertVerificationToBadge } from "../services/verificationBadgeLookup.service.js";
import { maskVerificationDetails } from "../services/verificationDetails.service.js";

export function convertVerificationToDto(record: VerificationRecord) {
  return {
    profileId: record.profileId,
    profileType: record.profileType,
    verificationType: record.verificationType,
    color: record.color,
    status: record.status,
    tier: record.tier,
    badgeVisible: record.badgeVisible,
    verification: convertVerificationToBadge(record),
    applicationSubmittedAt: record.applicationSubmittedAt?.toISOString() ?? null,
    reviewedAt: record.reviewedAt?.toISOString() ?? null,
    reason: record.reason,
  };
}

export function convertVerificationToPrivateDto(record: VerificationRecord) {
  return { ...convertVerificationToDto(record), details: maskVerificationDetails(record.details) };
}
