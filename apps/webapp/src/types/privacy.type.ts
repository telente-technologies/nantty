export type ConsentKey = "personalization" | "personalizedAds" | "analytics" | "marketing";
export type ConsentChoices = Readonly<Record<ConsentKey, boolean>>;

export interface ConsentRecord {
  readonly policyVersion: string;
  readonly consents: ConsentChoices;
  readonly updatedAt: string;
}

export interface UpdateConsentsInput {
  readonly policyVersion?: string;
  readonly policyVersionId?: string;
  readonly consents: Partial<ConsentChoices>;
}

export type DataExportStatus = "none" | "requested" | "processing" | "ready";

export interface DataExportRequest {
  readonly status: DataExportStatus;
  readonly requestedAt: string | null;
  readonly downloadUrl: string | null;
  readonly expiresAt: string | null;
}

export interface AccountDeletionSchedule {
  readonly scheduledFor: string;
}
