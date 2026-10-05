import type { ID } from "./models.type";

export type CopyrightClaimTargetType = "clip" | "sound" | "post" | "live";

export type CopyrightClaimScope = "audio" | "video";

export interface CopyrightInfringingSegment {
  readonly startSeconds: number;
  readonly endSeconds: number;
}

export interface CopyrightClaimInput {
  readonly targetType: CopyrightClaimTargetType;
  readonly targetId: ID;
  readonly claimScope: CopyrightClaimScope;
  readonly claimantName: string;
  readonly organization?: string;
  readonly claimantPhone?: string;
  readonly workDescription: string;
  readonly ownershipStatement: string;
  readonly contactEmail: string;
  readonly originalWorkUrl?: string;
  readonly proofUrls: readonly string[];
  readonly segments: readonly CopyrightInfringingSegment[];
  readonly goodFaith: true;
  readonly accuracyDeclared: true;
  readonly signatureName: string;
}

export interface CopyrightClaimReceipt {
  readonly claimId: ID;
  readonly status: "received";
}
