import type { CopyrightClaimInput, CopyrightClaimReceipt, CopyrightClaimTargetType } from "@/types";

import { api, generateIdempotencyKey } from "./apiClient.service";

const COPYRIGHT_CLAIM_TARGET_TYPES: readonly string[] = ["clip", "sound", "post", "live"];

export const isCopyrightClaimTargetType = (targetType: string): targetType is CopyrightClaimTargetType =>
  COPYRIGHT_CLAIM_TARGET_TYPES.includes(targetType);

export const isValidContactEmailAddress = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());

export const MAXIMUM_COPYRIGHT_TEXT_LENGTH = 1_000;

export const isValidEvidenceLink = (link: string) => /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(link.trim()) && link.trim().length <= 2048;

export const splitEvidenceLinks = (text: string) => text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== "").slice(0, 10);

export const copyrightClaimsService = {
  submitCopyrightClaim: (input: CopyrightClaimInput, idempotencyKey: string = generateIdempotencyKey()) =>
    api.post<CopyrightClaimReceipt>("/api/v1/copyright/claims", input, { idempotencyKey }),
};
